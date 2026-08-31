package store

import (
	"encoding/json/jsontext"
	"encoding/json/v2"
	"errors"
	"fmt"
	"strings"
	"sync"
	"testing"
	"time"
)

func TestUserRoundTrip(t *testing.T) {
	st := openTest(t)

	u := User{ID: "u1", Name: "alice", Created: "2026-08-23T10:00:00Z", Admin: true, InvitedBy: "root"}
	if err := st.CreateUser(u); err != nil {
		t.Fatalf("CreateUser: %v", err)
	}

	got, err := st.UserByID("u1")
	if err != nil {
		t.Fatalf("UserByID: %v", err)
	}
	if got == nil || got.Name != "alice" || !got.Admin || got.SV != 0 || got.Disabled {
		t.Fatalf("round trip mismatch: %+v", got)
	}

	if absent, err := st.UserByID("missing"); err != nil || absent != nil {
		t.Fatalf("absent user = (%v, %v), want (nil, nil)", absent, err)
	}

	all, err := st.Users()
	if err != nil || len(all) != 1 || all[0].ID != "u1" {
		t.Fatalf("Users() = %+v, %v", all, err)
	}

	if err := st.SetDisabled("u1", true); err != nil {
		t.Fatalf("SetDisabled: %v", err)
	}
	if u, _ := st.UserByID("u1"); u == nil || !u.Disabled {
		t.Fatalf("disabled flag not persisted")
	}

	sv, err := st.BumpSessionVersion("u1")
	if err != nil || sv != 1 {
		t.Fatalf("BumpSessionVersion = %d, %v; want 1, nil", sv, err)
	}
	sv, err = st.BumpSessionVersion("u1")
	if err != nil || sv != 2 {
		t.Fatalf("second bump = %d, %v; want 2, nil", sv, err)
	}
}

func TestCredentialRoundTrip(t *testing.T) {
	st := openTest(t)
	if err := st.CreateUser(User{ID: "u1"}); err != nil {
		t.Fatal(err)
	}

	c := Credential{ID: "cred1", UserID: "u1", PublicKey: "cHVia2V5", Counter: 0, Transports: `["internal","hybrid"]`}
	if err := st.UpsertCredential(c); err != nil {
		t.Fatalf("UpsertCredential: %v", err)
	}
	got, err := st.CredentialByID("cred1")
	if err != nil || got == nil {
		t.Fatalf("CredentialByID = (%v, %v)", got, err)
	}
	if got.UserID != "u1" || got.PublicKey != "cHVia2V5" || got.Counter != 0 || got.Transports != `["internal","hybrid"]` {
		t.Fatalf("credential mismatch: %+v", got)
	}

	c.Counter = 7
	if err := st.UpsertCredential(c); err != nil { // upsert overwrites
		t.Fatal(err)
	}
	if got, _ = st.CredentialByID("cred1"); got.Counter != 7 {
		t.Fatalf("upsert did not overwrite counter: %+v", got)
	}
	if err := st.UpdateCredentialCounter("cred1", 42); err != nil {
		t.Fatalf("UpdateCredentialCounter: %v", err)
	}
	if got, _ = st.CredentialByID("cred1"); got.Counter != 42 {
		t.Fatalf("counter update lost: %+v", got)
	}
	if c, err := st.CredentialByID("nope"); err != nil || c != nil {
		t.Fatalf("absent credential = (%v, %v)", c, err)
	}
}

func TestInviteRoundTrip(t *testing.T) {
	st := openTest(t)

	i := Invite{Code: "abc123", Note: "friend", CreatedBy: "admin", Created: "2026-08-23T10:00:00Z"}
	if err := st.UpsertInvite(i); err != nil {
		t.Fatalf("UpsertInvite: %v", err)
	}
	// Same code updates the row rather than erroring.
	i.UsedBy, i.UsedAt = "u9", "2026-08-24T09:00:00Z"
	if err := st.UpsertInvite(i); err != nil {
		t.Fatalf("UpsertInvite reuse: %v", err)
	}

	all, err := st.Invites()
	if err != nil || len(all) != 1 {
		t.Fatalf("Invites = %+v, %v", all, err)
	}
	if all[0].UsedBy != "u9" || all[0].Revoked {
		t.Fatalf("invite fields lost: %+v", all[0])
	}

	if err := st.DeleteInvite("abc123"); err != nil {
		t.Fatalf("DeleteInvite: %v", err)
	}
	if all, _ = st.Invites(); len(all) != 0 {
		t.Fatalf("invite not deleted: %+v", all)
	}
}

