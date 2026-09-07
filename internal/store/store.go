// Package store opens the SQLite database and runs embedded goose migrations.
package store

import (
	"database/sql"
	"embed"
	"encoding/json/jsontext"
	"errors"
	"fmt"
	"os"
	"path/filepath"

	"github.com/pressly/goose/v3"

	_ "modernc.org/sqlite"
)

//go:embed migrations/*.sql
var migrationsFS embed.FS

// Store wraps the SQLite handle shared by all typed query files.
type StateBackend interface {
	ReadState(string) (jsontext.Value, error)
	WriteState(string, jsontext.Value) error
	MutateState(string, func(jsontext.Value) (jsontext.Value, error)) error
}
type Store struct {
	DB       *sql.DB
	Training StateBackend
}

// Open opens (and migrates) <dataDir>/opengym.db, creating dataDir first.
func Open(dataDir string) (*Store, error) {
	return OpenAtPath(filepath.Join(dataDir, "opengym.db"))
}

// OpenAtPath opens the SQLite database at dbPath — parent directory created
// on demand — with foreign keys and a busy timeout enabled on every pooled
// connection, then applies migrations. It lets an explicit DB_PATH override
// reach the store from main.
func OpenAtPath(dbPath string) (*Store, error) {
	if dir := filepath.Dir(dbPath); dir != "" {
		if err := os.MkdirAll(dir, 0o755); err != nil {
			return nil, fmt.Errorf("store: mkdir %s: %w", dir, err)
		}
	}

	dsn := "file:" + dbPath +
		"?_pragma=foreign_keys(1)&_pragma=busy_timeout(5000)&_txlock=immediate"
	db, err := sql.Open("sqlite", dsn)
	if err != nil {
		return nil, fmt.Errorf("store: open db: %w", err)
	}

	// WAL lets readers keep their committed snapshot while a state mutation
	// writes. Set this once before migrations; journal mode persists in the file.
	var journalMode string
	if err := db.QueryRow("PRAGMA journal_mode=WAL").Scan(&journalMode); err != nil {
		return nil, fmt.Errorf("store: enable WAL: %w", errors.Join(err, db.Close()))
	}
	if journalMode != "wal" {
		return nil, errors.Join(fmt.Errorf("store: expected WAL journal mode, got %q", journalMode), db.Close())
	}

	goose.SetBaseFS(migrationsFS)
	if err := goose.SetDialect("sqlite3"); err != nil {
		return nil, fmt.Errorf("store: goose dialect: %w", errors.Join(err, db.Close()))
	}
	if err := goose.Up(db, "migrations"); err != nil {
		return nil, fmt.Errorf("store: migrate: %w", errors.Join(err, db.Close()))
	}
	goose.SetBaseFS(nil)

	return &Store{DB: db}, nil
}
