package store

import (
	"path/filepath"
	"testing"
)

func openTest(t *testing.T) *Store {
	t.Helper()
	st, err := Open(t.TempDir())
	if err != nil {
		t.Fatalf("Open: %v", err)
	}
	t.Cleanup(func() { _ = st.DB.Close() })
	return st
}

func TestOpenCreatesTables(t *testing.T) {
	st := openTest(t)

	want := []string{"users", "credentials", "invites", "push_subs", "challenges", "user_state"}
	for _, table := range want {
		var name string
		err := st.DB.QueryRow(
			`SELECT name FROM sqlite_master WHERE type='table' AND name=?`, table,
		).Scan(&name)
		if err != nil {
			t.Errorf("table %q not found: %v", table, err)
		}
	}

	rows, err := st.DB.Query(`SELECT name FROM pragma_table_info('users') WHERE name='last_reminder'`)
	if err != nil {
		t.Fatalf("pragma_table_info: %v", err)
	}
	defer func() { _ = rows.Close() }()
	if !rows.Next() {
		t.Error("users.last_reminder column missing")
	}
}

func TestOpenCreatesMaintenanceIndexes(t *testing.T) {
	st := openTest(t)

	want := []string{"push_subs_user_id", "challenges_exp", "oauth_codes_exp", "oauth_refresh_exp"}
	for _, index := range want {
		var name string
		if err := st.DB.QueryRow(
			`SELECT name FROM sqlite_master WHERE type = 'index' AND name = ?`, index,
		).Scan(&name); err != nil {
			t.Errorf("index %q not found: %v", index, err)
		}
	}
}

func TestSecondOpenIsNoOp(t *testing.T) {
	dir := t.TempDir()
	st1, err := Open(dir)
	if err != nil {
		t.Fatalf("first Open: %v", err)
	}
	defer func() { _ = st1.DB.Close() }()
	if _, err := st1.DB.Exec(`INSERT INTO users (id, name, created) VALUES ('u1', 'alice', '2026-01-01')`); err != nil {
		t.Fatalf("seed user: %v", err)
	}

	st2, err := Open(dir)
	if err != nil {
		t.Fatalf("second Open: %v", err)
	}
	defer func() { _ = st2.DB.Close() }()

	var name string
	if err := st2.DB.QueryRow(`SELECT name FROM users WHERE id='u1'`).Scan(&name); err != nil || name != "alice" {
		t.Fatalf("data lost across reopen: name=%q err=%v", name, err)
	}
	var count int
	if err := st2.DB.QueryRow(`SELECT count(*) FROM goose_db_version`).Scan(&count); err != nil {
		t.Fatalf("goose version table missing: %v", err)
	}
	if count < 1 {
		t.Fatalf("expected at least one recorded migration version, got %d", count)
	}
}

func TestForeignKeysEnforced(t *testing.T) {
	st := openTest(t)

	if _, err := st.DB.Exec(
		`INSERT INTO credentials (id, user_id, public_key) VALUES ('c1', 'missing-user', 'pk')`,
	); err == nil {
		t.Fatal("inserting credential for unknown user should fail with foreign_keys=ON")
	}

	if _, err := st.DB.Exec(`INSERT INTO users (id, name, created) VALUES ('u1', 'alice', '2026-01-01')`); err != nil {
		t.Fatalf("seed user: %v", err)
	}
	if _, err := st.DB.Exec(
		`INSERT INTO credentials (id, user_id, public_key) VALUES ('c1', 'u1', 'pk')`,
	); err != nil {
		t.Fatalf("valid insert rejected: %v", err)
	}
}

func TestOpenCreatesDataDir(t *testing.T) {
	dir := t.TempDir()
	nested := filepath.Join(dir, "a", "b")
	st, err := Open(nested)
	if err != nil {
		t.Fatalf("Open nested dir: %v", err)
	}
	defer func() { _ = st.DB.Close() }()
	var n int
	if err := st.DB.QueryRow(`SELECT count(*) FROM users`).Scan(&n); err != nil {
		t.Fatalf("query after nested Open: %v", err)
	}
}
