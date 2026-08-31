package training

import (
	"errors"
	"fmt"
	"slices"
	"strings"
	"time"
)

func cloneFloat(v *float64) *float64 {
	if v == nil {
		return nil
	}
	return new(*v)
}

func cloneString(v *string) *string {
	if v == nil {
		return nil
	}
	return new(*v)
}

func cloneBool(v *bool) *bool {
	if v == nil {
		return nil
	}
	return new(*v)
}

func cloneExConfig(cfg MCPExConfig) MCPExConfig {
	return MCPExConfig{
		ID: cfg.ID, Sets: cloneFloat(cfg.Sets), Mode: cloneString(cfg.Mode),
		Reps: cloneFloat(cfg.Reps), Weight: cloneFloat(cfg.Weight), Sec: cloneFloat(cfg.Sec),
		Min: cloneFloat(cfg.Min), Speed: cloneFloat(cfg.Speed), Bodyweight: cloneBool(cfg.Bodyweight),
		Side: cloneBool(cfg.Side), Prog: cloneString(cfg.Prog), Inc: cloneFloat(cfg.Inc),
		RepsMin: cloneFloat(cfg.RepsMin), RepsMax: cloneFloat(cfg.RepsMax), Sg: cloneString(cfg.Sg),
	}
}

func cloneRoutine(routine MCPRoutine) MCPRoutine {
	out := MCPRoutine{
		ID: routine.ID, Name: routine.Name, Emoji: routine.Emoji, Prog: cloneString(routine.Prog),
		Ex: make([]MCPExConfig, len(routine.Ex)),
	}
	for i, cfg := range routine.Ex {
		out.Ex[i] = cloneExConfig(cfg)
	}
	return out
}

func applyProgressionToConfig(cfg MCPExConfig, prescription MCPProgression) MCPExConfig {
	if prescription.Kind == "off" {
		return cfg
	}
	out := cloneExConfig(cfg)
	if prescription.Weight != nil {
		out.Weight = cloneFloat(prescription.Weight)
	}
	if prescription.Reps != nil {
		out.Reps = cloneFloat(prescription.Reps)
	}
	if prescription.Sets != nil {
		out.Sets = cloneFloat(prescription.Sets)
	}
	if prescription.Sec != nil {
		out.Sec = cloneFloat(prescription.Sec)
	}
	return out
}

func lastLoggedWorkingWeight(view TrainingData, exerciseID string) float64 {
	for _, workout := range slices.Backward(view.Workouts) {
		for _, entry := range workout.Entries {
			if entry.ID != exerciseID {
				continue
			}
			if w := sessionWorkingWeight(entry, progressionConfig{}); w > 0 {
				return w
			}
		}
	}
	if hint, ok := view.ExWeights[exerciseID]; ok && hint.W > 0 {
		return hint.W
	}
	return 0
}

func fillConfigWeight(view TrainingData, cfg MCPExConfig, prescription MCPProgression) MCPExConfig {
	out := applyProgressionToConfig(cfg, prescription)
	if floatPointerValue(out.Weight) > 0 {
		return out
	}
	if last := lastLoggedWorkingWeight(view, cfg.ID); last > 0 {
		out.Weight = new(last)
	}
	return out
}

// prescribeRoutine returns a copy of the routine with next working weights
// filled in from history. It does not mutate the stored program.
func prescribeRoutine(view TrainingData, routine MCPRoutine) MCPRoutine {
	out := cloneRoutine(routine)
	for i, cfg := range out.Ex {
		out.Ex[i] = fillConfigWeight(view, cfg, NextProgression(view, cfg, routine))
	}
	return out
}

func persistExWeightHints(data *TrainingData, workout MCPWorkout) {
	if data.ExWeights == nil {
		data.ExWeights = map[string]MCPExWeightHint{}
	}
	for _, entry := range workout.Entries {
		weight := sessionWorkingWeight(entry, progressionConfig{})
		if weight <= 0 {
			continue
		}
		current, ok := data.ExWeights[entry.ID]
		if !ok || weight > current.W {
			data.ExWeights[entry.ID] = MCPExWeightHint{W: weight, D: workout.D}
		}
	}
}

func findRoutineExercise(data *TrainingData, routineID, exerciseID string) (int, int, bool) {
	if routineID != "" {
		for i := range data.Routines {
			if data.Routines[i].ID != routineID {
				continue
			}
			for j := range data.Routines[i].Ex {
				if data.Routines[i].Ex[j].ID == exerciseID {
					return i, j, true
				}
			}
			return 0, 0, false
		}
		return 0, 0, false
	}
	matches := 0
	ri, ei := 0, 0
	for i := range data.Routines {
		for j := range data.Routines[i].Ex {
			if data.Routines[i].Ex[j].ID == exerciseID {
				matches++
				ri, ei = i, j
			}
		}
	}
	return ri, ei, matches == 1
}

