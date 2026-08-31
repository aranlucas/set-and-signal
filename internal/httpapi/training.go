package httpapi

import (
	"time"

	"github.com/aranlucas/set-and-signal/internal/exercises"
	"github.com/aranlucas/set-and-signal/internal/store"
	"github.com/aranlucas/set-and-signal/internal/training"
)

// MCP DTO aliases keep the transport schema stable while the implementation
// and persisted training graph live in the training package.
type (
	MCPBestStrength          = training.MCPBestStrength
	MCPBodyweightEntry       = training.MCPBodyweightEntry
	MCPBodyweightFilterInput = training.MCPBodyweightFilterInput
	MCPBodyweightOutput      = training.MCPBodyweightOutput
	MCPCustomExercise        = training.MCPCustomExercise
	MCPDateInput             = training.MCPDateInput
	MCPDigestExerciseEntry   = training.MCPDigestExerciseEntry
	MCPDigestWorkout         = training.MCPDigestWorkout
	MCPDigestWorkoutEntry    = training.MCPDigestWorkoutEntry
	MCPExConfig              = training.MCPExConfig
	MCPExConfigInput         = training.MCPExConfigInput
	MCPExWeightHint          = training.MCPExWeightHint
	MCPExerciseConfigRef     = training.MCPExerciseConfigRef
	MCPExercisePrescription  = training.MCPExercisePrescription
	MCPExerciseSearchResult  = training.MCPExerciseSearchResult
	MCPHistoryEntry          = training.MCPHistoryEntry
	MCPHistoryInput          = training.MCPHistoryInput
	MCPHistoryOutput         = training.MCPHistoryOutput
	MCPHistoryRow            = training.MCPHistoryRow
	MCPLastPerformance       = training.MCPLastPerformance
	MCPLimitInput            = training.MCPLimitInput
	MCPLogBodyweightInput    = training.MCPLogBodyweightInput
	MCPLogBodyweightOutput   = training.MCPLogBodyweightOutput
	MCPLogExerciseSet        = training.MCPLogExerciseSet
	MCPLogExerciseSetsInput  = training.MCPLogExerciseSetsInput
	MCPLogExerciseSetsOutput = training.MCPLogExerciseSetsOutput
	MCPLogWorkoutInput       = training.MCPLogWorkoutInput
	MCPLoggedSet             = training.MCPLoggedSet
	MCPMuscleBalance         = training.MCPMuscleBalance
	MCPMuscleBalanceInput    = training.MCPMuscleBalanceInput
	MCPMuscleLoadView        = training.MCPMuscleLoadView
	MCPNextProgressionInput  = training.MCPNextProgressionInput
	MCPNextTarget            = training.MCPNextTarget
	MCPPreviewProgramInput   = training.MCPPreviewProgramInput
	MCPProgramDiff           = training.MCPProgramDiff
	MCPProgramInput          = training.MCPProgramInput
	MCPProgramPreview        = training.MCPProgramPreview
	MCPProgramState          = training.MCPProgramState
	MCPProgression           = training.MCPProgression
	MCPRoutine               = training.MCPRoutine
	MCPRoutineChange         = training.MCPRoutineChange
	MCPRoutineInput          = training.MCPRoutineInput
	MCPRoutineUpdate         = training.MCPRoutineUpdate
	MCPRoutinesOutput        = training.MCPRoutinesOutput
	MCPScheduleChange        = training.MCPScheduleChange
	MCPSearchExercisesInput  = training.MCPSearchExercisesInput
	MCPSearchExercisesOutput = training.MCPSearchExercisesOutput
	MCPSessionPrescription   = training.MCPSessionPrescription
	MCPSetProgramInput       = training.MCPSetProgramInput
	MCPSetProgramOutput      = training.MCPSetProgramOutput
	MCPStrengthPoint         = training.MCPStrengthPoint
	MCPStrengthProgress      = training.MCPStrengthProgress
	MCPStrengthProgressInput = training.MCPStrengthProgressInput
	MCPSuggestion            = training.MCPSuggestion
	MCPSuggestionEntry       = training.MCPSuggestionEntry
	MCPSuggestionOutput      = training.MCPSuggestionOutput
	MCPTodayResult           = training.MCPTodayResult
	MCPTrainingDigest        = training.MCPTrainingDigest
	MCPTrainingDigestRoutine = training.MCPTrainingDigestRoutine
	MCPWorkout               = training.MCPWorkout
	MCPWorkoutEntry          = training.MCPWorkoutEntry
	MCPWorkoutOutput         = training.MCPWorkoutOutput
	MCPWorkoutsOutput        = training.MCPWorkoutsOutput
	RevisionConflictError    = training.RevisionConflictError
	TrainingData             = training.TrainingData
	TrainingDataRepository   = training.TrainingDataRepository
	historyQuery             = training.HistoryQuery
)

var (
	ErrTrainingDataRevisionConflict = training.ErrTrainingDataRevisionConflict
	ErrTrainingDataNotFound         = training.ErrTrainingDataNotFound
	ErrTrainingDataAmbiguous        = training.ErrTrainingDataAmbiguous
)

func NewTrainingDataRepository(st *store.Store) *TrainingDataRepository {
	return training.NewTrainingDataRepository(st)
}

func (s *Server) loadTrainingData(uid string) (TrainingData, error) {
	return NewTrainingDataRepository(s.ST).Load(uid)
}

func todayISOLocal(timezone string, now time.Time) string {
	return training.TodayISO(timezone, now)
}

func trainingDay(data TrainingData, iso string) MCPTodayResult {
	return training.Day(data, iso)
}

func searchExercises(data TrainingData, query string, filters exercises.SearchFilters) []MCPExerciseSearchResult {
	return training.SearchExercises(data, query, filters)
}

func buildTrainingDigest(data TrainingData, routine MCPRoutine, today string) MCPTrainingDigest {
	return training.BuildDigest(data, routine, today)
}

func buildHistory(data TrainingData, query historyQuery) []MCPHistoryRow {
	return training.BuildHistory(data, query)
}

func sessionPrescription(data TrainingData, iso string) MCPSessionPrescription {
	return training.SessionPrescription(data, iso)
}

func logExerciseSets(data *TrainingData, input MCPLogExerciseSetsInput, now time.Time) (MCPWorkout, MCPProgression, error) {
	return training.LogExerciseSets(data, input, now)
}

var (
	Estimate1RM      = training.Estimate1RM
	StrengthProgress = training.StrengthProgress
	MuscleBalance    = training.MuscleBalance
	NextProgression  = training.NextProgression
)
