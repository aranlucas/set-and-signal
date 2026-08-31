package training

// This file is the wire contract for the MCP server. The persisted training
// document is decoded by TrainingDataRepository into a closed typed graph.
// Keep these DTOs boring: concrete fields make the generated JSON schemas
// useful to models and incompatible changes visible at compile time.

// MCPExerciseSearchResult is the compact exercise shape returned by search.
// The catalog has richer fields, but these are the fields a program author
// needs in order to select an exercise.
type MCPExerciseSearchResult struct {
	ID string  `json:"id"`
	N  string  `json:"n"`
	BP *string `json:"bp,omitempty"`
	EQ *string `json:"eq,omitempty"`
	TG *string `json:"tg,omitempty"`
}

// MCPExConfig is a sanitized planned exercise.  Numeric fields are pointers
// because the web product distinguishes an omitted field from zero (for
// example, a timed exercise has sec while a reps exercise has reps).
type MCPExConfig struct {
	ID         string   `json:"id" jsonschema:"exercise catalog id"`
	Sets       *float64 `json:"sets,omitempty" jsonschema:"number of working sets"`
	Mode       *string  `json:"mode,omitempty" jsonschema:"exercise mode: reps or time"`
	Reps       *float64 `json:"reps,omitempty" jsonschema:"target repetitions per set"`
	Weight     *float64 `json:"weight,omitempty" jsonschema:"target weight in the profile unit"`
	Sec        *float64 `json:"sec,omitempty" jsonschema:"target seconds for a timed set"`
	Min        *float64 `json:"min,omitempty" jsonschema:"target minutes for a timed set"`
	Speed      *float64 `json:"speed,omitempty" jsonschema:"target speed"`
	Bodyweight *bool    `json:"bodyweight,omitempty" jsonschema:"whether the movement uses bodyweight"`
	Side       *bool    `json:"side,omitempty" jsonschema:"whether the target is performed per side"`
	Prog       *string  `json:"prog,omitempty" jsonschema:"progression policy"`
	Inc        *float64 `json:"inc,omitempty" jsonschema:"weight or target increment after success"`
	RepsMin    *float64 `json:"repsMin,omitempty" jsonschema:"minimum repetitions for double progression"`
	RepsMax    *float64 `json:"repsMax,omitempty" jsonschema:"maximum repetitions for double progression"`
	Sg         *string  `json:"sg,omitempty" jsonschema:"superset group id"`
}

// MCPExConfigInput is the same product graph with an optional sets field for
// callers creating a new program.  Sanitization supplies product defaults.
type MCPExConfigInput = MCPExConfig

type MCPRoutine struct {
	ID    string        `json:"id"`
	Name  string        `json:"name"`
	Emoji string        `json:"emoji"`
	Prog  *string       `json:"prog,omitempty"`
	Ex    []MCPExConfig `json:"ex"`
}

// MCPRoutineInput keeps fields minted by the server optional at input time.
type MCPRoutineInput struct {
	ID    *string            `json:"id,omitempty" jsonschema:"stable routine id; generated from name when omitted"`
	Name  string             `json:"name" jsonschema:"human-readable routine name"`
	Emoji *string            `json:"emoji,omitempty" jsonschema:"optional routine emoji"`
	Prog  *string            `json:"prog,omitempty" jsonschema:"default progression policy for the routine"`
	Ex    []MCPExConfigInput `json:"ex,omitempty" jsonschema:"ordered planned exercises"`
}

// MCPLoggedSet is the tagged-union superset used by the web app.  The stored
// JSON has no explicit mode discriminator, so a typed wire object represents
// the possible fields and uses pointers for fields absent in another mode.
type MCPLoggedSet struct {
	Done  bool     `json:"done" jsonschema:"whether the set was completed"`
	W     *float64 `json:"w,omitempty" jsonschema:"performed weight in the profile unit"`
	R     *float64 `json:"r,omitempty" jsonschema:"performed repetitions"`
	Sec   *float64 `json:"sec,omitempty" jsonschema:"performed seconds"`
	Min   *float64 `json:"min,omitempty" jsonschema:"performed minutes"`
	Speed *float64 `json:"speed,omitempty" jsonschema:"performed speed"`
	RIR   *float64 `json:"rir,omitempty" jsonschema:"repetitions in reserve"`
	RPE   *float64 `json:"rpe,omitempty" jsonschema:"rating of perceived exertion"`
	WU    *bool    `json:"wu,omitempty" jsonschema:"whether this was a warm-up set"`
}