// persistRoutineWorkingWeights writes the next prescription onto the source
// routine after a workout is saved. Exercise order, names, and unlogged lifts
// are left alone.
func persistRoutineWorkingWeights(data *TrainingData, workout MCPWorkout) {
	persistExWeightHints(data, workout)
	routineID := stringPointerValue(workout.RoutineID)
	for _, entry := range workout.Entries {
		ri, ei, ok := findRoutineExercise(data, routineID, entry.ID)
		if !ok {
			continue
		}
		cfg := data.Routines[ri].Ex[ei]
		prescription := NextProgression(*data, cfg, data.Routines[ri])
		updated := fillConfigWeight(*data, cfg, prescription)
		if floatPointerValue(updated.Weight) == 0 {
			if last := sessionWorkingWeight(entry, progressionConfigFromMCP(cfg)); last > 0 {
				updated.Weight = new(last)
			}
		}
		data.Routines[ri].Ex[ei] = updated
	}
}

func lastPerformance(view TrainingData, exerciseID string, fallback MCPExConfig) *MCPLastPerformance {
	for _, workout := range slices.Backward(view.Workouts) {
		for _, entry := range workout.Entries {
			if entry.ID != exerciseID {
				continue
			}
			working := workingSets(entry.Sets)
			hasDone := false
			sets := make([]string, 0, len(working))
			unit := view.Unit
			if unit == "" {
				unit = "lb"
			}
			for _, set := range working {
				if !set.Done {
					continue
				}
				hasDone = true
				if label := formatLoggedSet(set, unit); label != "" {
					sets = append(sets, label)
				}
			}
			if !hasDone {
				continue
			}
			session := readLoggedSession(entry, progressionConfigFromMCP(fallback))
			return &MCPLastPerformance{
				Date:   workout.D,
				Sets:   sets,
				Weight: session.weight,
				Hit:    session.ok,
			}
		}
	}
	return nil
}

func readLoggedSession(entry MCPWorkoutEntry, fallback progressionConfig) progressionSession {
	sessions := progressionSessions(TrainingData{Workouts: []MCPWorkout{{Entries: []MCPWorkoutEntry{entry}}}}, entry.ID, fallback)
	if len(sessions) == 0 {
		return progressionSession{}
	}
	return sessions[0]
}

func prescriptionDecision(kind string) string {
	switch kind {
	case "up":
		return "increased"
	case "hold":
		return "held"
	case "deload":
		return "deload"
	case "first":
		return "first"
	default:
		return "off"
	}
}

func nextTargetFrom(cfg MCPExConfig, prescription MCPProgression) MCPNextTarget {
	filled := applyProgressionToConfig(cfg, prescription)
	return MCPNextTarget{Sets: filled.Sets, Reps: filled.Reps, Weight: filled.Weight, Sec: filled.Sec}
}

// sessionPrescription is the coaching read: today's routine, last working
// sets, next target, and why. Warm-ups are excluded from the decision.
func sessionPrescription(view TrainingData, iso string) MCPSessionPrescription {
	today := trainingDay(view, iso)
	unit := view.Unit
	if unit == "" {
		unit = "lb"
	}
	out := MCPSessionPrescription{Iso: today.Iso, Unit: unit, Rest: today.Rest, RoutineID: today.RoutineID, Exercises: []MCPExercisePrescription{}}
	if today.Routine == nil {
		return out
	}
	routine := *today.Routine
	out.RoutineName = new(routine.Name)
	out.Policy = cloneString(routine.Prog)
	if out.Policy == nil {
		linear := "linear"
		out.Policy = &linear
	}
	out.Exercises = make([]MCPExercisePrescription, 0, len(routine.Ex))
	for _, cfg := range routine.Ex {
		prescription := NextProgression(view, cfg, routine)
		reason := ""
		if prescription.Reason != nil {
			reason = *prescription.Reason
		}
		next := nextTargetFrom(cfg, prescription)
		if floatPointerValue(next.Weight) == 0 {
			if last := lastLoggedWorkingWeight(view, cfg.ID); last > 0 {
				next.Weight = new(last)
			}
		}
		out.Exercises = append(out.Exercises, MCPExercisePrescription{
			ID: cfg.ID, Name: mcpExerciseName(cfg.ID, view.CustomEx),
			Last: lastPerformance(view, cfg.ID, cfg), Next: next,
			Decision: prescriptionDecision(prescription.Kind), Reason: reason,
		})
	}
	return out
}

func validateLoadedWorkingSets(workout MCPWorkout) error {
	for _, entry := range workout.Entries {
		cfg := MCPExConfig{ID: entry.ID}
		if entry.Target != nil {
			cfg = *entry.Target
		}
		if !isLoadedRepsExercise(cfg) {
			continue
		}
		for i, set := range workingSets(entry.Sets) {
			if !set.Done {
				continue
			}
			if set.W == nil || *set.W <= 0 {
				return fmt.Errorf("working set %d of %s needs a weight greater than 0", i+1, entry.ID)
			}
		}
	}
	return nil
}