func TestPushSubRoundTrip(t *testing.T) {
	st := openTest(t)
	if err := st.CreateUser(User{ID: "u1"}); err != nil {
		t.Fatal(err)
	}

	sub := PushSub{Endpoint: "https://push.example/e1", UserID: "u1", P256DH: "k", Auth: "a", Created: "2026-08-23T10:00:00Z"}
	if err := st.UpsertPushSub(sub); err != nil {
		t.Fatalf("UpsertPushSub: %v", err)
	}
	// Same endpoint replaces the row instead of duplicating.
	sub.P256DH = "k2"
	if err := st.UpsertPushSub(sub); err != nil {
		t.Fatal(err)
	}

	subs, err := st.SubsByUser("u1")
	if err != nil || len(subs) != 1 || subs[0].P256DH != "k2" {
		t.Fatalf("SubsByUser = %+v, %v", subs, err)
	}

	if has, err := st.AnySubFor("u1"); err != nil || !has {
		t.Fatalf("AnySubFor = %v, %v", has, err)
	}
	if err := st.DeletePushSub(sub.Endpoint); err != nil {
		t.Fatalf("DeletePushSub: %v", err)
	}
	if has, err := st.AnySubFor("u1"); err != nil || has {
		t.Fatalf("AnySubFor after delete = %v, %v", has, err)
	}
	if _, err := st.AnySubFor("ghost"); err != nil {
		t.Fatalf("AnySubFor unknown user errored: %v", err)
	}
}

func TestChallengeLifecycle(t *testing.T) {
	st := openTest(t)
	now := time.Now().Unix()

	if err := st.PutChallenge("cid-live", []byte(`{"challenge":"abc"}`), now+300); err != nil {
		t.Fatalf("PutChallenge: %v", err)
	}
	payload, err := st.TakeChallenge("cid-live")
	if err != nil || string(payload) != `{"challenge":"abc"}` {
		t.Fatalf("TakeChallenge live = %q, %v", payload, err)
	}
	if again, err := st.TakeChallenge("cid-live"); err != nil || again != nil {
		t.Fatalf("replay TakeChallenge = %q, %v; row must be single use", again, err)
	}

	if err := st.PutChallenge("cid-expired", []byte(`old`), now-1); err != nil {
		t.Fatal(err)
	}
	if payload, err := st.TakeChallenge("cid-expired"); err != nil || payload != nil {
		t.Fatalf("expired TakeChallenge = %q, %v; want nil, nil", payload, err)
	}
	var n int
	if err := st.DB.QueryRow(`SELECT count(*) FROM challenges WHERE cid='cid-expired'`).Scan(&n); err != nil || n != 0 {
		t.Fatalf("expired challenge not deleted: n=%d err=%v", n, err)
	}

	if err := st.PutChallenge("cid-a", []byte(`a`), now-5); err != nil {
		t.Fatal(err)
	}
	if err := st.PutChallenge("cid-b", []byte(`b`), now+500); err != nil {
		t.Fatal(err)
	}
	if err := st.CleanExpiredChallenges(now); err != nil {
		t.Fatalf("CleanExpiredChallenges: %v", err)
	}
	if err := st.DB.QueryRow(`SELECT count(*) FROM challenges`).Scan(&n); err != nil || n != 1 {
		t.Fatalf("after clean want 1 challenge left, got %d, %v", n, err)
	}
}

func TestStateRoundTripAndNullDefault(t *testing.T) {
	st := openTest(t)
	if err := st.CreateUser(User{ID: "u1"}); err != nil {
		t.Fatal(err)
	}

	raw, err := st.ReadState("u1")
	if err != nil || string(raw) != "null" {
		t.Fatalf("ReadState empty = %s, %v; want null literal", raw, err)
	}

	doc := jsontext.Value(`{"week":{},"bodyweight":[80.5]}`)
	if err := st.WriteState("u1", doc); err != nil {
		t.Fatalf("WriteState: %v", err)
	}
	raw, err = st.ReadState("u1")
	if err != nil || string(raw) != string(doc) {
		t.Fatalf("ReadState = %s, %v", raw, err)
	}

	var updated string
	if err := st.DB.QueryRow(`SELECT updated_at FROM user_state WHERE user_id='u1'`).Scan(&updated); err != nil || updated == "" {
		t.Fatalf("updated_at not set: %q, %v", updated, err)
	}

	if raw, err := st.ReadState("ghost"); err != nil || string(raw) != "null" {
		t.Fatalf("ReadState unknown user = %s, %v", raw, err)
	}
}

