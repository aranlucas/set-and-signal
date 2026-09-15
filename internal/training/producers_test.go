package training

import (
	"encoding/json/jsontext"
	"encoding/json/v2"
	"reflect"
	"testing"

	"github.com/aranlucas/set-and-signal/internal/exercises"
)

func floatPtr(value float64) *float64 { return new(value) }

func TestResolveTodayTypedHonorsOverrideAndWeeklyFallback(t *testing.T) {
	view := TrainingData{
		Routines: []MCPRoutine{
			{ID: "push", Name: "Push"},
			{ID: "pull", Name: "Pull"},
		},
		Week:    map[string][]MCPDaySession{"3": {{RoutineID: "push"}}},
		DayPlan: map[string]MCPDayPlan{"2026-08-26": {Rest: true}},
	}

	got := trainingDay(view, "2026-08-26")
	if !got.Rest || !got.Override || len(got.Sessions) != 0 {
		t.Fatalf("rest override = %#v", got)
	}

	view.DayPlan["2026-08-26"] = MCPDayPlan{Sessions: []MCPDaySession{{RoutineID: "missing"}}}
	got = trainingDay(view, "2026-08-26")
	if got.Rest || !got.Override || len(got.Sessions) != 1 || got.Sessions[0].RoutineID != "push" {
		t.Fatalf("invalid override should fall back to week = %#v", got)
	}
	if len(got.WeekSlots) != 1 || got.WeekSlots[0].RoutineID != "push" {
		t.Fatalf("week slots = %#v", got.WeekSlots)
	}
}

func TestTrainingDayReturnsMultipleSessions(t *testing.T) {
	start := "18:00"
	view := TrainingData{
		Routines: []MCPRoutine{
			{ID: "hip-rehab", Name: "Hip flexor rehab", Ex: []MCPExConfig{{ID: "stretch", Sets: floatPtr(2)}}},
			{ID: "fleet-feet-easy", Name: "Fleet Feet easy 3mi", Ex: []MCPExConfig{{ID: "run", Sets: floatPtr(1), Min: floatPtr(32)}}},
		},
		Week: map[string][]MCPDaySession{
			"2": {
				{RoutineID: "hip-rehab"},
				{RoutineID: "fleet-feet-easy", Start: &start, Label: stringPtr("6pm")},
			},
			"4": {{RoutineID: "hip-rehab"}},
		},
	}

	// 2026-09-15 is a Tuesday.
	tue := trainingDay(view, "2026-09-15")
	if tue.Rest || len(tue.Sessions) != 2 {
		t.Fatalf("tuesday = %#v", tue)
	}
	if tue.Sessions[0].RoutineID != "hip-rehab" || tue.Sessions[0].Routine == nil || tue.Sessions[0].Routine.Name != "Hip flexor rehab" {
		t.Fatalf("first session = %#v", tue.Sessions[0])
	}
	if tue.Sessions[1].RoutineID != "fleet-feet-easy" || tue.Sessions[1].Start == nil || *tue.Sessions[1].Start != "18:00" {
		t.Fatalf("second session = %#v", tue.Sessions[1])
	}

	thu := trainingDay(view, "2026-09-17")
	if thu.Rest || len(thu.Sessions) != 1 || thu.Sessions[0].RoutineID != "hip-rehab" {
		t.Fatalf("thursday = %#v", thu)
	}
}

func TestBuildTrainingDigestKeepsSessionBoundaries(t *testing.T) {
	view := TrainingData{
		Unit: "lb",
		Routines: []MCPRoutine{
			{ID: "hip-rehab", Name: "Hip flexor rehab", Ex: []MCPExConfig{{ID: "stretch", Sets: floatPtr(2)}}},
			{ID: "fleet-feet-easy", Name: "Fleet Feet easy 3mi", Ex: []MCPExConfig{{ID: "run", Sets: floatPtr(1)}}},
		},
	}
	got := buildTrainingDigest(view, []MCPDaySession{
		{RoutineID: "hip-rehab"},
		{RoutineID: "fleet-feet-easy"},
	}, "2026-09-15")
	if len(got.Sessions) != 2 {
		t.Fatalf("digest sessions = %#v", got.Sessions)
	}
	if got.Sessions[0].Name != "Hip flexor rehab" || len(got.Sessions[0].Entries) != 1 || got.Sessions[0].Entries[0].ID != "stretch" {
		t.Fatalf("rehab digest = %#v", got.Sessions[0])
	}
	if got.Sessions[1].Name != "Fleet Feet easy 3mi" || got.Sessions[1].Entries[0].ID != "run" {
		t.Fatalf("run digest = %#v", got.Sessions[1])
	}
}

