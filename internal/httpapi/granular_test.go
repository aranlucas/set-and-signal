package httpapi

import (
	"encoding/json/v2"
	"net/http"
	"strings"
	"testing"
	"time"

	"github.com/aranlucas/set-and-signal/internal/sanitize"
)

// post is a thin JSON POST helper for granular routes.
func (e *testEnv) post(path, body, authMode string) (*http.Response, map[string]any) {
	e.t.Helper()
	return e.do(http.MethodPost, path, body, authMode)
}

func wantOK(t *testing.T, resp *http.Response, body map[string]any) {
	t.Helper()
	if resp.StatusCode != 200 || body["ok"] != true {
		t.Fatalf("status = %d, body = %v", resp.StatusCode, body)
	}
}

// ---------- routine upsert ----------

func TestRoutineUpsertByID(t *testing.T) {
	e := newTestEnv(t)

	r1 := `{"routine":{"id":"push","name":"Push Day","emoji":"🏋️","ex":[
		{"id":"bench","sets":3,"reps":8,"weight":60},
		{"id":"row","sets":99,"reps":10}]}}` // sets 99 out of range → dropped
	resp, body := e.post("/api/routine", r1, "cookie")
	wantOK(t, resp, body)
	rt, _ := body["routine"].(map[string]any)
	if rt["id"] != "push" || rt["name"] != "Push Day" || rt["emoji"] != "🏋️" {
		t.Fatalf("routine echo = %v", body)
	}
	ex, _ := rt["ex"].([]any)
	if len(ex) != 2 {
		t.Fatalf("entries = %v", ex)
	}
	if _, kept := ex[1].(map[string]any)["sets"]; kept {
		t.Fatalf("out-of-range sets survived: %v", ex[1])
	}

	// Same id replaces, not appends.
	r2 := `{"routine":{"id":"push","name":"Heavy Push","ex":[{"id":"bench","sets":5,"reps":5}]}}`
	resp, body = e.post("/api/routine", r2, "cookie")
	wantOK(t, resp, body)

	st := e.getState("bearer") // granular reads work over bearer too
	routines, _ := st["routines"].([]any)
	if len(routines) != 1 {
		t.Fatalf("routines after upsert = %v", routines)
	}
	if routines[0].(map[string]any)["name"] != "Heavy Push" {
		t.Fatalf("upsert did not replace: %v", routines[0])
	}
	if _, present := st["_ts"]; !present {
		t.Fatalf("_ts not stamped: %v", st)
	}

	// Different id appends.
	e.post("/api/routine", `{"routine":{"id":"pull","name":"Pull Day"}}`, "cookie")
	st = e.getState("cookie")
	if routines, _ = st["routines"].([]any); len(routines) != 2 {
		t.Fatalf("append failed: %v", st["routines"])
	}
}

func TestRoutineValidation(t *testing.T) {
	e := newTestEnv(t)
	for _, tc := range []struct{ name, body string }{
		{"missing routine", `{}`},
		{"no name", `{"routine":{"id":"x"}}`},
		{"routine not an object", `{"routine":"push"}`},
	} {
		t.Run(tc.name, func(t *testing.T) {
			resp, body := e.post("/api/routine", tc.body, "cookie")
			if resp.StatusCode != 400 || errOf(body) != "routine needs at least an id and a name" {
				t.Fatalf("= %d %v", resp.StatusCode, body)
			}
		})
	}
	// Missing id is filled from the name (agent-friendly).
	resp, body := e.post("/api/routine", `{"routine":{"name":"Only Name"}}`, "cookie")
	wantOK(t, resp, body)
	r, _ := body["routine"].(map[string]any)
	if r["id"] != "onlyname" || r["name"] != "Only Name" {
		t.Fatalf("auto id = %v", r)
	}
}

// ---------- routine/delete prunes references ----------