type MCPWorkoutEntry struct {
	ID     string         `json:"id" jsonschema:"exercise id"`
	Sets   []MCPLoggedSet `json:"sets" jsonschema:"performed sets"`
	TopW   *float64       `json:"topW,omitempty" jsonschema:"top performed weight"`
	Target *MCPExConfig   `json:"target,omitempty" jsonschema:"planned target captured with the workout"`
}

type MCPWorkout struct {
	ID        string            `json:"id" jsonschema:"stable workout id; an existing id is replaced"`
	D         string            `json:"d" jsonschema:"workout date in YYYY-MM-DD"`
	Start     int64             `json:"start" jsonschema:"start time as unix milliseconds"`
	End       int64             `json:"end" jsonschema:"end time as unix milliseconds"`
	RoutineID *string           `json:"routineId,omitempty" jsonschema:"source routine id"`
	Name      string            `json:"name" jsonschema:"workout name"`
	BW        *float64          `json:"bw,omitempty" jsonschema:"bodyweight at workout time"`
	Entries   []MCPWorkoutEntry `json:"entries" jsonschema:"exercise results"`
	PRs       []string          `json:"prs" jsonschema:"exercise ids with personal records"`
	Vol       float64           `json:"vol" jsonschema:"total workout volume"`
	Note      *string           `json:"note,omitempty" jsonschema:"optional workout note"`
}

type MCPBodyweightEntry struct {
	D string  `json:"d"`
	W float64 `json:"w"`
	T *int64  `json:"t,omitempty"`
}

type MCPDateInput struct {
	Iso *string `json:"iso,omitempty" jsonschema:"date in YYYY-MM-DD; defaults to today"`
	Tz  *string `json:"tz,omitempty" jsonschema:"IANA timezone used when resolving today"`
}

type MCPSearchExercisesInput struct {
	Q     string `json:"q,omitempty" jsonschema:"name or keyword query"`
	BP    string `json:"bp,omitempty" jsonschema:"body-part filter"`
	EQ    string `json:"eq,omitempty" jsonschema:"equipment filter"`
	Limit *int   `json:"limit,omitempty" jsonschema:"maximum results from 1 to 100"`
}

type MCPBodyweightFilterInput struct {
	D *string `json:"d,omitempty" jsonschema:"optional date in YYYY-MM-DD"`
}

type MCPLogBodyweightInput struct {
	W  float64 `json:"w" jsonschema:"bodyweight in the profile unit, from 20 to 500"`
	D  *string `json:"d,omitempty" jsonschema:"date in YYYY-MM-DD; defaults to today"`
	Tz *string `json:"tz,omitempty" jsonschema:"IANA timezone used when resolving today"`
}

type MCPHistoryInput struct {
	Since      *string `json:"since,omitempty" jsonschema:"inclusive start date in YYYY-MM-DD"`
	Until      *string `json:"until,omitempty" jsonschema:"inclusive end date in YYYY-MM-DD"`
	ExerciseID *string `json:"exerciseId,omitempty" jsonschema:"only workouts containing this exercise id"`
	Limit      *int    `json:"limit,omitempty" jsonschema:"maximum workouts from 1 to 100"`
}

type MCPLimitInput struct {
	Limit *int `json:"limit,omitempty" jsonschema:"maximum results from 1 to 100"`
}

type MCPLogWorkoutInput struct {
	Workout MCPWorkout `json:"workout" jsonschema:"completed workout to append or replace by id"`
}

