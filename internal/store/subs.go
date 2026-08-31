package store

import (
	"database/sql"
	"errors"
	"fmt"
)

// PushSub mirrors the push_subs table; keys are VAPID client values.
type PushSub struct {
	Endpoint string `json:"endpoint"`
	UserID   string `json:"-"`
	P256DH   string `json:"-"`
	Auth     string `json:"-"`
	Created  string `json:"-"`
}

// UpsertPushSub inserts the subscription, replacing any earlier row with the
// same endpoint.
func (s *Store) UpsertPushSub(sub PushSub) error {
	if _, err := s.DB.Exec(
		`INSERT INTO push_subs (endpoint, user_id, p256dh, auth, created)
		 VALUES (?, ?, ?, ?, ?)
		 ON CONFLICT(endpoint) DO UPDATE SET
		   user_id = excluded.user_id,
		   p256dh = excluded.p256dh,
		   auth = excluded.auth,
		   created = excluded.created`,
		sub.Endpoint, sub.UserID, sub.P256DH, sub.Auth, sub.Created,
	); err != nil {
		return fmt.Errorf("store: upsert push sub: %w", err)
	}
	return nil
}

// DeletePushSub removes one subscription by endpoint (404/410 pruning).
func (s *Store) DeletePushSub(endpoint string) error {
	if _, err := s.DB.Exec(`DELETE FROM push_subs WHERE endpoint = ?`, endpoint); err != nil {
		return fmt.Errorf("store: delete push sub: %w", err)
	}
	return nil
}

func (s *Store) SubsByUser(uid string) ([]PushSub, error) {
	rows, err := s.DB.Query(
		`SELECT endpoint, coalesce(user_id,''), coalesce(p256dh,''), coalesce(auth,''), coalesce(created,'') FROM push_subs WHERE user_id = ?`, uid,
	)
	if err != nil {
		return nil, fmt.Errorf("store: list push subs for %s: %w", uid, err)
	}
	defer func() { _ = rows.Close() }()

	var out []PushSub
	for rows.Next() {
		var sub PushSub
		if err := rows.Scan(&sub.Endpoint, &sub.UserID, &sub.P256DH, &sub.Auth, &sub.Created); err != nil {
			return nil, fmt.Errorf("store: scan push sub: %w", err)
		}
		out = append(out, sub)
	}
	return out, rows.Err()
}

// AnySubFor reports whether the user has at least one subscription left.
func (s *Store) AnySubFor(uid string) (bool, error) {
	var n int
	err := s.DB.QueryRow(`SELECT EXISTS(SELECT 1 FROM push_subs WHERE user_id = ?)`, uid).Scan(&n)
	if errors.Is(err, sql.ErrNoRows) {
		return false, nil
	}
	if err != nil {
		return false, fmt.Errorf("store: any sub for %s: %w", uid, err)
	}
	return n != 0, nil
}