func TestRoutineDeletePrunesWeekAndDayPlan(t *testing.T) {
	e := newTestEnv(t)
	seed := map[string]any{
		"routines": []any{
			map[string]any{"id": "gone", "name": "Gone", "emoji": "", "ex": []any{}},
			map[string]any{"id": "kept", "name": "Kept", "emoji": "", "ex": []any{}},
		},
		"week":    map[string]any{"1": "gone", "2": "kept", "3": "gone"},
		"dayPlan": map[string]any{"2026-08-24": "gone", "2026-08-25": "rest"},
	}
	raw, _ := json.Marshal(seed)
	if err := e.st.WriteState("u1", raw); err != nil {
		t.Fatal(err)
	}

	resp, body := e.post("/api/routine/delete", `{"id":"gone"}`, "cookie")
	wantOK(t, resp, body)

	st := e.getState("cookie")
	routines, _ := st["routines"].([]any)
	if len(routines) != 1 || routines[0].(map[string]any)["id"] != "kept" {
		t.Fatalf("routines = %v", st["routines"])
	}
	week, _ := st["week"].(map[string]any)
	if len(week) != 1 || week["2"] != "kept" {
		t.Fatalf("week = %v", week)
	}
	dp, _ := st["dayPlan"].(map[string]any)
	if len(dp) != 1 || dp["2026-08-25"] != "rest" {
		t.Fatalf("dayPlan = %v", dp)
	}
}

// ---------- week ----------

func TestWeekReplacesAndPrunesGhosts(t *testing.T) {
	e := newTestEnv(t)
	// A new account has no routines key yet. Updating its week must initialize
	// the schedule instead of panicking on a missing []any assertion.
	resp, body := e.post("/api/week", `{"week":{}}`, "cookie")
	wantOK(t, resp, body)

	e.post("/api/routine", `{"routine":{"id":"legs","name":"Legs"}}`, "cookie")

	resp, body = e.post("/api/week", `{"week":{"0":"legs","2":null,"4":"ghost"}}`, "cookie")
	wantOK(t, resp, body)

	st := e.getState("cookie")
	week, _ := st["week"].(map[string]any)
	if len(week) != 1 || week["0"] != "legs" {
		t.Fatalf("week = %v (want only the real routine; null skipped, ghost pruned)", week)
	}

	// A later full replacement drops stale entries too.
	resp, body = e.post("/api/week", `{"week":{"1":"legs","5":"vanishing"}}`, "cookie")
	wantOK(t, resp, body)
	week, _ = e.getState("cookie")["week"].(map[string]any)
	if len(week) != 1 || week["1"] != "legs" {
		t.Fatalf("week after replace = %v", week)
	}
}

func TestWeekValidation(t *testing.T) {
	e := newTestEnv(t)
	cases := []struct{ name, body, wantErr string }{
		{"missing week", `{}`, "week object required"},
		{"array week", `{"week":[]}`, "week object required"},
		{"key 7", `{"week":{"7":"a"}}`, "week keys must be 0–6 (0=Sun)"},
		{"key 01", `{"week":{"01":"a"}}`, "week keys must be 0–6 (0=Sun)"},
		{"key -1", `{"week":{"-1":"a"}}`, "week keys must be 0–6 (0=Sun)"},
		{"non-numeric key", `{"week":{"mon":"a"}}`, "week keys must be 0–6 (0=Sun)"},
		{"numeric value", `{"week":{"1":42}}`, "week values must be routine ids or null"},
		{"overlong value", `{"week":{"1":"` + strings.Repeat("x", 41) + `"}}`, "week values must be routine ids or null"},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			resp, body := e.post("/api/week", tc.body, "cookie")
			if resp.StatusCode != 400 || errOf(body) != tc.wantErr {
				t.Fatalf("= %d %v, want %q", resp.StatusCode, body, tc.wantErr)
			}
		})
	}
}

// ---------- dayplan ----------