func TestBuildTrainingDigestTypedUsesClosedState(t *testing.T) {
	view := TrainingData{
		Unit:       "lb",
		TargetW:    floatPtr(180),
		Bodyweight: []MCPBodyweightEntry{{D: "2026-08-20", W: 181}},
		CustomEx:   []MCPCustomExercise{{ID: "custom-row", N: "Cable Press"}},
		ExWeights:  map[string]MCPExWeightHint{"custom-row": {W: 75, D: "2026-08-20"}},
		Routines:   []MCPRoutine{{ID: "push", Name: "Push"}},
		Workouts: []MCPWorkout{
			{
				D: "2026-08-22", Name: "Push", BW: floatPtr(181),
				Entries: []MCPWorkoutEntry{
					{
						ID: "custom-row", Target: &MCPExConfig{ID: "custom-row", Sets: floatPtr(3)},
						Sets: []MCPLoggedSet{
							{Done: true, W: floatPtr(75), R: floatPtr(8)},
							{Done: false, W: floatPtr(80), R: floatPtr(6)},
							{Done: true, Sec: floatPtr(30), W: floatPtr(10)},
						},
					},
				},
			},
		},
	}
	config := MCPExConfig{ID: "custom-row", Sets: floatPtr(3), Reps: floatPtr(8), Weight: floatPtr(75)}
	routine := MCPRoutine{ID: "push", Name: "Push", Ex: []MCPExConfig{config}}
	view.Routines = []MCPRoutine{routine}

	got := buildTrainingDigest(view, []MCPDaySession{{RoutineID: "push"}}, "2026-08-23")
	if got.Unit != "lb" || got.Today != "2026-08-23" || got.BodyweightGoal == nil || *got.BodyweightGoal != 180 {
		t.Fatalf("digest metadata = %#v", got)
	}
	if len(got.Sessions) != 1 || len(got.Sessions[0].Entries) != 1 || got.Sessions[0].Entries[0].Name != "Cable Press" {
		t.Fatalf("routine entries = %#v", got.Sessions)
	}
	if got.Sessions[0].Entries[0].LastWeight == nil || *got.Sessions[0].Entries[0].LastWeight != 75 {
		t.Fatalf("last weight = %#v", got.Sessions[0].Entries[0].LastWeight)
	}
	if len(got.LastWorkouts) != 1 || len(got.LastWorkouts[0].Entries) != 1 {
		t.Fatalf("workout entries = %#v", got.LastWorkouts)
	}
	sets := got.LastWorkouts[0].Entries[0].Sets
	if !reflect.DeepEqual(sets, []string{"75×8", "10lb×30s"}) {
		t.Fatalf("digest sets = %#v", sets)
	}
}

func TestBuildHistoryTypedFiltersNewestFirst(t *testing.T) {
	view := TrainingData{
		Unit:     "kg",
		CustomEx: []MCPCustomExercise{{ID: "custom-row", N: "Cable Press"}},
		Workouts: []MCPWorkout{
			{ID: "w1", D: "2026-08-10", Name: "A", Vol: 100, Entries: []MCPWorkoutEntry{{ID: "custom-row", Sets: []MCPLoggedSet{{Done: true, W: floatPtr(60), R: floatPtr(5)}}}}},
			{ID: "w2", D: "2026-08-20", Name: "B", Vol: 200, PRs: []string{"custom-row"}, Entries: []MCPWorkoutEntry{{ID: "custom-row", Sets: []MCPLoggedSet{{Done: true, W: floatPtr(70), R: floatPtr(5)}}}, {ID: "other", Sets: []MCPLoggedSet{{Done: true, W: floatPtr(20), R: floatPtr(10)}}}}},
			{ID: "w3", D: "2026-08-25", Name: "C", Vol: 50, Entries: []MCPWorkoutEntry{{ID: "other", Sets: []MCPLoggedSet{{Done: true, W: floatPtr(20), R: floatPtr(20)}}}}},
		},
	}
	got := buildHistory(view, historyQuery{Since: "2026-08-15", Until: "2026-08-25", Limit: 10, ExerciseID: "custom-row"})
	if len(got) != 1 || got[0].ID != "w2" {
		t.Fatalf("filtered history = %#v", got)
	}
	if len(got[0].Entries) != 1 || got[0].Entries[0].Name != "Cable Press" || !reflect.DeepEqual(got[0].Entries[0].Sets, []string{"70×5"}) {
		t.Fatalf("filtered row = %#v", got[0])
	}
	if !reflect.DeepEqual(got[0].PRs, []string{"custom-row"}) {
		t.Fatalf("prs = %#v", got[0].PRs)
	}
}

