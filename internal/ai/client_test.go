package ai

import (
	"encoding/json/v2"
	"io"
	"net/http"
	"net/http/httptest"
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

func TestChatRequestShapeAndReply(t *testing.T) {
	var gotBody map[string]any
	var referer, title, auth string
	c := newStubClient(t, func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/chat/completions" {
			t.Errorf("path = %q", r.URL.Path)
		}
		referer = r.Header.Get("HTTP-Referer")
		title = r.Header.Get("X-Title")
		auth = r.Header.Get("Authorization")
		raw, _ := io.ReadAll(r.Body)
		_ = json.Unmarshal(raw, &gotBody)
		enc, _ := json.Marshal("hello " + fenceJSON)
		_, _ = w.Write([]byte(`{"choices":[{"message":{"content":` + string(enc) + `}}]}`))
	})

	text, err := c.Chat([]Message{{Role: "user", Content: "hi"}})
	if err != nil {
		t.Fatalf("Chat: %v", err)
	}
	if auth != "Bearer sk-test" || referer != "http://localhost:8080" || title != "Set & Signal" {
		t.Fatalf("headers: auth=%q referer=%q title=%q", auth, referer, title)
	}
	if gotBody["model"] != "openai/gpt-4o-mini" || gotBody["temperature"] != 0.4 || gotBody["max_tokens"] != float64(1500) {
		t.Fatalf("request body = %v", gotBody)
	}
	msgs, _ := gotBody["messages"].([]any)
	if len(msgs) != 1 || msgs[0].(map[string]any)["role"] != "user" {
		t.Fatalf("messages = %v", msgs)
	}
	if text != "hello "+fenceJSON {
		t.Fatalf("text = %q", text)
	}
}

func TestChatProviderErrorPrefersMessage(t *testing.T) {
	c := newStubClient(t, func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusPaymentRequired)
		_, _ = w.Write([]byte(`{"error":{"message":"insufficient credits"}}`))
	})
	if _, err := c.Chat(nil); err == nil || err.Error() != "insufficient credits" {
		t.Fatalf("err = %v", err)
	}

	c2 := newStubClient(t, func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusBadGateway)
		_, _ = w.Write([]byte(`not json`))
	})
	if _, err := c2.Chat(nil); err == nil || err.Error() != "OpenRouter HTTP 502" {
		t.Fatalf("fallback err = %v", err)
	}
}

func TestChatEmptyResponseIsError(t *testing.T) {
	c := newStubClient(t, func(w http.ResponseWriter, r *http.Request) {
		_, _ = w.Write([]byte(`{"choices":[{"message":{"content":"   "}}]}`))
	})
	if _, err := c.Chat(nil); err == nil || err.Error() != "empty response" {
		t.Fatalf("err = %v", err)
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
