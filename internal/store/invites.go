package store

import (
	"fmt"
)

// Invite mirrors the invites table; Code is the primary key and must be unique.
type Invite struct {
	Code      string `json:"code"`
	Note      string `json:"note,omitempty"`
	CreatedBy string `json:"createdBy,omitempty"`
	Created   string `json:"created,omitempty"`
	UsedBy    string `json:"usedBy,omitempty"`
	UsedAt    string `json:"usedAt,omitempty"`
	Revoked   bool   `json:"revoked,omitzero"`
}

// UpsertInvite inserts or refreshes an invite; codes are unique by PK.
func (s *Store) UpsertInvite(i Invite) error {
	if _, err := s.DB.Exec(
		`INSERT INTO invites (code, note, created_by, created, used_by, used_at, revoked)
		 VALUES (?, ?, ?, ?, ?, ?, ?)
		 ON CONFLICT(code) DO UPDATE SET
		   note = excluded.note,
		   created_by = excluded.created_by,
		   used_by = excluded.used_by,
		   used_at = excluded.used_at,
		   revoked = excluded.revoked`,
		i.Code, i.Note, i.CreatedBy, i.Created, i.UsedBy, i.UsedAt, b2i(i.Revoked),
	); err != nil {
		return fmt.Errorf("store: upsert invite %s: %w", i.Code, err)
	}
	return nil
}

func (s *Store) Invites() ([]Invite, error) {
	rows, err := s.DB.Query(
		`SELECT code, coalesce(note,''), coalesce(created_by,''), coalesce(created,''),
		       coalesce(used_by,''), coalesce(used_at,''), revoked
		 FROM invites ORDER BY created DESC`,
	)
	if err != nil {
		return nil, fmt.Errorf("store: list invites: %w", err)
	}
	defer func() { _ = rows.Close() }()

	var out []Invite
	for rows.Next() {
		var i Invite
		var revoked int
		if err := rows.Scan(&i.Code, &i.Note, &i.CreatedBy, &i.Created, &i.UsedBy, &i.UsedAt, &revoked); err != nil {
			return nil, fmt.Errorf("store: scan invite: %w", err)
		}
		i.Revoked = revoked != 0
		out = append(out, i)
	}
	return out, rows.Err()
}

func (s *Store) DeleteInvite(code string) error {
	if _, err := s.DB.Exec(`DELETE FROM invites WHERE code = ?`, code); err != nil {
		return fmt.Errorf("store: delete invite %s: %w", code, err)
	}
	return nil
}
