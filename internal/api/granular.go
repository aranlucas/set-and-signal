package api

import (
	"cmp"
	"encoding/json/jsontext"
	"encoding/json/v2"
	"maps"
	"math"
	"net/http"
	"regexp"
	"slices"
	"strconv"
	"strings"
	"time"

	"github.com/aranlucas/set-and-signal/internal/sanitize"
)

// JS coercion helpers live in internal/sanitize (exported there since both
// packages need them): granular route inputs are validated with the same
// String()/trim/slice semantics as server.js before anything reaches the
// state blob.

// jsTrim approximates JS String.prototype.trim().
func jsTrim(s string) string { return strings.TrimSpace(s) }

func utf16Len(r rune) int {
	if r >= 0x10000 {
		return 2 // surrogate pair
	}
	return 1
}

// jsLen counts UTF-16 code units, matching JavaScript's string.length.
func jsLen(s string) int {
	n := 0
	for _, r := range s {
		n += utf16Len(r)
	}
	return n
}

// jsSlice ports s.slice(0, n) on UTF-16 code units.
func jsSlice(s string, n int) string {
	w := 0
	for i, r := range s {
		if w+utf16Len(r) > n {
			return s[:i]
		}
		w += utf16Len(r)
	}
	return s
}

// jsPlus ports JS unary + on decoded JSON values: numbers pass through,
// booleans become 1/0, numeric strings parse ("" is 0), everything else —
// including null, objects and non-numeric strings — is NaN.
func jsPlus(v any) float64 {
	switch t := v.(type) {
	case float64:
		return t
	case bool:
		if t {
			return 1
		}
		return 0
	case string:
		if jsTrim(t) == "" {
			return 0
		}
		n, err := strconv.ParseFloat(strings.TrimSpace(t), 64)
		if err != nil {
			return math.NaN()
		}
		return n
	default:
		return math.NaN()
	}
}

// plusOrZero ports `+v || 0`: NaN collapses to 0 like any other falsy value.
func plusOrZero(v any) float64 {
	n := jsPlus(v)
	if math.IsNaN(n) {
		return 0
	}
	return n
}

// jsRoundF ports Math.round: half toward +∞ (Math.round(-2.5) = -2).
func jsRoundF(x float64) float64 { return math.Floor(x + 0.5) }

// jsTruthy ports !!v for decoded JSON values.
func jsTruthy(v any) bool {
	switch t := v.(type) {
	case nil:
		return false
	case bool:
		return t
	case float64:
		return t != 0 && !math.IsNaN(t)
	case string:
		return t != ""
	default:
		return true
	}
}

var isoDateRe = regexp.MustCompile(`^\d{4}-\d{2}-\d{2}$`)

// stateMap decodes the stored blob (or an empty object when none yet) for a
// read-modify-write inside MutateState.
func stateMap(raw jsontext.Value) map[string]any {
	st := map[string]any{}
	if len(raw) > 0 && string(raw) != "null" {
		_ = json.Unmarshal(raw, &st)
	}
	return st
}

// routineMap renders sanitize.CleanRoutine's output with upstream's key set:
// id/name/emoji/ex always, prog only when a known policy.
func routineMap(r *sanitize.Routine) map[string]any {
	ex := make([]any, len(r.Ex))
	for i, e := range r.Ex {
		ex[i] = entryMap(e)
	}
	out := map[string]any{"id": r.ID, "name": r.Name, "emoji": r.Emoji, "ex": ex}
	if r.Prog != "" {
		out["prog"] = r.Prog
	}
	return out
}

// entryMap mirrors cleanEntry's output keys: only surviving fields appear.
func entryMap(e *sanitize.Entry) map[string]any {
	out := map[string]any{"id": e.ID}
	put := func(k string, v *float64) {
		if v != nil {
			out[k] = *v
		}
	}
	put("sets", e.Sets)
	if e.Mode != "" {
		out["mode"] = e.Mode
	}
	put("reps", e.Reps)
	put("weight", e.Weight)
	put("sec", e.Sec)
	put("min", e.Min)
	put("speed", e.Speed)
	if e.Bodyweight {
		out["bodyweight"] = true
	}
	if e.Side {
		out["side"] = true
	}
	if e.Prog != "" {
		out["prog"] = e.Prog
	}
	put("inc", e.Inc)
	put("repsMin", e.RepsMin)
	put("repsMax", e.RepsMax)
	return out
}

