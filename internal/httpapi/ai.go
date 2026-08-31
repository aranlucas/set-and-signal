package httpapi

import (
	"bytes"
	"encoding/json/jsontext"
	"encoding/json/v2"
	"net/http"

	"github.com/aranlucas/set-and-signal/internal/ai"
	"github.com/aranlucas/set-and-signal/internal/sanitize"
)

// AI workout planning (server.js lines 664–705). GET status is public;
// next-workout accepts any credential, like upstream's auth() guard.

const systemPrompt = "You are a strength coach planning the athlete's NEXT workout from their logs. " +
	"Rules: progress conservatively — no weight jumps above ~10%; if recent sets show missed reps or big drops, reduce; " +
	"bodyweight exercises progress in reps or extra sets, not load; timed exercises change seconds, cardio changes minutes/speed. " +
	"Keep the same exercises unless a swap is clearly better (then set swapTo to another exercise id). " +
	"Reply with ONLY a JSON object, no prose, exactly this shape: " +
	`{"summary": string (2-3 sentences, why today looks like this), "entries": [{"id": string, "sets"?: number, "reps"?: number, "weight"?: number, "sec"?: number, "min"?: number, "speed"?: number, "swapTo"?: string, "note"?: string}]}. ` +
	"Every entry.id MUST be an exercise id from the digest's routine; include one entry per exercise you want to adjust."

// GET /api/ai/status — no auth upstream; the login screen probes it.
func (s *Server) aiStatus(w http.ResponseWriter, _ *http.Request) {
	writeJSON(w, http.StatusOK, aiStatusResponse{Enabled: s.aiEnabled(), Model: s.Cfg.OpenRouterModel})
}

type aiStatusResponse struct {
	Enabled bool   `json:"enabled"`
	Model   string `json:"model"`
}

type aiNextWorkoutRequest struct {
	Digest jsontext.Value `json:"digest"`
}

type aiNextWorkoutResponse struct {
	Suggestion MCPSuggestionOutput `json:"suggestion"`
	Model      string              `json:"model"`
}

func (s *Server) aiEnabled() bool {
	return s.AI != nil && s.AI.APIKey != ""
}

// POST /api/ai/next-workout — turns the client-built training-log digest into
// a suggestion for today's session.
func (s *Server) postAINextWorkout(w http.ResponseWriter, r *http.Request) {
	u := s.requireAnyAuth(w, r)
	if u == nil {
		return
	}
	var body aiNextWorkoutRequest
	if !readJSON(w, r, &body) {
		return
	}
	parsed, code, errMsg := s.nextWorkoutSuggestion(body.Digest)
	if code != 0 {
		writeErr(w, code, errMsg)
		return
	}
	writeJSON(w, http.StatusOK, aiNextWorkoutResponse{Suggestion: parsed, Model: s.Cfg.OpenRouterModel})
}

// nextWorkoutSuggestion is the pipeline shared by the HTTP route and the MCP
// tool: digest size cap → provider chat → JSON extraction → paranoid
// cleaning. A zero code means success and parsed holds
// {summary, entries}; otherwise code/msg carry the HTTP-mapped failure so
// both surfaces answer identically.
func (s *Server) nextWorkoutSuggestion(digest jsontext.Value) (MCPSuggestionOutput, int, string) {
	return s.nextWorkoutSuggestionJSON(compactDigestJSON(digest))
}

// nextWorkoutSuggestionMCP is the typed MCP entry point. The MCP handler
// passes the closed MCPTrainingDigest graph directly, and receives the
// closed MCPSuggestionOutput graph directly; no generic output decoder or
// JSON round-trip sits between the AI response and the MCP contract.
func (s *Server) nextWorkoutSuggestionMCP(digest MCPTrainingDigest) (MCPSuggestionOutput, int, string) {
	return s.nextWorkoutSuggestionJSON(marshalTrainingDigest(digest))
}