func TestWriteStateRejectsMalformedJSON(t *testing.T) {
	st := openTest(t)
	if err := st.CreateUser(User{ID: "u1"}); err != nil {
		t.Fatal(err)
	}

	err := st.WriteState("u1", jsontext.Value(`{"unit":`))
	if err == nil || !strings.Contains(err.Error(), "invalid JSON") {
		t.Fatalf("WriteState malformed JSON error = %v", err)
	}
	if raw, err := st.ReadState("u1"); err != nil || string(raw) != "null" {
		t.Fatalf("malformed state was persisted: %s, %v", raw, err)
	}
}

func TestMutateStateStampsTS(t *testing.T) {
	st := openTest(t)
	if err := st.CreateUser(User{ID: "u1"}); err != nil {
		t.Fatal(err)
	}

	before := time.Now().UnixMilli()
	err := st.MutateState("u1", func(raw jsontext.Value) (jsontext.Value, error) {
		return jsontext.Value(`{"counter":1}`), nil
	})
	if err != nil {
		t.Fatalf("MutateState: %v", err)
	}

	raw, err := st.ReadState("u1")
	if err != nil {
		t.Fatal(err)
	}
	var doc map[string]any
	if err := json.Unmarshal(raw, &doc); err != nil {
		t.Fatalf("stored state invalid JSON: %s", raw)
	}
	ts, ok := doc["_ts"].(float64)
	if !ok || ts < float64(before) || ts > float64(time.Now().UnixMilli()+1000) {
		t.Fatalf("_ts missing or out of range: %v in %s", doc["_ts"], raw)
	}
	if doc["counter"] != float64(1) {
		t.Fatalf("mutation content lost: %s", raw)
	}
	firstRevision := int64(ts)
	if err := st.MutateState("u1", func(raw jsontext.Value) (jsontext.Value, error) {
		return raw, nil
	}); err != nil {
		t.Fatal(err)
	}
	raw, _ = st.ReadState("u1")
	var revisionDoc struct {
		Revision int64 `json:"_ts"`
	}
	if err := json.Unmarshal(raw, &revisionDoc); err != nil || revisionDoc.Revision <= firstRevision {
		t.Fatalf("revision did not advance monotonically: first=%d state=%s err=%v", firstRevision, raw, err)
	}

	// fn error aborts the write entirely.
	err = st.MutateState("u1", func(raw jsontext.Value) (jsontext.Value, error) {
		return nil, errors.New("reject")
	})
	if err == nil {
		t.Fatal("expected MutateState to propagate fn error")
	}
	raw, _ = st.ReadState("u1")
	var after map[string]any
	if err := json.Unmarshal(raw, &after); err != nil || after["counter"] != float64(1) || len(after) != 2 {
		t.Fatalf("state changed despite fn error: %s %v", raw, err)
	}
}

func TestMutateStateSerializesConcurrentCalls(t *testing.T) {
	st := openTest(t)
	if err := st.CreateUser(User{ID: "u1"}); err != nil {
		t.Fatal(err)
	}
	if err := st.WriteState("u1", jsontext.Value(`{"count":0}`)); err != nil {
		t.Fatal(err)
	}

	const goroutines = 20
	errs := make(chan error, goroutines)
	var wg sync.WaitGroup
	for range goroutines {
		wg.Go(func() {
			for range 5 { // 100 increments total
				err := st.MutateState("u1", func(raw jsontext.Value) (jsontext.Value, error) {
					var doc map[string]int
					if err := json.Unmarshal(raw, &doc); err != nil {
						return nil, err
					}
					return json.Marshal(map[string]int{"count": doc["count"] + 1})
				})
				if err != nil {
					errs <- fmt.Errorf("increment: %w", err)
					return
				}
			}
		})
	}
	wg.Wait()
	close(errs)
	for err := range errs {
		t.Fatal(err)
	}

	raw, err := st.ReadState("u1")
	if err != nil {
		t.Fatal(err)
	}
	var final map[string]any
	if err := json.Unmarshal(raw, &final); err != nil {
		t.Fatalf("bad final state: %s", raw)
	}
	if got := final["count"]; got != float64(goroutines*5) {
		t.Fatalf("lost updates: count = %v, want %d (state=%s)", got, goroutines*5, raw)
	}
}