// POST /api/routine — upsert one sanitized routine by id. Cookie or bearer.
func (s *Server) postRoutine(w http.ResponseWriter, r *http.Request) {
	u := s.requireAnyAuth(w, r)
	if u == nil {
		return
	}
	var body struct {
		Routine any `json:"routine"`
	}
	if !readJSON(w, r, &body) {
		return
	}
	payload, code, msg := s.applyRoutine(u.ID, body.Routine)
	writeResult(w, payload, code, msg)
}

// POST /api/routines — batch-create / update a training program: one or more
// routines plus an optional weekday schedule. Cookie or bearer (OAuth).
// Body: { routines: [...], week?: {"0".."6": routineId|null}, replace?: bool }.
// When replace is true, existing routines are cleared first (week/dayPlan refs
// to deleted ids are dropped). Missing routine ids are derived from the name.
func (s *Server) postRoutines(w http.ResponseWriter, r *http.Request) {
	u := s.requireAnyAuth(w, r)
	if u == nil {
		return
	}
	var body struct {
		Routines any  `json:"routines"`
		Week     any  `json:"week"`
		Replace  bool `json:"replace"`
	}
	if !readJSON(w, r, &body) {
		return
	}
	payload, code, msg := s.applyProgram(u.ID, body.Routines, body.Week, body.Replace)
	writeResult(w, payload, code, msg)
}

// writeResult answers active REST mutations with payload on success or the
// {error: msg} envelope at the given status.
func writeResult(w http.ResponseWriter, payload map[string]any, code int, msg string) {
	if code != 0 {
		writeErr(w, code, msg)
		return
	}
	writeJSON(w, http.StatusOK, payload)
}

// applyRoutine is the mutation core of POST /api/routine.
func (s *Server) applyRoutine(uid string, routine any) (map[string]any, int, string) {
	rc := sanitize.CleanRoutine(ensureRoutineID(routine))
	if rc == nil {
		return nil, http.StatusBadRequest, "routine needs at least an id and a name"
	}
	obj := routineMap(rc)
	err := s.ST.MutateState(uid, func(raw jsontext.Value) (jsontext.Value, error) {
		st := stateMap(raw)
		routines, _ := st["routines"].([]any)
		replaced := false
		for i, e := range routines {
			if m, ok := e.(map[string]any); ok && m["id"] == rc.ID {
				routines[i] = obj
				replaced = true
				break
			}
		}
		if !replaced {
			routines = append(routines, obj)
		}
		st["routines"] = routines
		return json.Marshal(st)
	})
	if err != nil {
		return nil, http.StatusInternalServerError, "server error"
	}
	return map[string]any{"ok": true, "routine": obj}, 0, ""
}

// applyProgram batch-upserts routines and optionally sets the week schedule
// in one state write — the shape AI agents use to install a full program.
func (s *Server) applyProgram(uid string, routinesv, weekv any, replace bool) (map[string]any, int, string) {
	prepared, code, msg := prepareProgram(routinesv, weekv)
	if code != 0 {
		return nil, code, msg
	}

	err := s.mutateProgram(uid, prepared, replace)
	if err != nil {
		return nil, http.StatusInternalServerError, "server error"
	}
	out := map[string]any{"ok": true, "routines": prepared.cleaned}
	if prepared.hasWeek {
		out["week"] = prepared.week
	}
	return out, 0, ""
}

// preparedProgram is the sanitized representation used by the JSON HTTP API.
type preparedProgram struct {
	cleaned []map[string]any
	week    map[string]any
	hasWeek bool
}

func prepareProgram(routinesv, weekv any) (preparedProgram, int, string) {
	var prepared preparedProgram
	list, ok := routinesv.([]any)
	if !ok || len(list) == 0 {
		return prepared, http.StatusBadRequest, "routines array required"
	}
	if len(list) > 21 {
		return prepared, http.StatusBadRequest, "at most 21 routines"
	}

	cleaned := make([]map[string]any, 0, len(list))
	seen := map[string]bool{}
	for i, raw := range list {
		rc := sanitize.CleanRoutine(ensureRoutineID(raw))
		if rc == nil {
			return prepared, http.StatusBadRequest, "routine " + strconv.Itoa(i) + " needs a name (and a valid id)"
		}
		if seen[rc.ID] {
			return prepared, http.StatusBadRequest, "duplicate routine id " + rc.ID
		}
		seen[rc.ID] = true
		cleaned = append(cleaned, routineMap(rc))
	}

	var week map[string]any
	if weekv != nil {
		wk, ok := weekv.(map[string]any)
		if !ok {
			return prepared, http.StatusBadRequest, "week object required"
		}
		week = map[string]any{}
		for k, v := range wk {
			day, err := strconv.Atoi(k)
			if err != nil || day < 0 || day > 6 || strconv.Itoa(day) != k {
				return prepared, http.StatusBadRequest, "week keys must be 0–6 (0=Sun)"
			}
			if v == nil {
				continue
			}
			id, ok := v.(string)
			if !ok || jsLen(id) > 40 {
				return prepared, http.StatusBadRequest, "week values must be routine ids or null"
			}
			week[strconv.Itoa(day)] = id
		}
	}
	prepared.cleaned = cleaned
	prepared.week = week
	prepared.hasWeek = week != nil
	return prepared, 0, ""
}

