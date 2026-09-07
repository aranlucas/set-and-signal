package store

import (
	"context"
	"encoding/json/jsontext"
	"testing"
)

func TestUserSummariesPreserveListSemantics(t *testing.T) {
	st := openTest(t)
	for _, user := range []User{
		{ID: "u1", Name: "Alice", Created: "2026-01-01", Admin: true},
		{ID: "u2", Name: "Bob", Created: "2026-01-02", Disabled: true},
		{ID: "u3", Created: "2026-01-03"},
	} {
		if err := st.CreateUser(user); err != nil {
			t.Fatal(err)
		}
	}
	// Last means stored order, not the maximum date. Unknown data stays in SQLite.
	if err := st.WriteState("u1", jsontext.Value(`{"workouts":[{"d":"2026-09-01"},{"d":"2026-08-01"}],"_ts":123,"future":{"id":9007199254740993}}`)); err != nil {
		t.Fatal(err)
	}
	if err := st.WriteState("u2", jsontext.Value(`{"workouts":null,"_ts":0}`)); err != nil {
		t.Fatal(err)
	}
	for _, endpoint := range []string{"https://push.example/one", "https://push.example/two"} {
		if err := st.UpsertPushSub(PushSub{Endpoint: endpoint, UserID: "u1"}); err != nil {
			t.Fatal(err)
		}
	}
	rows, err := st.UserSummaries(context.Background())
	if err != nil {
		t.Fatal(err)
	}
	if len(rows) != 3 {
		t.Fatalf("subscription join duplicated users: %+v", rows)
	}
	first := rows[0]
	if first.ID != "u1" || !first.Admin || !first.HasPush || first.Workouts != 2 ||
		string(first.LastWorkout) != `"2026-08-01"` || string(first.LastSync) != "123" {
		t.Fatalf("unexpected summary: %+v", first)
	}
	for _, row := range rows[1:] {
		if row.Workouts != 0 || row.HasPush || string(row.LastWorkout) != "null" || string(row.LastSync) != "null" {
			t.Fatalf("unexpected empty summary: %+v", row)
		}
	}
	if !rows[1].Disabled {
		t.Fatal("disabled user disappeared")
	}
	ctx, cancel := context.WithCancel(context.Background())
	cancel()
	if _, err := st.UserSummaries(ctx); err == nil {
		t.Fatal("ignored request cancellation")
	}
}

func TestUserSummariesRejectNonObjectState(t *testing.T) {
	st := openTest(t)
	if err := st.CreateUser(User{ID: "u1"}); err != nil {
		t.Fatal(err)
	}
	if err := st.WriteState("u1", jsontext.Value(`[]`)); err != nil {
		t.Fatal(err)
	}
	if _, err := st.UserSummaries(context.Background()); err == nil {
		t.Fatal("non-object state accepted")
	}
}
