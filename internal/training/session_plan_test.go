package training

import (
	"encoding/json/jsontext"
	"testing"
)

func TestSessionPlanningSnapshotsSurviveUnrelatedMutation(t *testing.T) {
	st, repo := openTrainingRepositoryTest(t)
	plan := `{"sourceId":"original","sourceName":"Synthetic template","equipment":["stationary bike"],"budgetMin":20,"restSec":45,"rows":[{"original":{"id":"3666","sets":1,"min":40,"speed":7},"planned":{"id":"2138","sets":1,"min":10,"speed":0}}]}`
	fixture := `{"unit":"lb","routines":[{"id":"copy","name":"Hotel bike","ex":[{"id":"2138","sets":1,"min":10}],"sessionPlan":` + plan + `}],"workouts":[{"id":"logged","d":"2026-01-01","name":"Hotel bike","entries":[],"sessionPlan":` + plan + `}]}`
	if err := st.WriteState("u1", jsontext.Value(fixture)); err != nil {
		t.Fatal(err)
	}
	if err := repo.Mutate("u1", nil, func(data *TrainingData) error {
		data.Unit = "kg"
		return nil
	}); err != nil {
		t.Fatal(err)
	}
	data, err := repo.Load("u1")
	if err != nil {
		t.Fatal(err)
	}
	for _, snapshot := range []*MCPSessionPlan{data.Routines[0].SessionPlan, data.Workouts[0].SessionPlan} {
		if snapshot == nil || snapshot.SourceID != "original" || len(snapshot.Rows) != 1 || snapshot.Rows[0].Original.Min == nil || *snapshot.Rows[0].Original.Min != 40 || snapshot.Rows[0].Planned.Min == nil || *snapshot.Rows[0].Planned.Min != 10 {
			t.Fatalf("planning snapshot changed or lost: %+v", snapshot)
		}
	}
	cloned := cloneRoutine(data.Routines[0])
	cloned.SessionPlan.Equipment[0] = "changed"
	*cloned.SessionPlan.Rows[0].Original.Min = 1
	*cloned.SessionPlan.Rows[0].Planned.Min = 2
	if data.Routines[0].SessionPlan.Equipment[0] != "stationary bike" || *data.Routines[0].SessionPlan.Rows[0].Original.Min != 40 || *data.Routines[0].SessionPlan.Rows[0].Planned.Min != 10 {
		t.Fatal("prescribing a cloned routine mutated its accepted snapshot")
	}
}
