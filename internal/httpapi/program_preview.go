package httpapi

import (
	"errors"
	"fmt"
	"reflect"
	"regexp"
	"slices"
	"strconv"
	"strings"

	"github.com/aranlucas/set-and-signal/internal/sanitize"
)

type typedPreparedProgram struct {
	routines []MCPRoutine
	week     map[string]*string
	hasWeek  bool
}

func prepareTypedProgram(routines []MCPRoutineInput, week map[string]*string) (typedPreparedProgram, error) {
	prepared := typedPreparedProgram{}
	if len(routines) == 0 {
		return prepared, errors.New("routines array required")
	}
	if len(routines) > 21 {
		return prepared, errors.New("at most 21 routines")
	}
	seen := map[string]bool{}
	for i, input := range routines {
		routine, ok := cleanTypedRoutine(input)
		if !ok {
			return prepared, fmt.Errorf("routine %d needs a name (and a valid id)", i)
		}
		if seen[routine.ID] {
			return prepared, fmt.Errorf("duplicate routine id %s", routine.ID)
		}
		seen[routine.ID] = true
		prepared.routines = append(prepared.routines, routine)
	}
	if week == nil {
		return prepared, nil
	}
	prepared.hasWeek, prepared.week = true, map[string]*string{}
	for day, routineID := range week {
		n, err := strconv.Atoi(day)
		if err != nil || n < 0 || n > 6 || strconv.Itoa(n) != day {
			return typedPreparedProgram{}, errors.New("week keys must be 0–6 (0=Sun)")
		}
		if routineID != nil {
			if jsLen(*routineID) > 40 {
				return typedPreparedProgram{}, errors.New("week values must be routine ids or null")
			}
			prepared.week[day] = new(*routineID)
		}
	}
	return prepared, nil
}

var programIDRe = regexp.MustCompile(`[^\w-]`)

func cleanTypedRoutine(input MCPRoutineInput) (MCPRoutine, bool) {
	name := programTrim(input.Name)
	id := ""
	if input.ID != nil && *input.ID != "" {
		id = programIDRe.ReplaceAllString(*input.ID, "")
	} else {
		id = nonWordRe.ReplaceAllString(strings.ToLower(name), "")
	}
	if id == "" || name == "" {
		return MCPRoutine{}, false
	}
	routine := MCPRoutine{ID: programSlice(id, 40), Name: programSlice(name, 60), Emoji: programSlice(inputString(input.Emoji), 24), Ex: []MCPExConfig{}}
	if input.Prog != nil && isProgramPolicy(*input.Prog) {
		routine.Prog = new(*input.Prog)
	}
	for _, raw := range input.Ex {
		if entry, ok := cleanTypedEntry(raw); ok {
			routine.Ex = append(routine.Ex, entry)
			if len(routine.Ex) == 30 {
				break
			}
		}
	}
	return routine, true
}

func cleanTypedEntry(input MCPExConfigInput) (MCPExConfig, bool) {
	id := programTrim(input.ID)
	if id == "" || jsLen(id) > 40 {
		return MCPExConfig{}, false
	}
	entry := MCPExConfig{ID: id, Sets: cleanTypedNumber(input.Sets, 1, 12), Reps: cleanTypedNumber(input.Reps, 1, 500), Weight: cleanTypedNumber(input.Weight, 0, 1000), Sec: cleanTypedNumber(input.Sec, 1, 7200), Min: cleanTypedNumber(input.Min, 1, 600), Speed: cleanTypedNumber(input.Speed, 0, 80), Inc: cleanTypedNumber(input.Inc, 0, 200), RepsMin: cleanTypedNumber(input.RepsMin, 1, 500), RepsMax: cleanTypedNumber(input.RepsMax, 1, 500)}
	if input.Mode != nil && (*input.Mode == "time" || *input.Mode == "reps") {
		entry.Mode = new(*input.Mode)
	}
	if input.Bodyweight != nil && *input.Bodyweight {
		entry.Bodyweight = new(true)
	}
	if input.Side != nil && *input.Side {
		entry.Side = new(true)
	}
	if input.Prog != nil && isProgramPolicy(*input.Prog) {
		entry.Prog = new(*input.Prog)
	}
	return entry, true
}

func cleanTypedNumber(value *float64, lo, hi float64) *float64 {
	if value == nil {
		return nil
	}
	return sanitize.Num(*value, lo, hi)
}

func isProgramPolicy(value string) bool {
	return slices.Contains(sanitize.Policies, value)
}

func inputString(value *string) string {
	if value == nil {
		return ""
	}
	return *value
}

func programTrim(value string) string {
	return strings.TrimFunc(value, func(r rune) bool {
		switch r {
		case '\t', '\n', '\v', '\f', '\r', ' ', 0x00A0, 0x1680, 0x2028, 0x2029, 0x202F, 0x205F, 0x3000, 0xFEFF:
			return true
		}
		return r >= 0x2000 && r <= 0x200A
	})
}
func programSlice(value string, limit int) string { return jsSlice(value, limit) }

func cloneMCPRoutines(value []MCPRoutine) []MCPRoutine {
	return slices.Clone(value)
}