type MCPTodayResult struct {
	Iso       string      `json:"iso"`
	Weekday   string      `json:"weekday"`
	Rest      bool        `json:"rest"`
	Override  bool        `json:"override"`
	RoutineID *string     `json:"routineId,omitempty"`
	Routine   *MCPRoutine `json:"routine,omitempty"`
	WeekSlot  *string     `json:"weekSlot,omitempty"`
}

type MCPSearchExercisesOutput struct {
	Exercises []MCPExerciseSearchResult `json:"exercises"`
}

type MCPRoutinesOutput struct {
	Routines []MCPRoutine `json:"routines"`
}

type MCPSetProgramOutput struct {
	OK       bool               `json:"ok"`
	Routines []MCPRoutine       `json:"routines"`
	Week     map[string]*string `json:"week,omitempty"`
	Revision int64              `json:"revision"`
}

type MCPBodyweightOutput struct {
	Unit       string               `json:"unit"`
	Goal       *float64             `json:"goal,omitempty"`
	Bodyweight []MCPBodyweightEntry `json:"bodyweight"`
}

type MCPLogBodyweightOutput struct {
	Unit string   `json:"unit"`
	Goal *float64 `json:"goal,omitempty"`
	OK   bool     `json:"ok"`
	Date string   `json:"date"`
}

type MCPHistoryOutput struct {
	History []MCPHistoryRow `json:"history"`
}

type MCPWorkoutsOutput struct {
	Workouts []MCPWorkout `json:"workouts"`
}

type MCPWorkoutOutput struct {
	OK      bool       `json:"ok"`
	Workout MCPWorkout `json:"workout"`
}

type MCPSuggestionOutput = MCPSuggestion

type MCPDigestExerciseEntry struct {
	ID         string   `json:"id"`
	Name       string   `json:"name"`
	Sets       *float64 `json:"sets,omitempty"`
	Reps       *float64 `json:"reps,omitempty"`
	Weight     *float64 `json:"weight,omitempty"`
	Sec        *float64 `json:"sec,omitempty"`
	Min        *float64 `json:"min,omitempty"`
	Speed      *float64 `json:"speed,omitempty"`
	Bodyweight *bool    `json:"bodyweight,omitempty"`
	Side       *bool    `json:"side,omitempty"`
	LastWeight *float64 `json:"lastWeight,omitempty"`
}

type MCPDigestWorkoutEntry struct {
	ID     string       `json:"id"`
	Name   string       `json:"name"`
	Target *MCPExConfig `json:"target,omitempty"`
	Sets   []string     `json:"sets"`
}

type MCPDigestWorkout struct {
	D       string                  `json:"d"`
	Name    string                  `json:"name"`
	BW      *float64                `json:"bw,omitempty"`
	Entries []MCPDigestWorkoutEntry `json:"entries"`
}

type MCPTrainingDigestRoutine struct {
	Name    string                   `json:"name"`
	Entries []MCPDigestExerciseEntry `json:"entries"`
}

type MCPTrainingDigest struct {
	Unit           string                   `json:"unit"`
	Today          string                   `json:"today"`
	BodyweightGoal *float64                 `json:"bodyweightGoal,omitempty"`
	Bodyweight     []MCPBodyweightEntry     `json:"bodyweight"`
	Routine        MCPTrainingDigestRoutine `json:"routine"`
	LastWorkouts   []MCPDigestWorkout       `json:"lastWorkouts"`
}

type MCPHistoryEntry struct {
	ID         string   `json:"id"`
	Name       string   `json:"name"`
	Sets       []string `json:"sets"`
	LastWeight *float64 `json:"lastWeight,omitempty"`
	Hit        *bool    `json:"hit,omitempty"`
}

type MCPHistoryRow struct {
	ID      string            `json:"id"`
	D       string            `json:"d"`
	Name    string            `json:"name"`
	Vol     float64           `json:"vol"`
	Entries []MCPHistoryEntry `json:"entries"`
	PRs     []string          `json:"prs,omitempty"`
	BW      *float64          `json:"bw,omitempty"`
}

