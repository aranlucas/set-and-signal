package training

import (
	"encoding/json/jsontext"
	"encoding/json/v2"
	"fmt"
	"slices"
	"strings"
)

// MCPDaySession is one planned workout on a calendar day or weekday slot.
type MCPDaySession struct {
	RoutineID string  `json:"routineId" jsonschema:"routine id for this session"`
	Start     *string `json:"start,omitempty" jsonschema:"optional local start time HH:MM"`
	Label     *string `json:"label,omitempty" jsonschema:"optional coach-facing label"`
}

// MCPDayPlan is a one-off override for an ISO calendar date.
// Rest=true means skip training; otherwise Sessions is the ordered plan for that day
// (including an empty list, which clears the weekly template for that date).
type MCPDayPlan struct {
	Rest     bool            `json:"rest,omitzero" jsonschema:"when true, the date is a rest day"`
	Sessions []MCPDaySession `json:"sessions,omitempty" jsonschema:"ordered sessions when not a rest day"`
}

func cloneDaySessions(sessions []MCPDaySession) []MCPDaySession {
	if sessions == nil {
		return nil
	}
	out := make([]MCPDaySession, len(sessions))
	for i, session := range sessions {
		out[i] = MCPDaySession{RoutineID: session.RoutineID}
		if session.Start != nil {
			out[i].Start = new(*session.Start)
		}
		if session.Label != nil {
			out[i].Label = new(*session.Label)
		}
	}
	return out
}

func cloneWeekSchedule(week map[string][]MCPDaySession) map[string][]MCPDaySession {
	if week == nil {
		return nil
	}
	out := make(map[string][]MCPDaySession, len(week))
	for day, sessions := range week {
		out[day] = cloneDaySessions(sessions)
	}
	return out
}

func cloneDayPlan(plan map[string]MCPDayPlan) map[string]MCPDayPlan {
	if plan == nil {
		return nil
	}
	out := make(map[string]MCPDayPlan, len(plan))
	for day, entry := range plan {
		out[day] = MCPDayPlan{Rest: entry.Rest, Sessions: cloneDaySessions(entry.Sessions)}
	}
	return out
}

func daySessionsEqual(a, b []MCPDaySession) bool {
	if len(a) != len(b) {
		return false
	}
	for i := range a {
		if a[i].RoutineID != b[i].RoutineID {
			return false
		}
		if stringPtrValue(a[i].Start) != stringPtrValue(b[i].Start) {
			return false
		}
		if stringPtrValue(a[i].Label) != stringPtrValue(b[i].Label) {
			return false
		}
	}
	return true
}

func stringPtrValue(value *string) string {
	if value == nil {
		return ""
	}
	return *value
}

func weekSlotSessions(week map[string][]MCPDaySession, weekday string) []MCPDaySession {
	if week == nil {
		return nil
	}
	return cloneDaySessions(week[weekday])
}

// resolveDaySessions returns the ordered sessions for iso, whether an override
// applied, and whether the day is explicitly rest.
func resolveDaySessions(view TrainingData, iso string) (sessions []MCPDaySession, override, rest bool) {
	weekday := weekdayKey(iso)
	weekSlots := weekSlotSessions(view.Week, weekday)
	if entry, ok := view.DayPlan[iso]; ok {
		override = true
		if entry.Rest {
			return nil, true, true
		}
		resolved := make([]MCPDaySession, 0, len(entry.Sessions))
		for _, session := range entry.Sessions {
			if _, found := findRoutineByID(view.Routines, session.RoutineID); found {
				resolved = append(resolved, session)
			}
		}
		// Invalid override ids are dropped; if nothing remains and the override
		// listed sessions, fall back to the weekly template (same spirit as the
		// old single-id ghost override behavior).
		if len(resolved) == 0 && len(entry.Sessions) > 0 {
			return weekSlots, true, false
		}
		return cloneDaySessions(resolved), true, false
	}
	resolved := make([]MCPDaySession, 0, len(weekSlots))
	for _, session := range weekSlots {
		if _, found := findRoutineByID(view.Routines, session.RoutineID); found {
			resolved = append(resolved, session)
		}
	}
	return resolved, false, false
}