func TestDayPlanRestSentinelAndClearing(t *testing.T) {
	e := newTestEnv(t)

	resp, body := e.post("/api/dayplan", `{"iso":"2026-08-24","plan":"rest"}`, "cookie")
	wantOK(t, resp, body)
	dp, _ := e.getState("cookie")["dayPlan"].(map[string]any)
	if dp["2026-08-24"] != "rest" {
		t.Fatalf("rest sentinel lost: %v", dp)
	}

	// Coercible values stringify like JS String().
	e.post("/api/dayplan", `{"iso":"2026-08-25","plan":5}`, "cookie")
	dp, _ = e.getState("cookie")["dayPlan"].(map[string]any)
	if dp["2026-08-25"] != "5" {
		t.Fatalf("numeric plan not stringified: %v", dp)
	}

	// Empty-string plan clears the day.
	e.post("/api/dayplan", `{"iso":"2026-08-25","plan":""}`, "cookie")
	dp, _ = e.getState("cookie")["dayPlan"].(map[string]any)
	if _, present := dp["2026-08-25"]; present {
		t.Fatalf("empty plan did not clear day: %v", dp)
	}
	// Explicit null clears too.
	e.post("/api/dayplan", `{"iso":"2026-08-24","plan":null}`, "cookie")
	dp, _ = e.getState("cookie")["dayPlan"].(map[string]any)
	if len(dp) != 0 {
		t.Fatalf("null plan did not clear day: %v", dp)
	}
}

func TestDayPlanValidation(t *testing.T) {
	e := newTestEnv(t)
	cases := []struct{ name, body, wantErr string }{
		{"bad iso", `{"iso":"24-08-2026"}`, "iso date required (YYYY-MM-DD)"},
		{"missing iso", `{"plan":"rest"}`, "iso date required (YYYY-MM-DD)"},
		{"overlong plan", `{"iso":"2026-08-24","plan":"` + strings.Repeat("p", 41) + `"}`, "bad plan value"},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			resp, body := e.post("/api/dayplan", tc.body, "cookie")
			if resp.StatusCode != 400 || errOf(body) != tc.wantErr {
				t.Fatalf("= %d %v, want %q", resp.StatusCode, body, tc.wantErr)
			}
		})
	}
	// Exactly 40 chars passes.
	resp, body := e.post("/api/dayplan", `{"iso":"2026-08-24","plan":"`+strings.Repeat("p", 40)+`"}`, "cookie")
	wantOK(t, resp, body)
}

// ---------- bodyweight ----------

func TestBodyweightUpsertSortsByDate(t *testing.T) {
	e := newTestEnv(t)

	resp, body := e.post("/api/bodyweight", `{"d":"2026-08-20","w":80.456}`, "cookie")
	wantOK(t, resp, body)
	if body["date"] != "2026-08-20" {
		t.Fatalf("date = %v", body)
	}
	e.post("/api/bodyweight", `{"d":"2026-08-18","w":80.2}`, "cookie")
	e.post("/api/bodyweight", `{"d":"2026-08-20","w":80.5}`, "cookie") // update in place

	log, _ := e.getState("bearer")["bodyweight"].([]any)
	if len(log) != 2 {
		t.Fatalf("log = %v (want 2 entries)", log)
	}
	first, _ := log[0].(map[string]any)
	last, _ := log[1].(map[string]any)
	if first["d"] != "2026-08-18" || last["d"] != "2026-08-20" {
		t.Fatalf("not sorted ascending: %v", log)
	}
	if last["w"] != 80.5 { // rounded to 2 decimals by sanitize.Num
		t.Fatalf("update not applied: %v", last)
	}
	if _, hasT := first["t"]; !hasT {
		t.Fatalf("timestamp missing on fresh entry: %v", first)
	}
}

func TestBodyweightDefaultsToTodayAndValidates(t *testing.T) {
	e := newTestEnv(t)

	today := time.Now().UTC().Format("2006-01-02")
	resp, body := e.post("/api/bodyweight", `{"w":75}`, "cookie")
	wantOK(t, resp, body)
	if body["date"] != today {
		t.Fatalf("default date = %v, want %s", body["date"], today)
	}

	for _, tc := range []struct{ name, body, wantErr string }{
		{"too light", `{"d":"2026-08-20","w":19.9}`, "weight must be 20–500"},
		{"too heavy", `{"d":"2026-08-20","w":500.1}`, "weight must be 20–500"},
		{"non numeric", `{"d":"2026-08-20","w":"heavy"}`, "weight must be 20–500"},
		{"bad date", `{"d":"tomorrow","w":80}`, "bad date"},
	} {
		t.Run(tc.name, func(t *testing.T) {
			resp, body := e.post("/api/bodyweight", tc.body, "cookie")
			if resp.StatusCode != 400 || errOf(body) != tc.wantErr {
				t.Fatalf("= %d %v, want %q", resp.StatusCode, body, tc.wantErr)
			}
		})
	}
}

