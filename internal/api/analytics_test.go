package api

import "testing"

func f(v float64) *float64       { return new(v) }
func b(v bool) *bool             { return new(v) }
func stringPtr(v string) *string { return new(v) }

func TestEstimate1RMMatchesFrontendFormulasAndCaps(t *testing.T) {
	cases := []struct {
		name, formula      string
		weight, reps, want float64
	}{
		{"epley", "epley", 90, 5, 105},
		{"brzycki", "brzycki", 90, 5, 101.3},
		{"lombardi", "lombardi", 90, 5, 105.7},
		{"single", "epley", 140, 1, 140},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			got, ok := Estimate1RM(tc.weight, tc.reps, tc.formula)
			if !ok || got != tc.want {
				t.Fatalf("Estimate1RM(%v, %v, %q) = %v, %v; want %v, true", tc.weight, tc.reps, tc.formula, got, ok, tc.want)
			}
		})
	}
	for _, tc := range [][2]float64{{0, 5}, {-1, 5}, {90, 0}, {90, 13}} {
		if got, ok := Estimate1RM(tc[0], tc[1], "epley"); ok || got != 0 {
			t.Fatalf("Estimate1RM(%v, %v) = %v, %v; want 0, false", tc[0], tc[1], got, ok)
		}
	}
}

func TestStrengthProgressSkipsWarmupsAndExplainsMissingEstimate(t *testing.T) {
	state := TrainingData{Workouts: []MCPWorkout{
		{D: "2026-08-01", Start: 1, Entries: []MCPWorkoutEntry{{ID: "bench", Sets: []MCPLoggedSet{
			{W: f(40), R: f(10), Done: true, WU: b(true)}, {W: f(80), R: f(5), Done: true},
		}}}},
		{D: "2026-08-08", Start: 2, Entries: []MCPWorkoutEntry{{ID: "bench", Sets: []MCPLoggedSet{{W: f(85), R: f(5), Done: true}}}}},
	}}
	result := StrengthProgress(state, "bench", "epley")
	trend := result.Trend
	if len(trend) != 2 || trend[0].D != "2026-08-01" || trend[0].Y != 93.3 {
		t.Fatalf("trend = %#v", trend)
	}
	if result.Best == nil || result.Best.D != "2026-08-08" || result.Best.W != 85.0 || result.Best.R != 5.0 {
		t.Fatalf("best = %#v", result.Best)
	}

	onlyWarmup := TrainingData{Workouts: []MCPWorkout{{Entries: []MCPWorkoutEntry{{ID: "bench", Sets: []MCPLoggedSet{{W: f(40), R: f(10), Done: true, WU: b(true)}}}}}}}
	missing := StrengthProgress(onlyWarmup, "bench", "epley")
	if missing.Best != nil || missing.Reason == nil || *missing.Reason != "Only warm-up sets are logged; complete a working set to estimate strength." {
		t.Fatalf("missing estimate = %#v", missing)
	}
}

func TestMuscleBalanceUsesCatalogAliasesWindowsAndHardSets(t *testing.T) {
	state := TrainingData{Workouts: []MCPWorkout{
		{D: "2026-08-02", Entries: []MCPWorkoutEntry{{ID: "0025", Sets: []MCPLoggedSet{
			{Done: true, RPE: f(9)}, {Done: true, RPE: f(7)},
		}}}},
		{D: "2026-08-20", Entries: []MCPWorkoutEntry{{ID: "0001", Sets: []MCPLoggedSet{{Done: true}}}}},
	}}
	week := MuscleBalance(state, "2026-08-28", 7)
	if len(week.All.Worked) != 0 {
		t.Fatalf("week unexpectedly includes old workout: %#v", week)
	}
	all := MuscleBalance(state, "2026-08-28", 0)
	if all.Days != 0 || all.All.Load["chest"] != 2.0 {
		t.Fatalf("all balance = %#v", all)
	}
	if all.Hard.Available == nil || !*all.Hard.Available || all.Hard.Load["chest"] != 2.0 {
		t.Fatalf("hard balance = %#v", all.Hard)
	}
	// 0001 targets abs and its lower-back secondary, proving catalog metadata
	// is used rather than exercise-id-specific assumptions.
	if all.All.Load["abs"] != 1.0 {
		t.Fatalf("abs load = %#v", all.All.Load)
	}
}

func TestNextProgressionPortsLinearAndDoublePolicies(t *testing.T) {
	state := TrainingData{Unit: "kg", Workouts: []MCPWorkout{{Entries: []MCPWorkoutEntry{{ID: "bench", Target: &MCPExConfig{ID: "bench", Sets: f(3), Reps: f(5)}, Sets: []MCPLoggedSet{
		{Done: true, W: f(80), R: f(5)}, {Done: true, W: f(80), R: f(5)}, {Done: true, W: f(80), R: f(5)},
	}}}}}}
	linear := NextProgression(state, MCPExConfig{ID: "bench", Sets: f(3), Reps: f(5)}, MCPRoutine{})
	if linear.Kind != "up" || linear.Weight == nil || *linear.Weight != 82.5 || linear.Policy != "linear" {
		t.Fatalf("linear = %#v", linear)
	}
	double := NextProgression(state, MCPExConfig{ID: "bench", Sets: f(3), Reps: f(10), RepsMin: f(8), Prog: stringPtr("double")}, MCPRoutine{})
	if double.Kind != "up" || double.Weight == nil || *double.Weight != 82.5 || double.Reps == nil || *double.Reps != 8.0 {
		t.Fatalf("double = %#v", double)
	}
}

func TestNextProgressionDoesNotAdvanceIncompleteWorkingSets(t *testing.T) {
	state := TrainingData{Unit: "kg", Workouts: []MCPWorkout{{Entries: []MCPWorkoutEntry{{ID: "bench", Target: &MCPExConfig{ID: "bench", Sets: f(3), Reps: f(5)}, Sets: []MCPLoggedSet{
		{Done: true, W: f(80), R: f(5)}, {Done: true, W: f(80), R: f(5)}, {Done: false, W: f(80), R: f(5)},
	}}}}}}
	got := NextProgression(state, MCPExConfig{ID: "bench", Sets: f(3), Reps: f(5)}, MCPRoutine{})
	if got.Kind != "hold" || got.Weight == nil || *got.Weight != 80.0 {
		t.Fatalf("incomplete session advanced: %#v", got)
	}
}

func TestNextProgressionTimeAndCardioModes(t *testing.T) {
	state := TrainingData{Workouts: []MCPWorkout{{Entries: []MCPWorkoutEntry{{ID: "plank", Target: &MCPExConfig{ID: "plank", Mode: stringPtr("time"), Sets: f(2), Sec: f(30), Prog: stringPtr("time")}, Sets: []MCPLoggedSet{
		{Done: true, Sec: f(30), W: f(0)}, {Done: true, Sec: f(20), W: f(0)},
	}}}}}}
	got := NextProgression(state, MCPExConfig{ID: "plank", Mode: stringPtr("time"), Sets: f(2), Sec: f(30), Prog: stringPtr("time")}, MCPRoutine{})
	if got.Kind != "hold" || got.Sec == nil || *got.Sec != 30.0 || got.Policy != "time" {
		t.Fatalf("time progression = %#v", got)
	}

	cardio := NextProgression(state, MCPExConfig{ID: "3220", Prog: stringPtr("linear")}, MCPRoutine{})
	if cardio.Kind != "off" || cardio.Policy != "off" {
		t.Fatalf("cardio progression should be off: %#v", cardio)
	}
}