func TestTypedExerciseSearchUsesCustomCatalogRows(t *testing.T) {
	view := TrainingData{CustomEx: []MCPCustomExercise{{ID: "custom-row", N: "Cable Press", BP: "chest", EQ: "cable"}}}
	got := searchExercises(view, "cable", exercises.SearchFilters{Limit: 5})
	if len(got) == 0 || got[0].ID != "custom-row" || got[0].N != "Cable Press" {
		t.Fatalf("custom search = %#v", got)
	}
}

func TestMigrateLegacyWeekAndDayPlan(t *testing.T) {
	raw := jsontext.Value(`{"week":{"2":"hip-rehab","4":"hip-rehab"},"dayPlan":{"2026-09-15":"rest","2026-09-16":"fleet-feet-easy"}}`)
	migrated, err := migrateScheduleFields(raw)
	if err != nil {
		t.Fatal(err)
	}
	var doc struct {
		Week    map[string][]MCPDaySession `json:"week"`
		DayPlan map[string]MCPDayPlan      `json:"dayPlan"`
	}
	if err := json.Unmarshal(migrated, &doc); err != nil {
		t.Fatal(err)
	}
	if len(doc.Week["2"]) != 1 || doc.Week["2"][0].RoutineID != "hip-rehab" {
		t.Fatalf("week migrate = %#v", doc.Week)
	}
	if !doc.DayPlan["2026-09-15"].Rest {
		t.Fatalf("rest migrate = %#v", doc.DayPlan["2026-09-15"])
	}
	if len(doc.DayPlan["2026-09-16"].Sessions) != 1 || doc.DayPlan["2026-09-16"].Sessions[0].RoutineID != "fleet-feet-easy" {
		t.Fatalf("dayPlan migrate = %#v", doc.DayPlan["2026-09-16"])
	}
}

func TestAddAndRemoveDaySessionWithoutWeekReplace(t *testing.T) {
	data := TrainingData{
		Routines: []MCPRoutine{
			{ID: "hip-rehab", Name: "Hip"},
			{ID: "fleet-feet-easy", Name: "Run"},
			{ID: "tue-hip-and-run", Name: "Merged"},
		},
		Week: map[string][]MCPDaySession{"2": {{RoutineID: "hip-rehab"}}},
	}
	if err := addSessionToDayPlan(&data, "2026-09-15", MCPDaySession{RoutineID: "fleet-feet-easy", Start: stringPtr("18:00")}); err != nil {
		t.Fatal(err)
	}
	if len(data.Week["2"]) != 1 || data.Week["2"][0].RoutineID != "hip-rehab" {
		t.Fatalf("week should be untouched: %#v", data.Week)
	}
	entry := data.DayPlan["2026-09-15"]
	if entry.Rest || len(entry.Sessions) != 2 || entry.Sessions[0].RoutineID != "hip-rehab" || entry.Sessions[1].RoutineID != "fleet-feet-easy" {
		t.Fatalf("dayPlan after add = %#v", entry)
	}
	if err := removeSessionFromDayPlan(&data, "2026-09-15", "fleet-feet-easy", nil); err != nil {
		t.Fatal(err)
	}
	entry = data.DayPlan["2026-09-15"]
	if len(entry.Sessions) != 1 || entry.Sessions[0].RoutineID != "hip-rehab" {
		t.Fatalf("dayPlan after remove = %#v", entry)
	}
	// Existing merged routine stays available until callers split Tuesday themselves.
	if _, ok := findRoutineByID(data.Routines, "tue-hip-and-run"); !ok {
		t.Fatal("tue-hip-and-run should remain")
	}
}