func cloneMCPWeek(week map[string]*string) map[string]*string {
	if week == nil {
		return nil
	}
	out := make(map[string]*string, len(week))
	for day, value := range week {
		if value != nil {
			out[day] = new(*value)
		} else {
			out[day] = nil
		}
	}
	return out
}

func typedApplyProgram(current []MCPRoutine, week map[string]*string, prepared typedPreparedProgram, replace bool) typedPreparedProgram {
	out := typedPreparedProgram{routines: cloneMCPRoutines(current), week: cloneMCPWeek(week), hasWeek: prepared.hasWeek}
	if replace {
		out.routines = []MCPRoutine{}
		out.week = map[string]*string{}
	}
	for _, routine := range prepared.routines {
		replaced := false
		for i := range out.routines {
			if out.routines[i].ID == routine.ID {
				out.routines[i], replaced = routine, true
				break
			}
		}
		if !replaced {
			out.routines = append(out.routines, routine)
		}
	}
	if prepared.hasWeek {
		out.week = cloneMCPWeek(prepared.week)
		ids := map[string]bool{}
		for _, routine := range out.routines {
			ids[routine.ID] = true
		}
		for day, id := range out.week {
			if id != nil && !ids[*id] {
				delete(out.week, day)
			}
		}
	}
	return out
}

func (s *Server) mutateTypedProgram(uid string, prepared typedPreparedProgram, replace bool, expectedRevision *int64) error {
	return NewTrainingDataRepository(s.ST).Mutate(uid, expectedRevision, func(data *TrainingData) error {
		applied := typedApplyProgram(data.Routines, data.Week, prepared, replace)
		data.Routines = applied.routines
		data.Week = applied.week
		if replace {
			for day, routineID := range data.DayPlan {
				if routineID != nil && *routineID != "rest" {
					delete(data.DayPlan, day)
				}
			}
		}
		return nil
	})
}

func routinesToInput(routines []MCPRoutine) []MCPRoutineInput {
	out := make([]MCPRoutineInput, 0, len(routines))
	for _, routine := range routines {
		input := MCPRoutineInput{ID: new(routine.ID), Name: routine.Name, Emoji: new(routine.Emoji), Ex: slices.Clone(routine.Ex)}
		if routine.Prog != nil {
			input.Prog = new(*routine.Prog)
		}
		out = append(out, input)
	}
	return out
}

func typedProgramDiff(before, after MCPProgramState) MCPProgramDiff {
	old := make(map[string]MCPRoutine, len(before.Routines))
	current := make(map[string]MCPRoutine, len(after.Routines))
	for _, routine := range before.Routines {
		old[routine.ID] = routine
	}
	for _, routine := range after.Routines {
		current[routine.ID] = routine
	}
	ids := make([]string, 0, len(old)+len(current))
	seen := map[string]bool{}
	for id := range old {
		ids = append(ids, id)
		seen[id] = true
	}
	for id := range current {
		if !seen[id] {
			ids = append(ids, id)
		}
	}
	slices.Sort(ids)
	diff := MCPProgramDiff{AddedRoutines: []MCPRoutineChange{}, UpdatedRoutines: []MCPRoutineUpdate{}, RemovedRoutines: []MCPRoutineChange{}, ScheduleChanges: []MCPScheduleChange{}}
	for _, id := range ids {
		beforeRoutine, hadBefore := old[id]
		afterRoutine, hadAfter := current[id]
		switch {
		case !hadBefore && hadAfter:
			diff.AddedRoutines = append(diff.AddedRoutines, MCPRoutineChange{ID: id, Routine: afterRoutine})
		case hadBefore && !hadAfter:
			diff.RemovedRoutines = append(diff.RemovedRoutines, MCPRoutineChange{ID: id, Routine: beforeRoutine})
		case !reflect.DeepEqual(beforeRoutine, afterRoutine):
			beforeCopy, afterCopy := beforeRoutine, afterRoutine
			diff.UpdatedRoutines = append(diff.UpdatedRoutines, MCPRoutineUpdate{ID: id, Before: &beforeCopy, After: &afterCopy})
		}
	}
	weekKeys := make(map[string]bool, len(before.Week)+len(after.Week))
	for day := range before.Week {
		weekKeys[day] = true
	}
	for day := range after.Week {
		weekKeys[day] = true
	}
	days := make([]string, 0, len(weekKeys))
	for day := range weekKeys {
		days = append(days, day)
	}
	slices.Sort(days)
	for _, day := range days {
		beforeID, afterID := weekValue(before.Week, day), weekValue(after.Week, day)
		if beforeID == afterID {
			continue
		}
		diff.ScheduleChanges = append(diff.ScheduleChanges, MCPScheduleChange{Day: day, Before: beforeID, After: afterID})
	}
	diff.Summary = fmt.Sprintf("%d routines added, %d updated, %d removed, %d schedule changes", len(diff.AddedRoutines), len(diff.UpdatedRoutines), len(diff.RemovedRoutines), len(diff.ScheduleChanges))
	return diff
}

func weekValue(week map[string]*string, day string) *string {
	value, ok := week[day]
	if !ok || value == nil {
		return nil
	}
	return new(*value)
}