type MCPSuggestionEntry struct {
	ID     string   `json:"id"`
	Sets   *float64 `json:"sets,omitempty"`
	Reps   *float64 `json:"reps,omitempty"`
	Weight *float64 `json:"weight,omitempty"`
	Sec    *float64 `json:"sec,omitempty"`
	Min    *float64 `json:"min,omitempty"`
	Speed  *float64 `json:"speed,omitempty"`
	SwapTo *string  `json:"swapTo,omitempty"`
	Note   *string  `json:"note,omitempty"`
}

type MCPSuggestion struct {
	Summary string               `json:"summary"`
	Entries []MCPSuggestionEntry `json:"entries"`
}

type MCPProgramInput struct {
	Routines []MCPRoutineInput  `json:"routines" jsonschema:"routines to validate and preview"`
	Week     map[string]*string `json:"week,omitempty" jsonschema:"weekday keys 0 through 6 mapped to routine ids or null"`
	Replace  bool               `json:"replace,omitzero" jsonschema:"replace the full program instead of merging routines"`
}

type MCPSetProgramInput struct {
	Routines         []MCPRoutineInput  `json:"routines" jsonschema:"routines to validate and apply"`
	Week             map[string]*string `json:"week,omitempty" jsonschema:"weekday keys 0 through 6 mapped to routine ids or null"`
	Replace          bool               `json:"replace,omitzero" jsonschema:"replace the full program instead of merging routines"`
	ExpectedRevision *int64             `json:"expectedRevision,omitempty" jsonschema:"revision returned by preview_program for optimistic concurrency"`
}

type MCPPreviewProgramInput = MCPProgramInput

type MCPStrengthProgressInput struct {
	ExerciseID string  `json:"exerciseId" jsonschema:"exercise id to analyze"`
	Formula    *string `json:"formula,omitempty" jsonschema:"one-rep-max formula: epley, brzycki, or lombardi"`
}

type MCPMuscleBalanceInput struct {
	AsOf *string `json:"asOf,omitempty" jsonschema:"analysis end date in YYYY-MM-DD"`
	Days *int    `json:"days,omitempty" jsonschema:"lookback window: 0, 7, 30, or 90 days"`
}

type MCPNextProgressionInput struct {
	ExerciseID string  `json:"exerciseId" jsonschema:"planned exercise id"`
	RoutineID  *string `json:"routineId,omitempty" jsonschema:"routine id required when the exercise appears in multiple routines"`
}

type MCPLogExerciseSet struct {
	W    *float64 `json:"w,omitempty" jsonschema:"performed weight in the profile unit"`
	R    float64  `json:"r" jsonschema:"performed repetitions"`
	Done *bool    `json:"done,omitempty" jsonschema:"whether the set was completed; defaults to true"`
}

type MCPLogExerciseSetsInput struct {
	ExerciseID string              `json:"exerciseId" jsonschema:"exercise catalog id"`
	D          *string             `json:"d,omitempty" jsonschema:"date in YYYY-MM-DD; defaults to today"`
	Tz         *string             `json:"tz,omitempty" jsonschema:"IANA timezone used when resolving today"`
	RoutineID  *string             `json:"routineId,omitempty" jsonschema:"source routine id; inferred when the exercise is in exactly one routine"`
	Sets       []MCPLogExerciseSet `json:"sets" jsonschema:"working sets; omit warm-ups"`
}

type MCPLogExerciseSetsOutput struct {
	OK       bool           `json:"ok"`
	Workout  MCPWorkout     `json:"workout"`
	Next     MCPProgression `json:"next"`
	Revision int64          `json:"revision"`
}

type MCPLastPerformance struct {
	Date   string   `json:"date"`
	Sets   []string `json:"sets"`
	Weight float64  `json:"weight"`
	Hit    bool     `json:"hit"`
}

type MCPNextTarget struct {
	Sets   *float64 `json:"sets,omitempty"`
	Reps   *float64 `json:"reps,omitempty"`
	Weight *float64 `json:"weight,omitempty"`
	Sec    *float64 `json:"sec,omitempty"`
}