func sessionFromRoutineID(routineID string) MCPDaySession {
	return MCPDaySession{RoutineID: strings.TrimSpace(routineID)}
}

func normalizeDaySession(session MCPDaySession) (MCPDaySession, error) {
	session.RoutineID = strings.TrimSpace(session.RoutineID)
	if session.RoutineID == "" || jsSlice(session.RoutineID, 40) != session.RoutineID {
		return MCPDaySession{}, fmt.Errorf("session routineId must be a non-empty id up to 40 characters")
	}
	if session.Start != nil {
		start := strings.TrimSpace(*session.Start)
		if start == "" {
			session.Start = nil
		} else if !looksLikeHHMM(start) {
			return MCPDaySession{}, fmt.Errorf("session start must be HH:MM")
		} else {
			session.Start = &start
		}
	}
	if session.Label != nil {
		label := jsSlice(strings.TrimSpace(*session.Label), 80)
		if label == "" {
			session.Label = nil
		} else {
			session.Label = &label
		}
	}
	return session, nil
}

func looksLikeHHMM(value string) bool {
	if len(value) != 5 || value[2] != ':' {
		return false
	}
	h1, h2, m1, m2 := value[0], value[1], value[3], value[4]
	if h1 < '0' || h1 > '9' || h2 < '0' || h2 > '9' || m1 < '0' || m1 > '9' || m2 < '0' || m2 > '9' {
		return false
	}
	hour := int(h1-'0')*10 + int(h2-'0')
	minute := int(m1-'0')*10 + int(m2-'0')
	return hour <= 23 && minute <= 59
}

// migrateScheduleFields rewrites legacy single-id week/dayPlan values into the
// sessions-array shape so existing profiles are not wiped on load.
func migrateScheduleFields(raw jsontext.Value) (jsontext.Value, error) {
	if len(raw) == 0 || string(raw) == "null" {
		return raw, nil
	}
	var doc map[string]jsontext.Value
	if err := json.Unmarshal(raw, &doc); err != nil {
		return nil, err
	}
	if weekRaw, ok := doc["week"]; ok {
		migrated, changed, err := migrateWeekValue(weekRaw)
		if err != nil {
			return nil, err
		}
		if changed {
			doc["week"] = migrated
		}
	}
	if planRaw, ok := doc["dayPlan"]; ok {
		migrated, changed, err := migrateDayPlanValue(planRaw)
		if err != nil {
			return nil, err
		}
		if changed {
			doc["dayPlan"] = migrated
		}
	}
	return json.Marshal(doc)
}

func migrateWeekValue(raw jsontext.Value) (jsontext.Value, bool, error) {
	var week map[string]jsontext.Value
	if err := json.Unmarshal(raw, &week); err != nil {
		return nil, false, nil // leave non-objects alone; typed decode will fail
	}
	out := make(map[string][]MCPDaySession, len(week))
	changed := false
	for day, value := range week {
		sessions, migrated, err := decodeFlexibleSessions(value)
		if err != nil {
			return nil, false, fmt.Errorf("week[%s]: %w", day, err)
		}
		if migrated {
			changed = true
		}
		if sessions != nil {
			out[day] = sessions
		}
	}
	if !changed {
		return raw, false, nil
	}
	encoded, err := json.Marshal(out)
	return encoded, true, err
}

func migrateDayPlanValue(raw jsontext.Value) (jsontext.Value, bool, error) {
	var plan map[string]jsontext.Value
	if err := json.Unmarshal(raw, &plan); err != nil {
		return nil, false, nil
	}
	out := make(map[string]MCPDayPlan, len(plan))
	changed := false
	for day, value := range plan {
		entry, migrated, err := decodeFlexibleDayPlan(value)
		if err != nil {
			return nil, false, fmt.Errorf("dayPlan[%s]: %w", day, err)
		}
		if migrated {
			changed = true
		}
		out[day] = entry
	}
	if !changed {
		return raw, false, nil
	}
	encoded, err := json.Marshal(out)
	return encoded, true, err
}

