// Package sanitize ports the upstream state sanitizers from api/server.js
// §"state sanitizers" (lines 266–321): paranoid, allow-listed cleaning of
// granular API / AI-proposed state before anything reaches disk.
//
// Semantics mirror the JavaScript source exactly: values that are not JSON
// numbers are dropped, ranges are inclusive clamps, rounding is Math.round
// (half toward +∞), string caps count UTF-16 code units, and unknown fields
// never survive.
package sanitize

import (
	"math"
	"regexp"
	"slices"
	"strconv"
	"unicode/utf8"
)

// Policies is the upstream POLICIES list (server.js line 269).
var Policies = []string{"off", "linear", "greyskull", "double", "time"}

// Entry is a cleaned exercise entry (cleanEntry). Pointer numeric fields are
// nil when the input omitted them or failed validation.
type Entry struct {
	ID         string
	Mode       string // "time" or "reps"; empty when absent/invalid
	Bodyweight bool   // true only when bodyweight was literally true
	Side       bool   // true only when side was literally true
	Prog       string // one of Policies; empty otherwise

	Sets, Reps, Weight, Sec, Min, Speed, Inc, RepsMin, RepsMax *float64
}

// Routine is a cleaned routine (cleanRoutine).
type Routine struct {
	ID    string
	Name  string
	Emoji string
	Ex    []*Entry
	Prog  string
}

// Suggestion is one AI-proposed adjustment per exercise (cleanSuggestion).
// Only the fields present in the input move the needle.
type Suggestion struct {
	ID                                  string
	Sets, Reps, Weight, Sec, Min, Speed *float64
	SwapTo                              string
	Note                                string
}

// Num ports num(v, lo, hi): the value must be a plain number (what
// JSON.parse produces), finite, and within [lo, hi]; the survivor is rounded
// to 2 decimals with Math.round semantics (floor(x*100+0.5)/100, i.e. half
// toward +∞ — NOT Go's half-away-from-zero Round).
func Num(v any, lo, hi float64) *float64 {
	n, ok := asNumber(v)
	if !ok || math.IsNaN(n) || math.IsInf(n, 0) || n < lo || n > hi {
		return nil
	}
	r := math.Floor(n*100+0.5) / 100
	return &r
}

// asNumber mirrors typeof v === 'number': only actual numbers qualify.
// encoding/json/v2 decodes into float64, which is exactly a JS number.
func asNumber(v any) (float64, bool) {
	switch n := v.(type) {
	case float64:
		return n, true
	case float32:
		return float64(n), true
	case int:
		return float64(n), true
	case int32:
		return float64(n), true
	case int64:
		return float64(n), true
	default:
		return 0, false
	}
}

// CleanEntry ports cleanEntry (server.js lines 274–294).
func CleanEntry(e any) *Entry {
	obj, ok := e.(map[string]any)
	if !ok {
		return nil
	}
	id := jsTrim(JSString(orEmpty(obj["id"])))
	if id == "" || jsLen(id) > 40 {
		return nil
	}
	out := &Entry{
		ID:      id,
		Sets:    Num(obj["sets"], 1, 12),
		Reps:    Num(obj["reps"], 1, 500),
		Weight:  Num(obj["weight"], 0, 1000),
		Sec:     Num(obj["sec"], 1, 7200),
		Min:     Num(obj["min"], 1, 600),
		Speed:   Num(obj["speed"], 0, 80),
		Inc:     Num(obj["inc"], 0, 200),
		RepsMin: Num(obj["repsMin"], 1, 500),
		RepsMax: Num(obj["repsMax"], 1, 500),
	}
	if m, ok := obj["mode"].(string); ok && (m == "time" || m == "reps") {
		out.Mode = m
	}
	if b, ok := obj["bodyweight"].(bool); ok && b {
		out.Bodyweight = true
	}
	if b, ok := obj["side"].(bool); ok && b {
		out.Side = true
	}
	if p, ok := obj["prog"].(string); ok && isPolicy(p) {
		out.Prog = p
	}
	return out
}