// mutateProgram applies a prepared HTTP program atomically.
func (s *Server) mutateProgram(uid string, prepared preparedProgram, replace bool) error {
	return s.ST.MutateState(uid, func(raw jsontext.Value) (jsontext.Value, error) {
		st := stateMap(raw)
		applyPreparedProgram(st, prepared, replace)
		return json.Marshal(st)
	})
}

// applyPreparedProgram is intentionally side-effect free beyond st and uses
// the same replacement, reference-pruning, upsert, and ghost-week rules as
// the historical /api/routines implementation.
func applyPreparedProgram(st map[string]any, prepared preparedProgram, replace bool) {
	routines, _ := st["routines"].([]any)
	if replace {
		routines = []any{}
		// Drop week/dayPlan slots that pointed at the wiped routines.
		for _, section := range []string{"week", "dayPlan"} {
			m, _ := st[section].(map[string]any)
			for k, v := range m {
				if s, ok := v.(string); ok && s != "rest" {
					delete(m, k)
				}
			}
		}
	}
	for _, obj := range prepared.cleaned {
		id, _ := obj["id"].(string)
		replaced := false
		for i, e := range routines {
			if m, ok := e.(map[string]any); ok && m["id"] == id {
				routines[i] = obj
				replaced = true
				break
			}
		}
		if !replaced {
			routines = append(routines, obj)
		}
	}
	st["routines"] = routines

	if prepared.hasWeek {
		ids := map[string]bool{}
		for _, e := range routines {
			if m, ok := e.(map[string]any); ok {
				if id, ok := m["id"].(string); ok {
					ids[id] = true
				}
			}
		}
		for d, rid := range prepared.week {
			if id, ok := rid.(string); ok && !ids[id] {
				delete(prepared.week, d)
			}
		}
		st["week"] = prepared.week
	}
}

// ensureRoutineID fills a missing/empty id from the routine name so agents
// can send {name, ex} without inventing ids.
func ensureRoutineID(routine any) any {
	m, ok := routine.(map[string]any)
	if !ok {
		return routine
	}
	id := sanitize.JSString(m["id"])
	if id != "" {
		return m
	}
	name := jsTrim(sanitize.JSString(m["name"]))
	slug := nonWordRe.ReplaceAllString(strings.ToLower(name), "")
	if slug == "" {
		slug = "routine"
	}
	m["id"] = jsSlice(slug, 40)
	return m
}

var nonWordRe = regexp.MustCompile(`[^a-z0-9]+`)

// POST /api/routine/delete — removes the routine plus every week/dayPlan
// slot pointing at it.
func (s *Server) deleteRoutine(w http.ResponseWriter, r *http.Request) {
	u := s.requireAnyAuth(w, r)
	if u == nil {
		return
	}
	var body struct {
		ID any `json:"id"`
	}
	if !readJSON(w, r, &body) {
		return
	}
	payload, code, msg := s.applyRoutineDelete(u.ID, body.ID)
	writeResult(w, payload, code, msg)
}

// applyRoutineDelete is the mutation core of POST /api/routine/delete.
func (s *Server) applyRoutineDelete(uid string, idv any) (map[string]any, int, string) {
	id := sanitize.JSString(idv)
	err := s.ST.MutateState(uid, func(raw jsontext.Value) (jsontext.Value, error) {
		st := stateMap(raw)
		routines, _ := st["routines"].([]any)
		kept := routines[:0:0]
		for _, e := range routines {
			if m, ok := e.(map[string]any); ok && m["id"] == id {
				continue
			}
			kept = append(kept, e)
		}
		st["routines"] = kept
		for _, section := range []string{"week", "dayPlan"} {
			m, _ := st[section].(map[string]any)
			for k, v := range m {
				if s, ok := v.(string); ok && s == id {
					delete(m, k)
				}
			}
		}
		return json.Marshal(st)
	})
	if err != nil {
		return nil, http.StatusInternalServerError, "server error"
	}
	return map[string]any{"ok": true}, 0, ""
}

