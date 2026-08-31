package main

import (
	"database/sql"
	"encoding/json/v2"
	"errors"
	"os"
	"path/filepath"
	"reflect"
	"testing"
)

// tableCounts reads every imported table's row count.
func tableCounts(t *testing.T, dbPath string) map[string]int {
	t.Helper()
	db, err := sql.Open("sqlite", dbPath)
	if err != nil {
		t.Fatal(err)
	}
	defer db.Close() //nolint:errcheck // test teardown

	counts := make(map[string]int)
	for _, table := range []string{"users", "credentials", "push_subs", "invites", "user_state"} {
		var n int
		if err := db.QueryRow(`SELECT count(*) FROM ` + table).Scan(&n); err != nil {
			t.Fatalf("count %s: %v", table, err)
		}
		counts[table] = n
	}
	return counts
}

// TestImportRoundTripAndIdempotency imports the committed fixtures twice and
// asserts the second run changes nothing — same counts, same preserved values.
func TestImportRoundTripAndIdempotency(t *testing.T) {
	dbPath := filepath.Join(t.TempDir(), "imported.db")

	first, err := importData("testdata", dbPath)
	if err != nil {
		t.Fatalf("first import: %v (counts %s)", err, first)
	}
	want := Counts{Users: 2, Creds: 2, Subs: 1, Tokens: 0, Invites: 2, States: 1}
	if first != want {
		t.Errorf("first import counts: got %+v want %+v", first, want)
	}
	afterFirst := tableCounts(t, dbPath)

	second, err := importData("testdata", dbPath)
	if err != nil {
		t.Fatalf("re-import: %v", err)
	}
	if second != want {
		t.Errorf("re-import counts not stable: got %+v want %+v", second, want)
	}
	after := tableCounts(t, dbPath)
	for table, n := range afterFirst {
		if after[table] != n {
			t.Errorf("%s row count changed on re-import: %d -> %d", table, n, after[table])
		}
	}

	assertPreserved(t, dbPath)
}

// assertPreserved checks that ids, counters, hashes, flags and state blobs
// survived the trip byte-for-byte where it matters.
func assertPreserved(t *testing.T, dbPath string) {
	t.Helper()
	db, err := sql.Open("sqlite", dbPath)
	if err != nil {
		t.Fatal(err)
	}
	defer db.Close() //nolint:errcheck // test teardown

	var name, created string
	var disabled, admin int
	var sv int
	var invitedBy, lastReminder sql.NullString
	if err := db.QueryRow(
		`SELECT name, created, disabled, sv, admin, invited_by, last_reminder FROM users WHERE id = 'u2'`,
	).Scan(&name, &created, &disabled, &sv, &admin, &invitedBy, &lastReminder); err != nil {
		t.Fatalf("user u2: %v", err)
	}
	if name != "Bob" || created != "2025-02-03T04:05:06Z" || disabled != 1 || sv != 3 ||
		admin != 0 || invitedBy.String != "FAMILY1" || lastReminder.String != "" {
		t.Errorf("u2 fields not preserved: %+v", map[string]any{
			"name": name, "created": created, "disabled": disabled, "sv": sv,
			"admin": admin, "invitedBy": invitedBy.String, "lastReminder": lastReminder.String,
		})
	}

	var counter int
	var pubKey, transports string
	if err := db.QueryRow(
		`SELECT counter, public_key, transports FROM credentials WHERE id = 'cred-1'`,
	).Scan(&counter, &pubKey, &transports); err != nil {
		t.Fatalf("cred-1: %v", err)
	}
	if counter != 42 || pubKey != "pQECAyYgASFYIAAAcHJpdmF0ZWtleQ" || transports != `["internal","hybrid"]` {
		t.Errorf("cred-1 not preserved: counter=%d key=%q transports=%q", counter, pubKey, transports)
	}

	var usedBy string
	var revoked int
	if err := db.QueryRow(`SELECT coalesce(used_by,''), revoked FROM invites WHERE code = 'SPARE'`).Scan(&usedBy, &revoked); err != nil {
		t.Fatalf("invite SPARE: %v", err)
	}
	if usedBy != "" || revoked != 1 {
		t.Errorf("revoked invite mutated: usedBy=%q revoked=%d", usedBy, revoked)
	}

	var blob string
	if err := db.QueryRow(`SELECT state FROM user_state WHERE user_id = 'u1'`).Scan(&blob); err != nil {
		t.Fatalf("state u1: %v", err)
	}
	raw, err := os.ReadFile(filepath.Join("testdata", "state-u1.json"))
	if err != nil {
		t.Fatal(err)
	}
	var imported, fixture any
	if json.Unmarshal([]byte(blob), &imported) != nil || json.Unmarshal(raw, &fixture) != nil ||
		!reflect.DeepEqual(imported, fixture) {
		t.Error("imported state blob differs from fixture")
	}
}

// TestPartialFailureExitsNonZero verifies a broken record doesn't abort the
// run but is reported: other rows land, errors are counted.
func TestPartialFailureExitsNonZero(t *testing.T) {
	dir := t.TempDir()
	write := func(name, content string) {
		t.Helper()
		if err := os.WriteFile(filepath.Join(dir, name), []byte(content), 0o644); err != nil {
			t.Fatal(err)
		}
	}
	write("db.json", `{
		"users": [{"id":"u1","name":"Ok"}],
		"creds": [{"id":"orphan","userId":"ghost","publicKey":"k","counter":0,"transports":[]}],
		"tokens": []
	}`)
	write("state-ghost.json", `{}`)

	counts, err := importData(dir, filepath.Join(dir, "out.db"))
	if err == nil {
		t.Fatal("expected aggregated error for orphan credential + unknown-user state")
	}
	if counts.Errors != 2 {
		t.Errorf("errors = %d, want 2", counts.Errors)
	}
	if counts.Users != 1 {
		t.Errorf("good user should still import: %+v", counts)
	}
	if counts.Creds != 0 || counts.States != 0 {
		t.Errorf("failed rows must not count as imported: %+v", counts)
	}

	// Missing db.json is a hard usage error — and must not create the
	// target database as a side effect.
	badTarget := filepath.Join(t.TempDir(), "x.db")
	if _, err := importData(t.TempDir(), badTarget); err == nil {
		t.Error("missing db.json must error")
	} else if !errors.Is(err, os.ErrNotExist) && !os.IsNotExist(errors.Unwrap(err)) {
		t.Logf("note: error = %v", err)
	}
	if _, statErr := os.Stat(badTarget); !os.IsNotExist(statErr) {
		t.Errorf("bad -data dir must not leave a database at %s", badTarget)
	}
}
