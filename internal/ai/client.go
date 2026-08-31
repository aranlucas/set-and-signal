// Package ai ports the upstream OpenRouter proxy helpers from api/server.js
// §"OpenRouter (AI planning)" (lines 333–363): one chat-call seam with fixed
// sampling parameters and attribution headers, plus the fenced-JSON
// extractor used to recover structured replies from chatty models.
package ai

import (
	"bytes"
	"encoding/json/v2"
	"errors"
	"fmt"
	"io"
	"net/http"
	"regexp"
	"strings"
	"time"
)

// Message is one chat turn.
type Message struct {
	Role    string `json:"role"`
	Content string `json:"content"`
}

// Client talks to the OpenRouter chat-completions API. Create with New;
// override BaseURL (and optionally HTTP) for tests.
type Client struct {
	APIKey  string
	Model   string
	Origin  string // sent as the http-referer attribution header
	BaseURL string
	HTTP    *http.Client
}

// New returns a Client pointed at the public OpenRouter endpoint with the
// upstream 45s→30s guard: requests never hang longer than the timeout.
func New(apiKey, model, origin string) *Client {
	return &Client{
		APIKey:  apiKey,
		Model:   model,
		Origin:  origin,
		BaseURL: "https://openrouter.ai/api/v1",
		HTTP:    &http.Client{Timeout: 30 * time.Second},
	}
}

// chatRequest mirrors openRouterChat's body: fixed temperature 0.4 and
// max_tokens 1500 keep suggestions conservative and bills bounded.
type chatRequest struct {
	Model       string    `json:"model"`
	Temperature float64   `json:"temperature"`
	MaxTokens   int       `json:"max_tokens"`
	Messages    []Message `json:"messages"`
}

type chatResponse struct {
	Error *struct {
		Message string `json:"message"`
	} `json:"error"`
	Choices []struct {
		Message struct {
			Content string `json:"content"`
		} `json:"message"`
	} `json:"choices"`
}

// Chat sends the conversation and returns the assistant message content.
// Provider-side failures surface as errors carrying the provider's own
// message when available ("OpenRouter HTTP <status>" otherwise); an empty
// reply is an error too, like upstream.
func (c *Client) Chat(messages []Message) (string, error) {
	body, err := json.Marshal(chatRequest{
		Model:       c.Model,
		Temperature: 0.4,
		MaxTokens:   1500,
		Messages:    messages,
	})
	if err != nil {
		return "", fmt.Errorf("encode chat request: %w", err)
	}
	req, err := http.NewRequest(http.MethodPost, c.BaseURL+"/chat/completions", bytes.NewReader(body))
	if err != nil {
		return "", err
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Bearer "+c.APIKey)
	req.Header.Set("HTTP-Referer", c.Origin) // OpenRouter attribution headers
	req.Header.Set("X-Title", "Set & Signal")

	client := c.HTTP
	if client == nil {
		client = http.DefaultClient // zero-value Client stays usable
	}
	resp, err := client.Do(req)
	if err != nil {
		return "", err
	}
	defer func() { _ = resp.Body.Close() }()

	raw, err := io.ReadAll(io.LimitReader(resp.Body, 1<<20))
	if err != nil {
		return "", err
	}
	var data chatResponse
	// A non-JSON body still yields the status fallback below.
	_ = json.Unmarshal(raw, &data)

	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		if data.Error != nil && data.Error.Message != "" {
			return "", errors.New(data.Error.Message)
		}
		return "", fmt.Errorf("OpenRouter HTTP %d", resp.StatusCode)
	}
	text := ""
	if len(data.Choices) > 0 {
		text = data.Choices[0].Message.Content
	}
	if strings.TrimSpace(text) == "" {
		return "", errors.New("empty response")
	}
	return text, nil
}

var fencedRe = regexp.MustCompile(`(?s)` + "```(?:json)?\\s*([\\s\\S]*?)```")

// ExtractJSON recovers the JSON object from a model reply: a fenced ```json
// block wins when present, else the outermost braces of the raw text.
// Mirrors extractJSON (server.js lines 356–363).
func ExtractJSON(text string) (map[string]any, error) {
	raw := text
	if m := fencedRe.FindStringSubmatch(text); m != nil {
		raw = m[1]
	}
	a := strings.Index(raw, "{")
	beforeLastBrace, _, ok := strings.CutLast(raw, "}")
	b := len(beforeLastBrace)
	if a < 0 || !ok || b <= a {
		return nil, errors.New("no JSON object in reply")
	}
	var obj map[string]any
	if err := json.Unmarshal([]byte(raw[a:b+1]), &obj); err != nil {
		return nil, err
	}
	return obj, nil
}