// nextWorkoutSuggestionJSON contains the provider and sanitization pipeline.
// The provider's response is necessarily decoded through the existing AI
// extractor, but the result exposed to MCP is built field-by-field from the
// allow-listed sanitize.Suggestion values.
func (s *Server) nextWorkoutSuggestionJSON(raw []byte) (MCPSuggestionOutput, int, string) {
	const unavailable = "AI planning is not configured on this instance (set OPENROUTER_API_KEY)"
	if !s.aiEnabled() {
		return MCPSuggestionOutput{}, http.StatusServiceUnavailable, unavailable
	}

	// The digest is built client-side from the caller's own logs; cap it so a
	// runaway client can't turn into a runaway token bill.
	if len(raw) > 120000 {
		return MCPSuggestionOutput{}, http.StatusRequestEntityTooLarge, "digest too large"
	}

	text, err := s.AI.Chat([]ai.Message{
		{Role: "system", Content: systemPrompt},
		{Role: "user", Content: "Training log digest (JSON):\n" + string(raw)},
	})
	if err != nil {
		return MCPSuggestionOutput{}, http.StatusBadGateway, "AI provider error: " + err.Error()
	}

	obj, err := ai.ExtractJSON(text)
	if err != nil {
		return MCPSuggestionOutput{}, http.StatusBadGateway, "AI reply was not valid JSON — try again"
	}
	entries := make([]MCPSuggestionEntry, 0, 30)
	if list, ok := obj["entries"].([]any); ok {
		for _, e := range list {
			cleaned := sanitize.CleanSuggestion(e)
			if cleaned == nil {
				continue
			}
			entries = append(entries, mcpSuggestionEntry(cleaned))
			if len(entries) == 30 {
				break
			}
		}
	}
	if !hasSummary(obj["summary"]) && len(entries) == 0 { // upstream throws 'empty'
		return MCPSuggestionOutput{}, http.StatusBadGateway, "AI reply was not valid JSON — try again"
	}

	return MCPSuggestionOutput{
		Summary: jsSlice(sanitize.JSString(obj["summary"]), 800), // String(obj.summary || '').slice(0, 800)
		Entries: entries,
	}, 0, ""
}

// hasSummary ports `!obj.summary`: only JS-falsy summaries count as missing.
func hasSummary(v any) bool {
	switch t := v.(type) {
	case nil:
		return false
	case bool:
		return t
	case float64:
		return t != 0
	case string:
		return t != ""
	default:
		return true
	}
}

// marshalTrainingDigest is JSON.stringify for the typed MCP digest. JSON v2
// emits compact output without HTML escaping or a trailing newline by default.
func marshalTrainingDigest(digest MCPTrainingDigest) []byte {
	out, err := json.Marshal(digest)
	if err != nil {
		return nil
	}
	return out
}

// compactDigestJSON preserves the HTTP route's open digest input while
// keeping its output typed. A missing or null digest has the historic empty
// object meaning; valid JSON is compacted before enforcing the size cap.
func compactDigestJSON(digest jsontext.Value) []byte {
	digest = jsontext.Value(bytes.TrimSpace(digest))
	if len(digest) == 0 || bytes.Equal(digest, []byte("null")) {
		return []byte("{}")
	}
	compact := digest.Clone()
	if err := compact.Compact(); err != nil {
		return nil
	}
	return compact
}

// mcpSuggestionEntry renders only fields that survived cleanSuggestion into
// the closed MCP DTO. Empty swap/note values remain omitted from JSON.
func mcpSuggestionEntry(sg *sanitize.Suggestion) MCPSuggestionEntry {
	entry := MCPSuggestionEntry{ID: sg.ID, Sets: sg.Sets, Reps: sg.Reps, Weight: sg.Weight, Sec: sg.Sec, Min: sg.Min, Speed: sg.Speed}
	if sg.SwapTo != "" {
		value := sg.SwapTo
		entry.SwapTo = &value
	}
	if sg.Note != "" {
		value := sg.Note
		entry.Note = &value
	}
	return entry
}