func decodeFlexibleSessions(raw jsontext.Value) ([]MCPDaySession, bool, error) {
	if len(raw) == 0 || string(raw) == "null" {
		return nil, false, nil
	}
	var sessions []MCPDaySession
	if err := json.Unmarshal(raw, &sessions); err == nil {
		return sessions, false, nil
	}
	var ids []string
	if err := json.Unmarshal(raw, &ids); err == nil {
		out := make([]MCPDaySession, 0, len(ids))
		for _, id := range ids {
			if strings.TrimSpace(id) == "" {
				continue
			}
			out = append(out, sessionFromRoutineID(id))
		}
		return out, true, nil
	}
	var id string
	if err := json.Unmarshal(raw, &id); err == nil {
		if strings.TrimSpace(id) == "" {
			return nil, true, nil
		}
		return []MCPDaySession{sessionFromRoutineID(id)}, true, nil
	}
	return nil, false, fmt.Errorf("expected sessions array")
}

func decodeFlexibleDayPlan(raw jsontext.Value) (MCPDayPlan, bool, error) {
	if len(raw) == 0 || string(raw) == "null" {
		return MCPDayPlan{}, false, nil
	}
	var entry MCPDayPlan
	if err := json.Unmarshal(raw, &entry); err == nil {
		// Distinguishing a real object from other shapes: require rest or sessions key.
		var probe map[string]jsontext.Value
		if err := json.Unmarshal(raw, &probe); err == nil {
			if _, hasRest := probe["rest"]; hasRest {
				return entry, false, nil
			}
			if _, hasSessions := probe["sessions"]; hasSessions {
				return entry, false, nil
			}
		}
	}
	var id string
	if err := json.Unmarshal(raw, &id); err == nil {
		if id == "rest" {
			return MCPDayPlan{Rest: true}, true, nil
		}
		if strings.TrimSpace(id) == "" {
			return MCPDayPlan{}, true, nil
		}
		return MCPDayPlan{Sessions: []MCPDaySession{sessionFromRoutineID(id)}}, true, nil
	}
	sessions, migrated, err := decodeFlexibleSessions(raw)
	if err != nil {
		return MCPDayPlan{}, false, err
	}
	return MCPDayPlan{Sessions: sessions}, migrated || true, nil
}

func materializeDayPlan(view TrainingData, iso string) MCPDayPlan {
	sessions, _, rest := resolveDaySessions(view, iso)
	if rest {
		return MCPDayPlan{Rest: true}
	}
	return MCPDayPlan{Sessions: cloneDaySessions(sessions)}
}

func addSessionToDayPlan(data *TrainingData, iso string, session MCPDaySession) error {
	normalized, err := normalizeDaySession(session)
	if err != nil {
		return err
	}
	if _, found := findRoutineByID(data.Routines, normalized.RoutineID); !found {
		return fmt.Errorf("unknown routineId %q", normalized.RoutineID)
	}
	entry := materializeDayPlan(*data, iso)
	if entry.Rest {
		entry.Rest = false
		entry.Sessions = nil
	}
	entry.Sessions = append(entry.Sessions, normalized)
	if data.DayPlan == nil {
		data.DayPlan = map[string]MCPDayPlan{}
	}
	data.DayPlan[iso] = entry
	return nil
}

func removeSessionFromDayPlan(data *TrainingData, iso, routineID string, index *int) error {
	routineID = strings.TrimSpace(routineID)
	if routineID == "" {
		return fmt.Errorf("routineId must not be empty")
	}
	entry := materializeDayPlan(*data, iso)
	if entry.Rest || len(entry.Sessions) == 0 {
		return fmt.Errorf("no sessions planned on %s", iso)
	}
	removeAt := -1
	if index != nil {
		if *index < 0 || *index >= len(entry.Sessions) {
			return fmt.Errorf("index out of range")
		}
		if entry.Sessions[*index].RoutineID != routineID {
			return fmt.Errorf("session at index %d is not routineId %q", *index, routineID)
		}
		removeAt = *index
	} else {
		for i, session := range entry.Sessions {
			if session.RoutineID == routineID {
				removeAt = i
				break
			}
		}
		if removeAt < 0 {
			return fmt.Errorf("routineId %q is not planned on %s", routineID, iso)
		}
	}
	entry.Sessions = slices.Delete(entry.Sessions, removeAt, removeAt+1)
	if data.DayPlan == nil {
		data.DayPlan = map[string]MCPDayPlan{}
	}
	data.DayPlan[iso] = entry
	return nil
}