type MCPExercisePrescription struct {
	ID       string              `json:"id"`
	Name     string              `json:"name"`
	Last     *MCPLastPerformance `json:"last,omitempty"`
	Next     MCPNextTarget       `json:"next"`
	Decision string              `json:"decision"`
	Reason   string              `json:"reason"`
}

type MCPSessionPrescription struct {
	Iso         string                    `json:"iso"`
	Unit        string                    `json:"unit"`
	Rest        bool                      `json:"rest"`
	RoutineID   *string                   `json:"routineId,omitempty"`
	RoutineName *string                   `json:"routineName,omitempty"`
	Policy      *string                   `json:"policy,omitempty"`
	Exercises   []MCPExercisePrescription `json:"exercises"`
}

type MCPProgramState struct {
	Routines []MCPRoutine       `json:"routines"`
	Week     map[string]*string `json:"week,omitempty"`
}

type MCPRoutineChange struct {
	ID      string     `json:"id"`
	Routine MCPRoutine `json:"routine"`
}

type MCPRoutineUpdate struct {
	ID     string      `json:"id"`
	Before *MCPRoutine `json:"before,omitempty"`
	After  *MCPRoutine `json:"after,omitempty"`
}

type MCPScheduleChange struct {
	Day    string  `json:"day"`
	Before *string `json:"before,omitempty"`
	After  *string `json:"after,omitempty"`
}

type MCPProgramDiff struct {
	AddedRoutines   []MCPRoutineChange  `json:"addedRoutines"`
	UpdatedRoutines []MCPRoutineUpdate  `json:"updatedRoutines"`
	RemovedRoutines []MCPRoutineChange  `json:"removedRoutines"`
	ScheduleChanges []MCPScheduleChange `json:"scheduleChanges"`
	Summary         string              `json:"summary"`
}

type MCPProgramPreview struct {
	OK              bool            `json:"ok"`
	Replace         *bool           `json:"replace,omitempty"`
	Revision        *int64          `json:"revision,omitempty"`
	CurrentRevision *int64          `json:"currentRevision,omitempty"`
	Sanitized       MCPProgramInput `json:"sanitized"`
	Proposed        MCPProgramState `json:"proposed"`
	Result          MCPProgramState `json:"result"`
	Diff            MCPProgramDiff  `json:"diff"`
}

type MCPStrengthPoint struct {
	D string  `json:"d"`
	T float64 `json:"t"`
	Y float64 `json:"y"`
	W float64 `json:"w"`
	R float64 `json:"r"`
}

type MCPBestStrength struct {
	Est float64 `json:"est"`
	W   float64 `json:"w"`
	R   float64 `json:"r"`
	D   string  `json:"d"`
	T   float64 `json:"t"`
}

type MCPStrengthProgress struct {
	ExerciseID string             `json:"exerciseId"`
	Formula    string             `json:"formula"`
	Trend      []MCPStrengthPoint `json:"trend"`
	Best       *MCPBestStrength   `json:"best,omitempty"`
	Reason     *string            `json:"reason,omitempty"`
}

type MCPMuscleLoadView struct {
	Load      map[string]float64 `json:"load"`
	Levels    map[string]int     `json:"levels"`
	Worked    []string           `json:"worked"`
	Missed    []string           `json:"missed"`
	Available *bool              `json:"available,omitempty"`
}

type MCPMuscleBalance struct {
	AsOf     string            `json:"asOf"`
	Days     int               `json:"days"`
	Rated    bool              `json:"rated"`
	HardSets int               `json:"hardSets"`
	All      MCPMuscleLoadView `json:"all"`
	Hard     MCPMuscleLoadView `json:"hard"`
}

type MCPProgression struct {
	Policy string   `json:"policy"`
	Kind   string   `json:"kind"`
	Weight *float64 `json:"weight,omitempty"`
	Reps   *float64 `json:"reps,omitempty"`
	Sec    *float64 `json:"sec,omitempty"`
	Sets   *float64 `json:"sets,omitempty"`
	Reason *string  `json:"reason,omitempty"`
}
