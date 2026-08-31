package store

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"time"
)

// PutChallenge stores a WebAuthn challenge payload with a unix-second expiry.
func (s *Store) PutChallenge(cid string, payload []byte, expUnix int64) error {
	if _, err := s.DB.Exec(
		`INSERT INTO challenges (cid, payload, exp) VALUES (?, ?, ?)
		 ON CONFLICT(cid) DO UPDATE SET payload = excluded.payload, exp = excluded.exp`,
		cid, string(payload), expUnix,
	); err != nil {
		return fmt.Errorf("store: put challenge %s: %w", cid, err)
	}
	return nil
}

// TakeChallenge atomically consumes the challenge row: it is deleted first and
// the payload returned only when it had not expired. nil, nil for absent or
// expired challenges — single use, like the upstream in-memory map delete.
func (s *Store) TakeChallenge(cid string) ([]byte, error) {
	tx, err := s.DB.BeginTx(context.Background(), nil)
	if err != nil {
		return nil, fmt.Errorf("store: take challenge %s begin: %w", cid, err)
	}

	var payload string
	var exp int64
	err = tx.QueryRow(`SELECT payload, exp FROM challenges WHERE cid = ?`, cid).Scan(&payload, &exp)
	if errors.Is(err, sql.ErrNoRows) {
		tx.Rollback() //nolint:errcheck // nothing consumed
		return nil, nil
	}
	if err != nil {
		tx.Rollback() //nolint:errcheck // read failed
		return nil, fmt.Errorf("store: take challenge %s read: %w", cid, err)
	}
	if _, err := tx.Exec(`DELETE FROM challenges WHERE cid = ?`, cid); err != nil {
		tx.Rollback() //nolint:errcheck // delete failed
		return nil, fmt.Errorf("store: take challenge %s delete: %w", cid, err)
	}
	if err := tx.Commit(); err != nil {
		return nil, fmt.Errorf("store: take challenge %s commit: %w", cid, err)
	}
	if exp <= time.Now().Unix() {
		return nil, nil
	}
	return []byte(payload), nil
}

// CleanExpiredChallenges removes every challenge whose expiry has passed.
func (s *Store) CleanExpiredChallenges(now int64) error {
	if _, err := s.DB.Exec(`DELETE FROM challenges WHERE exp <= ?`, now); err != nil {
		return fmt.Errorf("store: clean expired challenges: %w", err)
	}
	return nil
}
