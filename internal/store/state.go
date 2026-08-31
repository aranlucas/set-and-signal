package store

import (
	"context"
	"database/sql"
	"encoding/json/jsontext"
	"encoding/json/v2"
	"errors"
	"fmt"
	"time"
)

// ReadState loads the user's JSON state blob; "null" when no row exists yet,
// matching upstream GET /api/data which serializes a nil state.
func (s *Store) ReadState(uid string) (jsontext.Value, error) {
	var raw string
	err := s.DB.QueryRow(`SELECT state FROM user_state WHERE user_id = ?`, uid).Scan(&raw)
	if errors.Is(err, sql.ErrNoRows) {
		return jsontext.Value("null"), nil
	}
	if err != nil {
		return nil, fmt.Errorf("store: read state for %s: %w", uid, err)
	}
	if raw == "" {
		raw = "null"
	}
	return jsontext.Value(raw), nil
}

// WriteState replaces the blob wholesale (PUT /api/data path).
func (s *Store) WriteState(uid string, raw jsontext.Value) error {
	if !raw.IsValid() {
		return fmt.Errorf("store: write state for %s: invalid JSON", uid)
	}
	if _, err := s.DB.Exec(
		`INSERT INTO user_state (user_id, state, updated_at) VALUES (?, ?, ?)
		 ON CONFLICT(user_id) DO UPDATE SET state = excluded.state, updated_at = excluded.updated_at`,
		uid, string(raw), time.Now().UTC().Format(time.RFC3339),
	); err != nil {
		return fmt.Errorf("store: write state for %s: %w", uid, err)
	}
	return nil
}

// MutateState runs fn against the stored blob inside one BEGIN IMMEDIATE
// transaction, so concurrent mutations serialize. Whatever fn returns is
// stamped with `_ts` (unix milliseconds, inside the JSON — same semantics as
// upstream mutateState) plus the updated_at column, then persisted. A non-nil
// error from fn aborts the whole transaction.
func (s *Store) MutateState(uid string, fn func(jsontext.Value) (jsontext.Value, error)) error {
	tx, err := s.DB.BeginTx(context.Background(), nil) // BEGIN IMMEDIATE via _txlock=immediate DSN option
	if err != nil {
		return fmt.Errorf("store: mutate state %s: %w", uid, err)
	}

	var raw string
	err = tx.QueryRow(`SELECT state FROM user_state WHERE user_id = ?`, uid).Scan(&raw)
	if err != nil && !errors.Is(err, sql.ErrNoRows) {
		tx.Rollback() //nolint:errcheck // already failing
		return fmt.Errorf("store: mutate state %s read: %w", uid, err)
	}
	if raw == "" {
		raw = "null"
	}

	newRaw, err := fn(jsontext.Value(raw))
	if err != nil {
		tx.Rollback() //nolint:errcheck // fn rejected the mutation
		return fmt.Errorf("store: mutate state %s: %w", uid, err)
	}

	stamped, err := stampTS(newRaw)
	if err != nil {
		tx.Rollback() //nolint:errcheck // invalid JSON out
		return fmt.Errorf("store: mutate state %s stamp _ts: %w", uid, err)
	}

	now := time.Now().UTC().Format(time.RFC3339)
	if _, err := tx.Exec(
		`INSERT INTO user_state (user_id, state, updated_at) VALUES (?, ?, ?)
		 ON CONFLICT(user_id) DO UPDATE SET state = excluded.state, updated_at = excluded.updated_at`,
		uid, string(stamped), now,
	); err != nil {
		tx.Rollback() //nolint:errcheck // write failed
		return fmt.Errorf("store: mutate state %s write: %w", uid, err)
	}
	if err := tx.Commit(); err != nil {
		return fmt.Errorf("store: mutate state %s commit: %w", uid, err)
	}
	return nil
}

// stampTS decodes the document as a JSON object, sets `_ts` to unix
// milliseconds, and re-encodes compactly. Non-object blobs are rejected: every
// real state document is an object upstream too.
func stampTS(raw jsontext.Value) (jsontext.Value, error) {
	var doc map[string]jsontext.Value
	if len(raw) == 0 || string(raw) == "null" {
		doc = map[string]jsontext.Value{}
	} else if err := json.Unmarshal(raw, &doc); err != nil {
		return nil, err
	} else if doc == nil {
		return nil, fmt.Errorf("state must be a JSON object")
	}
	nextRevision := time.Now().UnixMilli()
	if currentRaw, ok := doc["_ts"]; ok {
		var current int64
		if json.Unmarshal(currentRaw, &current) == nil && current >= nextRevision {
			nextRevision = current + 1
		}
	}
	ts, err := json.Marshal(nextRevision)
	if err != nil {
		return nil, err
	}
	doc["_ts"] = ts
	out, err := json.Marshal(doc)
	if err != nil {
		return nil, err
	}
	return out, nil
}