// POST /api/week — replace the whole day→routine-id schedule. Keys must be
// exactly "0".."6"; values are routine ids ≤40 chars or null (skipped).
// Ghost ids (no matching routine) never survive to storage.
func (s *Server) postWeek(w http.ResponseWriter, r *http.Request) {
	u := s.requireAnyAuth(w, r)
	if u == nil {
		return
	}
	var body struct {
		Week any `json:"week"`
	}
	if !readJSON(w, r, &body) {
		return
	}
	payload, code, msg := s.applyWeek(u.ID, body.Week)
	writeResult(w, payload, code, msg)
}

// applyWeek is the mutation core of POST /api/week.
func (s *Server) applyWeek(uid string, weekv any) (map[string]any, int, string) {
	wk, ok := weekv.(map[string]any)
	if !ok {
		return nil, http.StatusBadRequest, "week object required"
	}
	week := map[string]any{}
	for k, v := range wk {
		day, err := strconv.Atoi(k)
		if err != nil || day < 0 || day > 6 || strconv.Itoa(day) != k {
			return nil, http.StatusBadRequest, "week keys must be 0–6 (0=Sun)"
		}
		if v == nil {
			continue
		}
		id, ok := v.(string)
		if !ok || jsLen(id) > 40 {
			return nil, http.StatusBadRequest, "week values must be routine ids or null"
		}
		week[strconv.Itoa(day)] = id
	}
	err := s.ST.MutateState(uid, func(raw jsontext.Value) (jsontext.Value, error) {
		st := stateMap(raw)
		ids := map[string]bool{}
		routines, _ := st["routines"].([]any)
		for _, e := range routines {
			if m, ok := e.(map[string]any); ok {
				if id, ok := m["id"].(string); ok {
					ids[id] = true
				}
			}
		}
		for d, rid := range week { // never schedule a ghost routine
			if id, ok := rid.(string); ok && !ids[id] {
				delete(week, d)
			}
		}
		st["week"] = week
		return json.Marshal(st)
	})
	if err != nil {
		return nil, http.StatusInternalServerError, "server error"
	}
	return map[string]any{"ok": true}, 0, ""
}

// POST /api/dayplan — set/clear one calendar day's plan. The literal 'rest'
// sentinel is kept verbatim; null/"" clears the day.
func (s *Server) postDayPlan(w http.ResponseWriter, r *http.Request) {
	u := s.requireAnyAuth(w, r)
	if u == nil {
		return
	}
	var body struct {
		Iso  any `json:"iso"`
		Plan any `json:"plan"`
	}
	if !readJSON(w, r, &body) {
		return
	}
	payload, code, msg := s.applyDayPlan(u.ID, body.Iso, body.Plan)
	writeResult(w, payload, code, msg)
}

// applyDayPlan is the mutation core of POST /api/dayplan.
func (s *Server) applyDayPlan(uid string, isov, planv any) (map[string]any, int, string) {
	iso := sanitize.JSString(isov)
	if !isoDateRe.MatchString(iso) {
		return nil, http.StatusBadRequest, "iso date required (YYYY-MM-DD)"
	}
	var plan string // "" means clear, like upstream's null
	switch planv {
	case nil:
	case "rest":
		plan = "rest"
	default:
		plan = sanitize.JSString(planv)
	}
	if plan != "" && plan != "rest" && jsLen(plan) > 40 {
		return nil, http.StatusBadRequest, "bad plan value"
	}
	err := s.ST.MutateState(uid, func(raw jsontext.Value) (jsontext.Value, error) {
		st := stateMap(raw)
		dp, _ := st["dayPlan"].(map[string]any)
		if dp == nil {
			dp = map[string]any{}
		}
		if plan == "" {
			delete(dp, iso)
		} else {
			dp[iso] = plan
		}
		st["dayPlan"] = dp
		return json.Marshal(st)
	})
	if err != nil {
		return nil, http.StatusInternalServerError, "server error"
	}
	return map[string]any{"ok": true}, 0, ""
}

// POST /api/bodyweight — upsert one dated weight entry, keep the log sorted
// by date ascending. Omitted date defaults to today (UTC).
func (s *Server) postBodyweight(w http.ResponseWriter, r *http.Request) {
	u := s.requireAnyAuth(w, r)
	if u == nil {
		return
	}
	var body struct {
		D any `json:"d"`
		W any `json:"w"`
	}
	if !readJSON(w, r, &body) {
		return
	}
	payload, code, msg := s.applyBodyweight(u.ID, body.D, body.W)
	writeResult(w, payload, code, msg)
}

