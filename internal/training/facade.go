package training

import (
	"time"

	"encoding/json/jsontext"

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

func BuildDigest(data TrainingData, sessions []MCPDaySession, today string) MCPTrainingDigest {
	return buildTrainingDigest(data, sessions, today)
}

func BuildHistory(data TrainingData, query HistoryQuery) []MCPHistoryRow {
	return buildHistory(data, historyQuery(query))
}

func SessionPrescription(data TrainingData, iso string) MCPDayPrescription {
	return sessionPrescription(data, iso)
}

func NormalizeDaySession(session MCPDaySession) (MCPDaySession, error) {
	return normalizeDaySession(session)
}

func CloneWeekSchedule(week map[string][]MCPDaySession) map[string][]MCPDaySession {
	return cloneWeekSchedule(week)
}

func CloneDaySessions(sessions []MCPDaySession) []MCPDaySession {
	return cloneDaySessions(sessions)
}

func DaySessionsEqual(a, b []MCPDaySession) bool {
	return daySessionsEqual(a, b)
}

func AddSessionToDayPlan(data *TrainingData, iso string, session MCPDaySession) error {
	return addSessionToDayPlan(data, iso, session)
}

func RemoveSessionFromDayPlan(data *TrainingData, iso, routineID string, index *int) error {
	return removeSessionFromDayPlan(data, iso, routineID, index)
}

func ResolveDaySessions(data TrainingData, iso string) (sessions []MCPDaySession, override, rest bool) {
	return resolveDaySessions(data, iso)
}

// MigrateScheduleFields rewrites legacy single-id week/dayPlan JSON into the
// sessions-array shape without changing other document fields.
func MigrateScheduleFields(raw jsontext.Value) (jsontext.Value, error) {
	return migrateScheduleFields(raw)
}

// DecodeWeekMap coerces a JSON-decoded week value into the typed schedule map.
func DecodeWeekMap(value any) (map[string][]MCPDaySession, error) {
	return decodeWeekMap(value)
}

// DecodeDayPlanMap coerces a JSON-decoded dayPlan value into typed overrides.
func DecodeDayPlanMap(value any) (map[string]MCPDayPlan, error) {
	return decodeDayPlanMap(value)
}

func LogExerciseSets(data *TrainingData, input MCPLogExerciseSetsInput, now time.Time) (MCPWorkout, MCPProgression, error) {
	return logExerciseSets(data, input, now)
}
