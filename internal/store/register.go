package store

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"time"
)

// Registration completion errors mapped to HTTP-ish outcomes by callers.
var (
	// ErrDuplicateCredential mirrors upstream's 409 "credential already registered".
	ErrDuplicateCredential = errors.New("store: credential already registered")
	// ErrInviteNotValid mirrors upstream's 403 when the invite vanished between
	// BeginRegistration and FinishRegistration.
	ErrInviteNotValid = errors.New("store: invite code is no longer valid")
)

// CompleteRegistration creates the user and their first credential in one
// transaction, re-checking and burning the invite at the last moment when
// inviteCode is non-empty — the same ordering as upstream register/verify:
// duplicate credential check, invite burn, user insert, credential insert.
func (s *Store) CompleteRegistration(u User, c Credential, inviteCode string) error {
	tx, err := s.DB.BeginTx(context.Background(), nil) // BEGIN IMMEDIATE via DSN _txlock
	if err != nil {
		return fmt.Errorf("store: complete registration begin: %w", err)
	}
	rollback := func(cause error) error {
		tx.Rollback() //nolint:errcheck // already returning cause
		return cause
	}

	// Duplicate passkey on this instance? 409-equivalent, checked first like upstream.
	var n int
	if err := tx.QueryRow(`SELECT EXISTS(SELECT 1 FROM credentials WHERE id = ?)`, c.ID).Scan(&n); err != nil {
		return rollback(fmt.Errorf("store: complete registration dup check: %w", err))
	}
	if n != 0 {
		return rollback(ErrDuplicateCredential)
	}

	if inviteCode != "" {
		var usedBy string
		var revoked int
		err := tx.QueryRow(`SELECT coalesce(used_by,''), revoked FROM invites WHERE code = ?`, inviteCode).
			Scan(&usedBy, &revoked)
		if errors.Is(err, sql.ErrNoRows) {
			return rollback(ErrInviteNotValid)
		}
		if err != nil {
			return rollback(fmt.Errorf("store: complete registration invite read: %w", err))
		}
		if usedBy != "" || revoked != 0 {
			return rollback(ErrInviteNotValid)
		}
		now := time.Now().UTC().Format(time.RFC3339)
		if _, err := tx.Exec(`UPDATE invites SET used_by = ?, used_at = ? WHERE code = ?`, u.ID, now, inviteCode); err != nil {
			return rollback(fmt.Errorf("store: complete registration invite burn: %w", err))
		}
		u.InvitedBy = inviteCode
	}

	if _, err := tx.Exec(
		`INSERT INTO users (id, name, created, disabled, sv, admin, invited_by, last_reminder)
		 VALUES (?, ?, ?, ?, ?, ?, ?, '')`,
		u.ID, u.Name, u.Created, b2i(u.Disabled), u.SV, b2i(u.Admin), u.InvitedBy,
	); err != nil {
		return rollback(fmt.Errorf("store: complete registration user insert: %w", err))
	}
	if _, err := tx.Exec(
		`INSERT INTO credentials (id, user_id, public_key, counter, transports)
		 VALUES (?, ?, ?, ?, ?)`,
		c.ID, c.UserID, c.PublicKey, c.Counter, c.Transports,
	); err != nil {
		return rollback(fmt.Errorf("store: complete registration credential insert: %w", err))
	}

	if err := tx.Commit(); err != nil {
		return fmt.Errorf("store: complete registration commit: %w", err)
	}
	return nil
}