// JS String(20250823) is "20250823" (exponential notation only at ≥1e21), so
// the coercion of a numeric d must be JS-faithful. Upstream then applies
// /^\d{4}-\d{2}-\d{2}$/ to the coerced string (server.js ~line 626), so a
// plain number is still a "bad date" — parity means rejecting it identically,
// not accepting it.
func TestBodyweightNumericDateMatchesUpstream(t *testing.T) {
	e := newTestEnv(t)

	// The coercion itself is now digit-exact (was "2.0250823e+07").
	if got := sanitize.JSString(20250823.0); got != "20250823" {
		t.Fatalf("JSString(20250823) = %q", got)
	}
	// ...and the route outcome matches upstream byte-for-byte.
	resp, body := e.post("/api/bodyweight", `{"d":20250823,"w":80}`, "cookie")
	if resp.StatusCode != 400 || errOf(body) != "bad date" {
		t.Fatalf("numeric d = %d %v, want 400 bad date (upstream parity)", resp.StatusCode, body)
	}
}

// ---------- settings ----------

func TestSettingsAllowListAndClamps(t *testing.T) {
	e := newTestEnv(t)

	patch := `{"settings":{
		"unit":"lb",
		"effort":"rir",
		"restSec":300.456,
		"targetW":82,
		"keepAwake":false,
		"lang":"en",
		"theme":"` + strings.Repeat("t", 30) + `",
		"hacker":"evil"
	}}`
	_, b := e.post("/api/settings", patch, "cookie")

	applied, _ := b["applied"].([]any)
	got := map[string]bool{}
	for _, k := range applied {
		got[k.(string)] = true
	}
	for _, want := range []string{"unit", "effort", "restSec", "targetW", "keepAwake", "lang", "theme"} {
		if !got[want] {
			t.Fatalf("applied missing %q: %v", want, applied)
		}
	}
	if got["hacker"] {
		t.Fatalf("unknown key applied: %v", applied)
	}

	st := e.getState("cookie")
	if st["unit"] != "lb" || st["effort"] != "rir" {
		t.Fatalf("enum settings = %v", st)
	}
	if st["restSec"] != 300.46 { // num() rounds half toward +∞ at 2 decimals
		t.Fatalf("restSec = %v, want 300.46", st["restSec"])
	}
	if st["targetW"] != float64(82) {
		t.Fatalf("targetW = %v", st["targetW"])
	}
	if st["theme"] != strings.Repeat("t", 24) {
		t.Fatalf("theme not sliced to 24: %v", st["theme"])
	}

	// Out-of-range numbers are dropped, not clamped.
	e.post("/api/settings", `{"settings":{"restSec":601,"targetW":19}}`, "cookie")
	st = e.getState("cookie")
	if st["restSec"] != 300.46 || st["targetW"] != float64(82) {
		t.Fatalf("out-of-range settings were applied: %v", st)
	}

	// Wrong-typed booleans are dropped; correct ones apply.
	e.post("/api/settings", `{"settings":{"sound":"yes"}}`, "cookie")
	if _, present := e.getState("cookie")["sound"]; present {
		t.Fatalf("string sound applied: %v", e.getState("cookie"))
	}
	resp, b := e.post("/api/settings", `{"settings":{"keepAwake":true}}`, "cookie")
	wantOK(t, resp, b)
	if e.getState("cookie")["keepAwake"] != true {
		t.Fatalf("boolean keepAwake not applied: %v", e.getState("cookie"))
	}
}

