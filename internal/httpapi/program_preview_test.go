package httpapi

import (
	"context"
	"errors"
	"testing"
)

func mcpProgramContext(t *testing.T) context.Context {
	t.Helper()
	return context.WithValue(t.Context(), mcpCallerKey{}, "u1")
}

func TestProgramToolsSanitizeDiffAndPreserveState(t *testing.T) {
	e := newTestEnv(t)
	if err := e.st.WriteState("u1", []byte(`{"_ts":7,"note":"keep","routines":[{"id":"old","name":"Old","emoji":"","ex":[]}],"week":{"1":"old"}}`)); err != nil {
		t.Fatal(err)
	}
	id := "new"
	input := MCPSetProgramInput{
		Routines: []MCPRoutineInput{{ID: &id, Name: "New", Ex: []MCPExConfigInput{{ID: "bench", Sets: new(3.0), Reps: new(5.0), Weight: new(60.0)}}}},
		Week:     map[string]*string{"2": &id, "6": new("ghost")},
	}
	_, preview, err := e.srv.previewProgramTool(mcpProgramContext(t), nil, MCPPreviewProgramInput{
		Routines: input.Routines,
		Week:     input.Week,
		Replace:  input.Replace,
	})
	if err != nil {
		t.Fatalf("previewProgramTool: %v", err)
	}
	if preview.Revision == nil || *preview.Revision != 7 || len(preview.Sanitized.Routines) != 1 || len(preview.Diff.AddedRoutines) != 1 || len(preview.Diff.RemovedRoutines) != 0 {
		t.Fatalf("typed preview = %#v", preview)
	}
	if len(preview.Proposed.Week) != 1 || preview.Proposed.Week["2"] == nil || *preview.Proposed.Week["2"] != "new" {
		t.Fatalf("typed proposed week = %#v", preview.Proposed.Week)
	}

	_, output, err := e.srv.setProgramTool(mcpProgramContext(t), nil, input)
	if err != nil || !output.OK || len(output.Routines) != 2 || output.Revision <= 7 {
		t.Fatalf("setProgramTool err=%v output=%#v", err, output)
	}
	state := e.getState("cookie")
	if state["note"] != "keep" {
		t.Fatalf("unrelated state lost: %#v", state)
	}
}

func TestTypedProgramApplyRejectsStaleRevision(t *testing.T) {
	e := newTestEnv(t)
	if err := e.st.WriteState("u1", []byte(`{"_ts":7,"routines":[]}`)); err != nil {
		t.Fatal(err)
	}
	stale := int64(6)
	_, _, err := e.srv.setProgramTool(mcpProgramContext(t), nil, MCPSetProgramInput{
		Routines:         []MCPRoutineInput{{Name: "Push"}},
		ExpectedRevision: &stale,
	})
	if !errors.Is(err, ErrTrainingDataRevisionConflict) {
		t.Fatalf("stale setProgramTool error = %v", err)
	}
	err = NewTrainingDataRepository(e.st).Mutate("u1", &stale, func(*TrainingData) error { return nil })
	if !errors.Is(err, ErrTrainingDataRevisionConflict) {
		t.Fatalf("repository conflict = %v", err)
	}
}

func TestTypedProgramFreshPreviewProvidesUsableZeroRevision(t *testing.T) {
	e := newTestEnv(t)
	input := MCPPreviewProgramInput{Routines: []MCPRoutineInput{{Name: "First"}}}
	_, preview, err := e.srv.previewProgramTool(mcpProgramContext(t), nil, input)
	if err != nil || preview.Revision == nil || *preview.Revision != 0 {
		t.Fatalf("fresh preview err=%v preview=%#v", err, preview)
	}
	_, output, err := e.srv.setProgramTool(mcpProgramContext(t), nil, MCPSetProgramInput{
		Routines: input.Routines, ExpectedRevision: preview.Revision,
	})
	if err != nil || !output.OK || output.Revision <= 0 {
		t.Fatalf("fresh apply err=%v output=%#v", err, output)
	}
}

func TestTypedProgramReplacePrunesReferencesButPreservesRest(t *testing.T) {
	e := newTestEnv(t)
	if err := e.st.WriteState("u1", []byte(`{"routines":[{"id":"old","name":"Old","emoji":"","ex":[]}],"week":{"1":"old"},"dayPlan":{"2026-08-28":"old","2026-08-29":"rest"}}`)); err != nil {
		t.Fatal(err)
	}
	if _, _, err := e.srv.setProgramTool(mcpProgramContext(t), nil, MCPSetProgramInput{
		Routines: []MCPRoutineInput{{Name: "New"}},
		Replace:  true,
	}); err != nil {
		t.Fatalf("replace: %v", err)
	}
	data, err := NewTrainingDataRepository(e.st).Load("u1")
	if err != nil {
		t.Fatal(err)
	}
	if len(data.Routines) != 1 || len(data.Week) != 0 || len(data.DayPlan) != 1 || data.DayPlan["2026-08-29"] == nil || *data.DayPlan["2026-08-29"] != "rest" {
		t.Fatalf("training data = %#v", data)
	}
}
