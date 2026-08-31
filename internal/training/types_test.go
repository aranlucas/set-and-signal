package training

import (
	"reflect"
	"strings"
	"testing"
)

// MCP DTOs are deliberately closed graphs.  A map[string]any hidden inside a
// nested output is just as harmful as one on the top-level tool result, so
// walk every public DTO recursively and fail at the first interface-shaped
// field.  Concrete maps (for example muscle -> load) remain allowed.
func TestMCPDTOGraphsHaveNoInterfaceFields(t *testing.T) {
	types := []reflect.Type{
		reflect.TypeFor[TrainingData](), reflect.TypeFor[MCPCustomExercise](), reflect.TypeFor[MCPExWeightHint](),
		reflect.TypeFor[MCPExerciseSearchResult](),
		reflect.TypeFor[MCPExConfig](), reflect.TypeFor[MCPRoutine](), reflect.TypeFor[MCPRoutineInput](),
		reflect.TypeFor[MCPLoggedSet](), reflect.TypeFor[MCPWorkoutEntry](), reflect.TypeFor[MCPWorkout](),
		reflect.TypeFor[MCPBodyweightEntry](), reflect.TypeFor[MCPDateInput](),
		reflect.TypeFor[MCPSearchExercisesInput](), reflect.TypeFor[MCPBodyweightFilterInput](),
		reflect.TypeFor[MCPLogBodyweightInput](), reflect.TypeFor[MCPHistoryInput](), reflect.TypeFor[MCPLimitInput](),
		reflect.TypeFor[MCPLogWorkoutInput](),
		reflect.TypeFor[MCPLogExerciseSetsInput](), reflect.TypeFor[MCPLogExerciseSet](),
		reflect.TypeFor[MCPLogExerciseSetsOutput](),
		reflect.TypeFor[MCPTodayResult](), reflect.TypeFor[MCPDigestExerciseEntry](), reflect.TypeFor[MCPDigestWorkoutEntry](),
		reflect.TypeFor[MCPDigestWorkout](), reflect.TypeFor[MCPTrainingDigestRoutine](), reflect.TypeFor[MCPTrainingDigest](),
		reflect.TypeFor[MCPHistoryEntry](), reflect.TypeFor[MCPHistoryRow](), reflect.TypeFor[MCPSuggestionEntry](),
		reflect.TypeFor[MCPSuggestion](), reflect.TypeFor[MCPSearchExercisesOutput](), reflect.TypeFor[MCPRoutinesOutput](),
		reflect.TypeFor[MCPSetProgramOutput](), reflect.TypeFor[MCPBodyweightOutput](),
		reflect.TypeFor[MCPLogBodyweightOutput](), reflect.TypeFor[MCPHistoryOutput](), reflect.TypeFor[MCPWorkoutsOutput](),
		reflect.TypeFor[MCPWorkoutOutput](), reflect.TypeFor[MCPProgramInput](), reflect.TypeFor[MCPSetProgramInput](),
		reflect.TypeFor[MCPStrengthProgressInput](), reflect.TypeFor[MCPMuscleBalanceInput](),
		reflect.TypeFor[MCPNextProgressionInput](), reflect.TypeFor[MCPLastPerformance](),
		reflect.TypeFor[MCPNextTarget](), reflect.TypeFor[MCPExercisePrescription](),
		reflect.TypeFor[MCPSessionPrescription](), reflect.TypeFor[MCPProgramState](),
		reflect.TypeFor[MCPPreviewProgramInput](), reflect.TypeFor[MCPSuggestionOutput](),
		reflect.TypeFor[MCPRoutineChange](), reflect.TypeFor[MCPRoutineUpdate](), reflect.TypeFor[MCPScheduleChange](),
		reflect.TypeFor[MCPProgramDiff](), reflect.TypeFor[MCPProgramPreview](),
		reflect.TypeFor[MCPStrengthPoint](), reflect.TypeFor[MCPBestStrength](), reflect.TypeFor[MCPStrengthProgress](),
		reflect.TypeFor[MCPMuscleLoadView](), reflect.TypeFor[MCPMuscleBalance](),
		reflect.TypeFor[MCPProgression](),
	}
	for _, typ := range types {
		assertMCPConcrete(t, typ, typ.Name())
	}
}

func assertMCPConcrete(t *testing.T, typ reflect.Type, path string) {
	t.Helper()
	for typ.Kind() == reflect.Pointer {
		typ = typ.Elem()
	}
	switch typ.Kind() {
	case reflect.Interface:
		t.Fatalf("MCP DTO field %s contains interface type %s", path, typ)
	case reflect.Map:
		assertMCPConcrete(t, typ.Key(), path+" map key")
		assertMCPConcrete(t, typ.Elem(), path+" map value")
	case reflect.Slice, reflect.Array:
		assertMCPConcrete(t, typ.Elem(), path+" element")
	case reflect.Struct:
		for field := range typ.Fields() {
			if strings.HasPrefix(field.Name, "_") {
				continue
			}
			assertMCPConcrete(t, field.Type, path+"."+field.Name)
		}
	}
}