func TestSettingsErrors(t *testing.T) {
	e := newTestEnv(t)
	resp, body := e.post("/api/settings", `{}`, "cookie")
	if resp.StatusCode != 400 || errOf(body) != "settings object required" {
		t.Fatalf("missing settings = %d %v", resp.StatusCode, body)
	}
	resp, body = e.post("/api/settings", `{"settings":[]}`, "cookie")
	if resp.StatusCode != 400 || errOf(body) != "settings object required" {
		t.Fatalf("array settings = %d %v", resp.StatusCode, body)
	}
	resp, body = e.post("/api/settings", `{"settings":{"bogus":1,"nope":true}}`, "cookie")
	if resp.StatusCode != 400 || errOf(body) != "no recognized settings in patch" {
		t.Fatalf("unrecognized patch = %d %v", resp.StatusCode, body)
	}
}

// ---------- bearer parity across every granular route ----------

func TestGranularRoutesAcceptBearer(t *testing.T) {
	e := newTestEnv(t)

	resp, body := e.post("/api/routine", `{"routine":{"id":"full","name":"Full"}}`, "bearer")
	wantOK(t, resp, body)
	for _, tc := range []struct{ name, path, body string }{
		{"routine/delete", "/api/routine/delete", `{"id":"full"}`},
		{"week", "/api/week", `{"week":{"1":"x"}}`},
		{"dayplan", "/api/dayplan", `{"iso":"2026-08-24","plan":"rest"}`},
		{"bodyweight", "/api/bodyweight", `{"w":90}`},
		{"settings", "/api/settings", `{"settings":{"unit":"kg"}}`},
	} {
		t.Run(tc.name, func(t *testing.T) {
			resp, body := e.post(tc.path, tc.body, "bearer")
			wantOK(t, resp, body)
		})
	}

	// And a bad bearer gets the same 401 as upstream's auth().
	req, _ := http.NewRequest("POST", e.url+"/api/routine", strings.NewReader(`{}`))
	req.Header.Set("Authorization", "Bearer not-a-token")
	r, err := e.client.Do(req)
	if err != nil {
		t.Fatal(err)
	}
	defer func() { _ = r.Body.Close() }()
	var m map[string]any
	_ = json.UnmarshalRead(r.Body, &m)
	if r.StatusCode != 401 || errOf(m) != "not signed in" {
		t.Fatalf("bad bearer = %d %v", r.StatusCode, m)
	}
}

func TestSetProgramBatch(t *testing.T) {
	e := newTestEnv(t)

	resp, body := e.post("/api/routines", `{
		"replace": true,
		"routines": [
			{"name": "Push A", "ex": [{"id": "bench", "sets": 3, "reps": 5}]},
			{"id": "pull", "name": "Pull", "ex": [{"id": "row", "sets": 3, "reps": 8}]}
		],
		"week": {"1": "pusha", "3": "pull", "5": "missing"}
	}`, "cookie")
	wantOK(t, resp, body)

	routines, _ := body["routines"].([]any)
	if len(routines) != 2 {
		t.Fatalf("routines = %v", body["routines"])
	}
	first, _ := routines[0].(map[string]any)
	if first["id"] != "pusha" || first["name"] != "Push A" {
		t.Fatalf("auto id from name = %v", first)
	}
	week, _ := body["week"].(map[string]any)
	if week["1"] != "pusha" || week["3"] != "pull" {
		t.Fatalf("week = %v", week)
	}
	if _, ghost := week["5"]; ghost {
		t.Fatalf("ghost week slot survived: %v", week)
	}

	st := e.getState("cookie")
	stored, _ := st["routines"].([]any)
	if len(stored) != 2 {
		t.Fatalf("stored routines = %v", stored)
	}
	storedWeek, _ := st["week"].(map[string]any)
	if storedWeek["1"] != "pusha" {
		t.Fatalf("stored week = %v", storedWeek)
	}

	// Merge without replace keeps prior routines.
	resp, body = e.post("/api/routines", `{
		"routines": [{"id": "legs", "name": "Legs", "ex": []}]
	}`, "cookie")
	wantOK(t, resp, body)
	st = e.getState("cookie")
	if len(st["routines"].([]any)) != 3 {
		t.Fatalf("after merge = %v", st["routines"])
	}
}