func workoutVolumeOf(workout MCPWorkout) float64 {
	vol := 0.0
	for _, entry := range workout.Entries {
		for _, set := range workingSets(entry.Sets) {
			if !set.Done || set.W == nil || set.R == nil {
				continue
			}
			vol += *set.W * *set.R
		}
	}
	return vol
}

func resolveLogDate(d, tz *string, now time.Time) (string, error) {
	date := ""
	if d != nil {
		date = strings.TrimSpace(*d)
	}
	if date != "" && !isoDateRe.MatchString(date) {
		return "", errors.New("date must be YYYY-MM-DD")
	}
	if tz != nil && strings.TrimSpace(*tz) == "" {
		return "", errors.New("timezone must not be empty")
	}
	if date == "" {
		zone := ""
		if tz != nil {
			zone = *tz
		}
		date = todayISOLocal(zone, now)
	}
	return date, nil
}

func logExerciseSets(data *TrainingData, input MCPLogExerciseSetsInput, now time.Time) (MCPWorkout, MCPProgression, error) {
	exerciseID := strings.TrimSpace(input.ExerciseID)
	if exerciseID == "" {
		return MCPWorkout{}, MCPProgression{}, errors.New("exerciseId must not be empty")
	}
	if len(input.Sets) == 0 {
		return MCPWorkout{}, MCPProgression{}, errors.New("at least one working set is required")
	}
	date, err := resolveLogDate(input.D, input.Tz, now)
	if err != nil {
		return MCPWorkout{}, MCPProgression{}, err
	}
	routineID := ""
	if input.RoutineID != nil {
		routineID = strings.TrimSpace(*input.RoutineID)
		if routineID == "" {
			return MCPWorkout{}, MCPProgression{}, errors.New("routineId must not be empty")
		}
	}
	ri, ei, ok := findRoutineExercise(data, routineID, exerciseID)
	var cfg MCPExConfig
	var routine MCPRoutine
	if ok {
		routine = data.Routines[ri]
		cfg = cloneExConfig(routine.Ex[ei])
		routineID = routine.ID
	} else if routineID != "" {
		return MCPWorkout{}, MCPProgression{}, fmt.Errorf("exercise %q not found in routine %q", exerciseID, routineID)
	} else {
		cfg = MCPExConfig{ID: exerciseID}
	}
	if isLoadedRepsExercise(cfg) {
		for i, set := range input.Sets {
			if set.W == nil || *set.W <= 0 {
				return MCPWorkout{}, MCPProgression{}, fmt.Errorf("working set %d of %s needs a weight greater than 0", i+1, exerciseID)
			}
		}
	}
	logged := make([]MCPLoggedSet, 0, len(input.Sets))
	for _, set := range input.Sets {
		done := true
		if set.Done != nil {
			done = *set.Done
		}
		loggedSet := MCPLoggedSet{Done: done, W: cloneFloat(set.W), R: new(set.R)}
		logged = append(logged, loggedSet)
	}
	if cfg.Sets == nil {
		sets := float64(len(logged))
		cfg.Sets = &sets
	}
	if cfg.Reps == nil && len(logged) > 0 {
		cfg.Reps = new(input.Sets[0].R)
	}
	if floatPointerValue(cfg.Weight) == 0 {
		for _, set := range logged {
			if set.Done && set.W != nil && *set.W > 0 {
				cfg.Weight = cloneFloat(set.W)
				break
			}
		}
	}
	entry := MCPWorkoutEntry{ID: exerciseID, Sets: logged, Target: &cfg}
	workout, found := findSameDayWorkout(data.Workouts, date, routineID)
	if !found {
		name := "Workout"
		if routine.Name != "" {
			name = routine.Name
		}
		nowMs := now.UnixMilli()
		workout = MCPWorkout{
			ID: fmt.Sprintf("w%x", nowMs), D: date, Start: nowMs, End: nowMs,
			Name: name, Entries: []MCPWorkoutEntry{}, PRs: []string{},
		}
		if routineID != "" {
			workout.RoutineID = new(routineID)
		}
	}
	replaced := false
	for i := range workout.Entries {
		if workout.Entries[i].ID == exerciseID {
			workout.Entries[i] = entry
			replaced = true
			break
		}
	}
	if !replaced {
		workout.Entries = append(workout.Entries, entry)
	}
	workout.End = now.UnixMilli()
	workout.Vol = workoutVolumeOf(workout)
	replacedStored := false
	for i := range data.Workouts {
		if data.Workouts[i].ID == workout.ID {
			data.Workouts[i] = workout
			replacedStored = true
			break
		}
	}
	if !replacedStored {
		data.Workouts = append(data.Workouts, workout)
	}
	persistRoutineWorkingWeights(data, workout)
	next := NextProgression(*data, cfg, routine)
	return workout, next, nil
}

func findSameDayWorkout(workouts []MCPWorkout, date, routineID string) (MCPWorkout, bool) {
	for _, workout := range slices.Backward(workouts) {
		if workout.D != date {
			continue
		}
		if routineID == "" || stringPointerValue(workout.RoutineID) == routineID {
			return workout, true
		}
	}
	return MCPWorkout{}, false
}
