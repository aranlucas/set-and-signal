// Package store opens the SQLite database and runs embedded goose migrations.
package store

import (
	"database/sql"
	"embed"
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
type Store struct {
	DB *sql.DB
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

	goose.SetBaseFS(migrationsFS)
	if err := goose.SetDialect("sqlite3"); err != nil {
		return nil, fmt.Errorf("store: goose dialect: %w", errors.Join(err, db.Close()))
	}
	if err := goose.Up(db, "migrations"); err != nil {
		return nil, fmt.Errorf("store: migrate: %w", errors.Join(err, db.Close()))
	}
	goose.SetBaseFS(nil)

	// Belt-and-braces for connections acquired outside the DSN defaults.
	for _, pragma := range []string{"PRAGMA foreign_keys=ON", "PRAGMA busy_timeout=5000"} {
		if _, err := db.Exec(pragma); err != nil {
			return nil, fmt.Errorf("store: %s: %w", pragma, errors.Join(err, db.Close()))
		}
	}
	return &Store{DB: db}, nil
}