// applyBodyweight is the mutation core of POST /api/bodyweight.
func (s *Server) applyBodyweight(uid string, dv, wv any) (map[string]any, int, string) {
	var iso string
	switch d := dv.(type) {
	case nil, float64: // nil and 0 are falsy upstream → today
		if f, ok := d.(float64); ok && f != 0 {
			iso = sanitize.JSString(f)
		}
	case string:
		iso = d
	default:
		iso = sanitize.JSString(d)
	}
	if iso == "" {
		iso = time.Now().UTC().Format("2006-01-02")
	}
	if !isoDateRe.MatchString(iso) {
		return nil, http.StatusBadRequest, "bad date"
	}
	wt := sanitize.Num(wv, 20, 500)
	if wt == nil {
		return nil, http.StatusBadRequest, "weight must be 20–500"
	}
	err := s.ST.MutateState(uid, func(raw jsontext.Value) (jsontext.Value, error) {
		st := stateMap(raw)
		log, _ := st["bodyweight"].([]any)
		for _, e := range log {
			if m, ok := e.(map[string]any); ok && m["d"] == iso {
				m["w"] = *wt
				goto sorted
			}
		}
		log = append(log, map[string]any{"d": iso, "w": *wt, "t": time.Now().UnixMilli()})
	sorted:
		entryDate := func(v any) string {
			entry, _ := v.(map[string]any)
			date, _ := entry["d"].(string)
			return date
		}
		slices.SortStableFunc(log, func(a, b any) int {
			return cmp.Compare(entryDate(a), entryDate(b))
		})
		st["bodyweight"] = log
		return json.Marshal(st)
	})
	if err != nil {
		return nil, http.StatusInternalServerError, "server error"
	}
	return map[string]any{"ok": true, "date": iso}, 0, ""
}

var settingsAllowed = map[string]bool{
	"unit": true, "restSec": true, "sound": true, "keepAwake": true,
	"lang": true, "theme": true, "accent": true, "effort": true,
	"gifSize": true, "targetW": true,
}

// POST /api/settings — allow-listed settings patch merged into the top level
// of the state blob. Unknown keys are ignored; out-of-range numbers are
// dropped; strings cap at 24 UTF-16 units.
func (s *Server) postSettings(w http.ResponseWriter, r *http.Request) {
	u := s.requireAnyAuth(w, r)
	if u == nil {
		return
	}
	var body struct {
		Settings any `json:"settings"`
	}
	if !readJSON(w, r, &body) {
		return
	}
	payload, code, msg := s.applySettings(u.ID, body.Settings)
	writeResult(w, payload, code, msg)
}

// applySettings is the mutation core of POST /api/settings.
func (s *Server) applySettings(uid string, settings any) (map[string]any, int, string) {
	patch, ok := settings.(map[string]any)
	if !ok {
		return nil, http.StatusBadRequest, "settings object required"
	}
	clean := map[string]any{}
	keys := make([]string, 0, len(patch))
	for k := range patch {
		keys = append(keys, k)
	}
	slices.Sort(keys) // deterministic order; upstream uses client insertion order
	for _, k := range keys {
		if !settingsAllowed[k] {
			continue
		}
		v := patch[k]
		switch k {
		case "unit":
			if v == "kg" || v == "lb" {
				clean[k] = v
			}
		case "effort":
			if v == "none" || v == "rir" || v == "rpe" {
				clean[k] = v
			}
		case "restSec":
			if n := sanitize.Num(v, 5, 600); n != nil {
				clean[k] = *n
			}
		case "targetW":
			if n := sanitize.Num(v, 20, 500); n != nil {
				clean[k] = *n
			}
		case "sound", "keepAwake":
			if b, ok := v.(bool); ok {
				clean[k] = b
			}
		default: // lang / theme / accent / gifSize
			if str, ok := v.(string); ok {
				clean[k] = jsSlice(str, 24)
			}
		}
	}
	if len(clean) == 0 {
		return nil, http.StatusBadRequest, "no recognized settings in patch"
	}
	applied := make([]string, 0, len(clean))
	for k := range clean {
		applied = append(applied, k)
	}
	slices.Sort(applied)
	err := s.ST.MutateState(uid, func(raw jsontext.Value) (jsontext.Value, error) {
		st := stateMap(raw) // Object.assign(st, clean): merge at top level
		maps.Copy(st, clean)
		return json.Marshal(st)
	})
	if err != nil {
		return nil, http.StatusInternalServerError, "server error"
	}
	return map[string]any{"ok": true, "applied": applied}, 0, ""
}
