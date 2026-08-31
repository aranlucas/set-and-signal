package store

import (
	"database/sql"
	"errors"
	"fmt"
)

// Credential mirrors the credentials table. PublicKey is b64url-encoded COSE
// key; Transports is a JSON array of transport strings.
type Credential struct {
	ID         string `json:"id"`
	UserID     string `json:"-"`
	PublicKey  string `json:"-"`
	Counter    int    `json:"-"`
	Transports string `json:"-"`
}

func (s *Store) UpsertCredential(c Credential) error {
	if _, err := s.DB.Exec(
		`INSERT INTO credentials (id, user_id, public_key, counter, transports)
		 VALUES (?, ?, ?, ?, ?)
		 ON CONFLICT(id) DO UPDATE SET
		   user_id = excluded.user_id,
		   public_key = excluded.public_key,
		   counter = excluded.counter,
		   transports = excluded.transports`,
		c.ID, c.UserID, c.PublicKey, c.Counter, c.Transports,
	); err != nil {
		return fmt.Errorf("store: upsert credential %s: %w", c.ID, err)
	}
	return nil
}

// CredentialByID returns nil, nil when absent.
func (s *Store) CredentialByID(id string) (*Credential, error) {
	var c Credential
	err := s.DB.QueryRow(
		`SELECT id, coalesce(user_id,''), coalesce(public_key,''), counter, coalesce(transports,'')
		 FROM credentials WHERE id = ?`, id,
	).Scan(&c.ID, &c.UserID, &c.PublicKey, &c.Counter, &c.Transports)
	if errors.Is(err, sql.ErrNoRows) {
		return nil, nil
	}
	if err != nil {
		return nil, fmt.Errorf("store: credential %s: %w", id, err)
	}
	return &c, nil
}

// UpdateCredentialCounter advances the WebAuthn sign counter after login.
func (s *Store) UpdateCredentialCounter(id string, n int) error {
	if _, err := s.DB.Exec(`UPDATE credentials SET counter = ? WHERE id = ?`, n, id); err != nil {
		return fmt.Errorf("store: update credential counter %s: %w", id, err)
	}
	return nil
}
