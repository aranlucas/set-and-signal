package training

import (
	"reflect"
	"testing"

	"github.com/aranlucas/set-and-signal/internal/exercises"
)

func floatPtr(value float64) *float64        { return new(value) }
func producerStringPtr(value string) *string { return new(value) }

func TestResolveTodayTypedHonorsOverrideAndWeeklyFallback(t *testing.T) {
	view := TrainingData{
		Routines: []MCPRoutine{
			{ID: "push", Name: "Push"},
			{ID: "pull", Name: "Pull"},
		},
		Week:    map[string]*string{"3": producerStringPtr("push")},
		DayPlan: map[string]*string{"2026-08-26": producerStringPtr("rest")},
	}

	got := trainingDay(view, "2026-08-26")
	if !got.Rest || !got.Override || got.Routine != nil {
		t.Fatalf("rest override = %#v", got)
	}

	view.DayPlan["2026-08-26"] = producerStringPtr("missing")
	got = trainingDay(view, "2026-08-26")
	if got.Rest || !got.Override || got.RoutineID == nil || *got.RoutineID != "push" {
		t.Fatalf("invalid override should fall back to week = %#v", got)
	}
	if got.WeekSlot == nil || *got.WeekSlot != "push" {
		t.Fatalf("week slot = %#v", got.WeekSlot)
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

	got := buildTrainingDigest(view, routine, "2026-08-23")
	if got.Unit != "lb" || got.Today != "2026-08-23" || got.BodyweightGoal == nil || *got.BodyweightGoal != 180 {
		t.Fatalf("digest metadata = %#v", got)
	}
	if len(got.Routine.Entries) != 1 || got.Routine.Entries[0].Name != "Cable Press" {
		t.Fatalf("routine entries = %#v", got.Routine.Entries)
	}
	if got.Routine.Entries[0].LastWeight == nil || *got.Routine.Entries[0].LastWeight != 75 {
		t.Fatalf("last weight = %#v", got.Routine.Entries[0].LastWeight)
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
