package store

import (
	"database/sql"
	"errors"
	"fmt"
)

// User mirrors the users table. Only ID and Name serialize toward the API
// today; the rest is internal bookkeeping.
type User struct {
	ID           string `json:"id"`
	Name         string `json:"name"`
	Created      string `json:"created,omitempty"`
	Disabled     bool   `json:"disabled,omitzero"`
	SV           int    `json:"sv,omitzero"` // session version, bumped on logout-all
	Admin        bool   `json:"admin,omitzero"`
	InvitedBy    string `json:"invitedBy,omitempty"`
	LastReminder string `json:"-"`
}

func (s *Store) CreateUser(u User) error {
	res, err := s.DB.Exec(
		`INSERT INTO users (id, name, created, disabled, sv, admin, invited_by)
		 VALUES (?, ?, ?, ?, ?, ?, ?)`,
		u.ID, u.Name, u.Created, b2i(u.Disabled), u.SV, b2i(u.Admin), u.InvitedBy,
	)
	if err != nil {
		return fmt.Errorf("store: create user %s: %w", u.ID, err)
	}
	if n, _ := res.RowsAffected(); n == 0 {
		return errors.New("store: create user inserted no rows")
	}
	return nil
}

// UpsertUser inserts the user or refreshes every field on id conflict —
// import/replay paths stay idempotent.
func (s *Store) UpsertUser(u User) error {
	if _, err := s.DB.Exec(
		`INSERT INTO users (id, name, created, disabled, sv, admin, invited_by, last_reminder)
		 VALUES (?, ?, ?, ?, ?, ?, ?, ?)
		 ON CONFLICT(id) DO UPDATE SET
		   name = excluded.name,
		   created = excluded.created,
		   disabled = excluded.disabled,
		   sv = excluded.sv,
		   admin = excluded.admin,
		   invited_by = excluded.invited_by,
		   last_reminder = excluded.last_reminder`,
		u.ID, u.Name, u.Created, b2i(u.Disabled), u.SV, b2i(u.Admin), u.InvitedBy, u.LastReminder,
	); err != nil {
		return fmt.Errorf("store: upsert user %s: %w", u.ID, err)
	}
	return nil
}

// UserByID returns nil, nil when no user has that id.
func (s *Store) UserByID(id string) (*User, error) {
	row := s.DB.QueryRow(
		`SELECT id, coalesce(name,''), coalesce(created,''), disabled, sv, admin,
		        coalesce(invited_by,''), coalesce(last_reminder,'')
		 FROM users WHERE id = ?`, id,
	)
	u, err := scanUser(row)
	if errors.Is(err, sql.ErrNoRows) {
		return nil, nil
	}
	if err != nil {
		return nil, fmt.Errorf("store: user %s: %w", id, err)
	}
	return u, nil
}

func (s *Store) Users() ([]User, error) {
	rows, err := s.DB.Query(
		`SELECT id, coalesce(name,''), coalesce(created,''), disabled, sv, admin,
		        coalesce(invited_by,''), coalesce(last_reminder,'')
		 FROM users ORDER BY created`, // created is empty for legacy imports; ordering then unspecified
	)
	if err != nil {
		return nil, fmt.Errorf("store: list users: %w", err)
	}
	defer func() { _ = rows.Close() }()

	var out []User
	for rows.Next() {
		u, err := scanUser(rows)
		if err != nil {
			return nil, err
		}
		out = append(out, *u)
	}
	return out, rows.Err()
}

func (s *Store) SetDisabled(id string, d bool) error {
	_, err := s.DB.Exec(`UPDATE users SET disabled = ? WHERE id = ?`, b2i(d), id)
	if err != nil {
		return fmt.Errorf("store: set disabled %s: %w", id, err)
	}
	return nil
}

// BumpSessionVersion increments sv (invalidating all cookies) and returns the
// new value.
func (s *Store) BumpSessionVersion(id string) (int, error) {
	var sv int
	err := s.DB.QueryRow(`UPDATE users SET sv = sv + 1 WHERE id = ? RETURNING sv`, id).Scan(&sv)
	if err != nil {
		return 0, fmt.Errorf("store: bump session version %s: %w", id, err)
	}
	return sv, nil
}

type rowScanner interface{ Scan(dest ...any) error }

func scanUser(r rowScanner) (*User, error) {
	var u User
	var disabled, admin int
	if err := r.Scan(&u.ID, &u.Name, &u.Created, &disabled, &u.SV, &admin, &u.InvitedBy, &u.LastReminder); err != nil {
		return nil, err
	}
	u.Disabled = disabled != 0
	u.Admin = admin != 0
	return &u, nil
}

func b2i(b bool) int {
	if b {
		return 1
	}
	return 0
}

// SetLastReminder records the local calendar date (YYYY-MM-DD) of the most
// recent day-reminder sent to this user — the once-per-day dedupe marker.
func (s *Store) SetLastReminder(id, date string) error {
	if _, err := s.DB.Exec(`UPDATE users SET last_reminder = ? WHERE id = ?`, date, id); err != nil {
		return fmt.Errorf("store: set last reminder %s: %w", id, err)
	}
	return nil
}
