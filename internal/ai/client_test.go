package ai

import (
	"encoding/json/v2"
	"io"
	"net/http"
	"net/http/httptest"
	"os"
	"testing"
)

func newStubClient(t *testing.T, handler http.HandlerFunc) *Client {
	t.Helper()
	ts := httptest.NewTestServer(t, handler)
	client := ts.Client()
	c := New("sk-test", "openai/gpt-4o-mini", "http://localhost:8080")
	c.BaseURL = ts.URL
	c.HTTP = client
	return c
}

// fenceJSON is the fenced reply body: ```json\n{"a":1}\n```.
const fenceJSON = "```json\n{\"a\":1}\n```"

func writeResponseReply(t *testing.T, w http.ResponseWriter, content string) {
	t.Helper()
	w.Header().Set("Content-Type", "application/json")
	body, err := json.Marshal(map[string]any{
		"id":         "resp_test",
		"object":     "response",
		"created_at": 1,
		"status":     "completed",
		"model":      "test/model",
		"output": []map[string]any{{
			"id":     "msg_test",
			"type":   "message",
			"status": "completed",
			"role":   "assistant",
			"content": []map[string]any{{
				"type":        "output_text",
				"text":        content,
				"annotations": []any{},
			}},
		}},
	})
	if err != nil {
		t.Errorf("marshal response: %v", err)
		w.WriteHeader(http.StatusInternalServerError)
		return
	}
	_, _ = w.Write(body)
}

func TestChatRequestShapeAndReply(t *testing.T) {
	var gotBody map[string]any
	var referer, title, auth string
	c := newStubClient(t, func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/responses" {
			t.Errorf("path = %q", r.URL.Path)
		}
		referer = r.Header.Get("HTTP-Referer")
		title = r.Header.Get("X-Title")
		auth = r.Header.Get("Authorization")
		raw, _ := io.ReadAll(r.Body)
		_ = json.Unmarshal(raw, &gotBody)
		writeResponseReply(t, w, "hello "+fenceJSON)
	})

	text, err := c.Chat([]Message{{Role: "user", Content: "hi"}})
	if err != nil {
		t.Fatalf("Chat: %v", err)
	}
	if auth != "Bearer sk-test" || referer != "http://localhost:8080" || title != "Set & Signal" {
		t.Fatalf("headers: auth=%q referer=%q title=%q", auth, referer, title)
	}
	if gotBody["model"] != "openai/gpt-4o-mini" || gotBody["temperature"] != 0.4 || gotBody["max_output_tokens"] != float64(1500) {
		t.Fatalf("request body = %v", gotBody)
	}
	provider, _ := gotBody["provider"].(map[string]any)
	if provider["require_parameters"] != true {
		t.Fatalf("provider = %v", provider)
	}
	textConfig, _ := gotBody["text"].(map[string]any)
	responseFormat, _ := textConfig["format"].(map[string]any)
	schema, _ := responseFormat["schema"].(map[string]any)
	if responseFormat["type"] != "json_schema" || responseFormat["name"] != "next_workout" || responseFormat["strict"] != true || schema["additionalProperties"] != false {
		t.Fatalf("response_format = %v", responseFormat)
	}
	properties := schema["properties"].(map[string]any)
	entries := properties["entries"].(map[string]any)
	item := entries["items"].(map[string]any)
	if len(item["required"].([]any)) != len(item["properties"].(map[string]any)) {
		t.Fatalf("strict schema has optional properties: %v", item)
	}
	itemProperties := item["properties"].(map[string]any)
	sets := itemProperties["sets"].(map[string]any)
	nullable := false
	for _, branch := range sets["oneOf"].([]any) {
		if branch.(map[string]any)["type"] == "null" {
			nullable = true
		}
	}
	if !nullable {
		t.Fatalf("sets is not nullable: %v", sets)
	}
	msgs, _ := gotBody["input"].([]any)
	if len(msgs) != 1 || msgs[0].(map[string]any)["role"] != "user" {
		t.Fatalf("input = %v", msgs)
	}
	if text != "hello "+fenceJSON {
		t.Fatalf("text = %q", text)
	}
}

func TestChatProviderErrorPrefersMessage(t *testing.T) {
	c := newStubClient(t, func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusPaymentRequired)
		_, _ = w.Write([]byte(`{"error":{"message":"insufficient credits"}}`))
	})
	if _, err := c.Chat(nil); err == nil || err.Error() != "insufficient credits" {
		t.Fatalf("err = %v", err)
	}

	c2 := newStubClient(t, func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusBadGateway)
		_, _ = w.Write([]byte(`not json`))
	})
	if _, err := c2.Chat(nil); err == nil || err.Error() != "OpenRouter HTTP 502" {
		t.Fatalf("fallback err = %v", err)
	}
}

func TestChatEmptyResponseIsError(t *testing.T) {
	c := newStubClient(t, func(w http.ResponseWriter, r *http.Request) {
		writeResponseReply(t, w, "   ")
	})
	if _, err := c.Chat(nil); err == nil || err.Error() != "empty response" {
		t.Fatalf("err = %v", err)
	}
}

func TestChatLiveStructuredOutput(t *testing.T) {
	apiKey := os.Getenv("OPENROUTER_API_KEY")
	if apiKey == "" {
		t.Skip("OPENROUTER_API_KEY is not set")
	}
	c := New(apiKey, "openrouter/free", "https://opengym2.up.railway.app")
	text, err := c.Chat([]Message{
		{Role: "system", Content: "Suggest conservative strength-training adjustments using the response schema."},
		{Role: "user", Content: "Routine: squat 3x5 at 100 lb. Recent result: completed every rep."},
	})
	if err != nil {
		t.Fatalf("live structured response: %v", err)
	}
	obj, err := ExtractJSON(text)
	if err != nil {
		t.Fatalf("parse live structured response: %v", err)
	}
	if _, ok := obj["summary"].(string); !ok {
		t.Fatalf("summary = %T", obj["summary"])
	}
	if _, ok := obj["entries"].([]any); !ok {
		t.Fatalf("entries = %T", obj["entries"])
	}
}

func TestExtractJSON(t *testing.T) {
	// Fenced block wins over surrounding prose.
	obj, err := ExtractJSON("Sure! Here you go:\n```json\n{\"summary\":\"s\",\"entries\":[]}\n```\nhope that helps {not json}")
	if err != nil || obj["summary"] != "s" {
		t.Fatalf("fenced = %v %v", obj, err)
	}
	// Unlabelled fences count too.
	obj, err = ExtractJSON("```\n{\"a\":true}\n```")
	if err != nil || obj["a"] != true {
		t.Fatalf("unlabelled fence = %v %v", obj, err)
	}
	// Otherwise the outermost braces.
	obj, err = ExtractJSON(`prefix {"nested":{"x":1},"tail":2} suffix`)
	if err != nil || obj["tail"] != float64(2) {
		t.Fatalf("braces = %v %v", obj, err)
	}
	// No object at all.
	if _, err := ExtractJSON("no braces here"); err == nil || err.Error() != "no JSON object in reply" {
		t.Fatalf("err = %v", err)
	}
	// Malformed JSON inside braces propagates the parse error.
	if _, err := ExtractJSON("{oops}"); err == nil {
		t.Fatal("malformed braces accepted")
	}
}
