package training

import (
	"time"

	"github.com/aranlucas/set-and-signal/internal/exercises"
)

// HistoryQuery is the transport-neutral filter for completed workouts.
type HistoryQuery struct {
	Since      string
	Until      string
	ExerciseID string
	Limit      int
}

func TodayISO(timezone string, now time.Time) string {
	return todayISOLocal(timezone, now)
}

func ValidISODate(value string) bool {
	return isoDateRe.MatchString(value)
}

func Day(data TrainingData, iso string) MCPTodayResult {
	return trainingDay(data, iso)
}

func SearchExercises(data TrainingData, query string, filters exercises.SearchFilters) []MCPExerciseSearchResult {
	return searchExercises(data, query, filters)
}

func BuildDigest(data TrainingData, routine MCPRoutine, today string) MCPTrainingDigest {
	return buildTrainingDigest(data, routine, today)
}

func BuildHistory(data TrainingData, query HistoryQuery) []MCPHistoryRow {
	return buildHistory(data, historyQuery(query))
}

func SessionPrescription(data TrainingData, iso string) MCPSessionPrescription {
	return sessionPrescription(data, iso)
}

func LogExerciseSets(data *TrainingData, input MCPLogExerciseSetsInput, now time.Time) (MCPWorkout, MCPProgression, error) {
	return logExerciseSets(data, input, now)
}
