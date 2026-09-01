// Package ai provides the OpenRouter-backed workout-planning client. It uses
// the OpenAI Responses API with strict Structured Outputs, while retaining the
// legacy fenced-JSON extractor as a defensive parsing boundary.
package ai

import (
	"context"
	"encoding/json/v2"
	"errors"
	"fmt"
	"net/http"
	"regexp"
	"strings"
	"sync"
	"time"

	"github.com/invopop/jsonschema"
	"github.com/openai/openai-go/v3"
	"github.com/openai/openai-go/v3/option"
	"github.com/openai/openai-go/v3/responses"
)

// Message is one chat turn.
type Message struct {
	Role    string `json:"role"`
	Content string `json:"content"`
}

// Client talks to OpenRouter's OpenAI-compatible Responses API. Create with New;
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

// workoutPlan is the model-facing contract. Every adjustment field is required
// and nullable because strict Structured Outputs does not support optional
// object properties. The HTTP layer still sanitizes values before use.
type workoutPlan struct {
	Summary string             `json:"summary" jsonschema:"maxLength=800" jsonschema_description:"Two or three sentences explaining the next workout"`
	Entries []workoutPlanEntry `json:"entries" jsonschema:"maxItems=30" jsonschema_description:"One entry per exercise that should be adjusted"`
}

type workoutPlanEntry struct {
	ID     string   `json:"id" jsonschema_description:"Exercise id from the supplied routine"`
	Sets   *float64 `json:"sets" jsonschema:"nullable" jsonschema_description:"Working sets, or null when unchanged"`
	Reps   *float64 `json:"reps" jsonschema:"nullable" jsonschema_description:"Target repetitions, or null when unchanged"`
	Weight *float64 `json:"weight" jsonschema:"nullable" jsonschema_description:"Target weight, or null when unchanged"`
	Sec    *float64 `json:"sec" jsonschema:"nullable" jsonschema_description:"Target seconds, or null when unchanged"`
	Min    *float64 `json:"min" jsonschema:"nullable" jsonschema_description:"Target minutes, or null when unchanged"`
	Speed  *float64 `json:"speed" jsonschema:"nullable" jsonschema_description:"Target speed, or null when unchanged"`
	SwapTo *string  `json:"swapTo" jsonschema:"nullable" jsonschema_description:"Replacement exercise id, or null when no swap is needed"`
	Note   *string  `json:"note" jsonschema:"nullable,maxLength=300" jsonschema_description:"Short coaching note, or null when no note is needed"`
}

func generateSchema[T any]() (map[string]any, error) {
	reflector := jsonschema.Reflector{
		AllowAdditionalProperties: false,
		DoNotReference:            true,
	}
	var value T
	raw, err := json.Marshal(reflector.Reflect(value))
	if err != nil {
		return nil, fmt.Errorf("marshal JSON schema: %w", err)
	}
	var schema map[string]any
	if err := json.Unmarshal(raw, &schema); err != nil {
		return nil, fmt.Errorf("decode JSON schema: %w", err)
	}
	return schema, nil
}

var workoutPlanSchema = sync.OnceValues(generateSchema[workoutPlan])

// Chat sends the conversation and returns the assistant message content.
// Provider-side failures surface as errors carrying the provider's own
// message when available ("OpenRouter HTTP <status>" otherwise); an empty
// reply is an error too, like upstream.
func (c *Client) Chat(messages []Message) (string, error) {
	schema, err := workoutPlanSchema()
	if err != nil {
		return "", err
	}
	input := make(responses.ResponseInputParam, 0, len(messages))
	for _, message := range messages {
		role := responses.EasyInputMessageRole(message.Role)
		switch role {
		case responses.EasyInputMessageRoleUser,
			responses.EasyInputMessageRoleAssistant,
			responses.EasyInputMessageRoleSystem,
			responses.EasyInputMessageRoleDeveloper:
			input = append(input, responses.ResponseInputItemParamOfMessage(message.Content, role))
		default:
			return "", fmt.Errorf("unsupported message role %q", message.Role)
		}
	}

	baseURL := c.BaseURL
	if baseURL == "" {
		baseURL = "https://openrouter.ai/api/v1"
	}
	httpClient := c.HTTP
	if httpClient == nil {
		httpClient = http.DefaultClient
	}
	client := openai.NewClient(
		option.WithAPIKey(c.APIKey),
		option.WithBaseURL(baseURL),
		option.WithHTTPClient(httpClient),
		option.WithMaxRetries(0),
		option.WithHeader("HTTP-Referer", c.Origin),
		option.WithHeader("X-Title", "Set & Signal"),
	)
	params := responses.ResponseNewParams{
		Model:           openai.ResponsesModel(c.Model),
		Input:           responses.ResponseNewParamsInputUnion{OfInputItemList: input},
		MaxOutputTokens: openai.Int(1500),
		Temperature:     openai.Float(0.4),
		Text: responses.ResponseTextConfigParam{
			Format: responses.ResponseFormatTextConfigUnionParam{
				OfJSONSchema: &responses.ResponseFormatTextJSONSchemaConfigParam{
					Name:        "next_workout",
					Description: openai.String("A conservative adjustment plan for the athlete's next workout"),
					Schema:      schema,
					Strict:      openai.Bool(true),
				},
			},
		},
	}
	response, err := client.Responses.New(
		context.Background(),
		params,
		option.WithJSONSet("provider.require_parameters", true),
	)
	if err != nil {
		if apiErr, ok := errors.AsType[*openai.Error](err); ok {
			if apiErr.Message != "" {
				return "", errors.New(apiErr.Message)
			}
			return "", fmt.Errorf("OpenRouter HTTP %d", apiErr.StatusCode)
		}
		return "", err
	}
	text := response.OutputText()
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