// CleanRoutine ports cleanRoutine (server.js lines 295–309).
func CleanRoutine(r any) *Routine {
	obj, ok := r.(map[string]any)
	if !ok {
		return nil
	}
	name := jsTrim(JSString(orEmpty(obj["name"])))
	if name == "" {
		return nil
	}
	id := nonWord.ReplaceAllString(JSString(orEmpty(obj["id"])), "")
	if id == "" {
		return nil
	}
	out := &Routine{
		ID:    jsSlice(id, 40),
		Name:  jsSlice(name, 60),
		Emoji: jsSlice(JSString(orEmpty(obj["emoji"])), 24),
		Ex:    []*Entry{},
	}
	if ex, ok := obj["ex"].([]any); ok {
		for _, raw := range ex {
			if c := CleanEntry(raw); c != nil {
				out.Ex = append(out.Ex, c)
				if len(out.Ex) == 30 {
					break
				}
			}
		}
	}
	if p, ok := obj["prog"].(string); ok && isPolicy(p) {
		out.Prog = p
	}
	return out
}

// CleanSuggestion ports cleanSuggestion (server.js lines 311–321): an entry
// with nothing to say (no numeric change, swapTo, or note) is dropped.
func CleanSuggestion(e any) *Suggestion {
	c := CleanEntry(e)
	if c == nil {
		return nil
	}
	out := &Suggestion{
		ID:     c.ID,
		Sets:   c.Sets,
		Reps:   c.Reps,
		Weight: c.Weight,
		Sec:    c.Sec,
		Min:    c.Min,
		Speed:  c.Speed,
	}
	swap := jsTrim(JSString(orEmpty(e.(map[string]any)["swapTo"])))
	if swap != "" && jsLen(swap) <= 40 {
		out.SwapTo = swap
	}
	note := jsTrim(JSString(orEmpty(e.(map[string]any)["note"])))
	if note != "" {
		out.Note = jsSlice(note, 240)
	}
	if out.Sets == nil && out.Reps == nil && out.Weight == nil &&
		out.Sec == nil && out.Min == nil && out.Speed == nil &&
		out.SwapTo == "" && out.Note == "" {
		return nil
	}
	return out
}

var nonWord = regexp.MustCompile(`[^\w-]`) // JS \w is ASCII [A-Za-z0-9_]

func isPolicy(s string) bool {
	return slices.Contains(Policies, s)
}

// orEmpty ports `v || ”`: falsy values (undefined/null/false/0/”) become ”.
func orEmpty(v any) any {
	switch x := v.(type) {
	case nil:
		return ""
	case bool:
		if !x {
			return ""
		}
		return x
	case float64:
		if x == 0 {
			return ""
		}
		return x
	case string:
		if x == "" {
			return ""
		}
		return x
	default:
		return x
	}
}

// JSString ports JS String(): strings pass through, numbers use the shortest
// round-trip decimal form (JS only switches to exponential notation at
// ≥1e21), booleans print as words, everything else is "".
func JSString(v any) string {
	switch x := v.(type) {
	case string:
		return x
	case float64:
		return strconv.FormatFloat(x, 'f', -1, 64)
	case bool:
		if x {
			return "true"
		}
		return "false"
	default:
		return ""
	}
}

// jsLen counts UTF-16 code units, matching JavaScript's string.length.
func jsLen(s string) int {
	n := 0
	for _, r := range s {
		if r > 0xFFFF {
			n += 2
		} else {
			n++
		}
	}
	return n
}

// jsSlice ports s.slice(0, n) on UTF-16 code units.
func jsSlice(s string, n int) string {
	width := 0
	for i, r := range s {
		w := 1
		if r > 0xFFFF {
			w = 2
		}
		if width+w > n {
			return s[:i]
		}
		width += w
	}
	return s
}

// jsTrim ports JS String.prototype.trim()'s exact whitespace set.
func jsTrim(s string) string {
	for s != "" {
		r, size := utf8.DecodeRuneInString(s)
		if !isJSTrimmable(r) {
			break
		}
		s = s[size:]
	}
	for s != "" {
		r, size := utf8.DecodeLastRuneInString(s)
		if !isJSTrimmable(r) {
			break
		}
		s = s[:len(s)-size]
	}
	return s
}

func isJSTrimmable(r rune) bool {
	switch r {
	case '\t', '\n', '\v', '\f', '\r', ' ', 0x00A0, 0x1680, 0x2028, 0x2029,
		0x202F, 0x205F, 0x3000, 0xFEFF:
		return true
	}
	return r >= 0x2000 && r <= 0x200A
}
