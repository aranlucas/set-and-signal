package main

import (
	"encoding/json/jsontext"
	"encoding/json/v2"
	"errors"
	"fmt"
	"io/fs"
	"os"
	"path/filepath"
	"strings"

	"github.com/aranlucas/set-and-signal/internal/store"
)

// legacy shapes mirror api/server.js's db.json (lines 42–47) and the
// state-<uid>.json blobs exactly as the Node instance wrote them.
type legacyDB struct {
	Users   []legacyUser   `json:"users"`
	Creds   []legacyCred   `json:"creds"`
	Subs    []legacySub    `json:"subs"`
	Tokens  []legacyToken  `json:"tokens"`
	Invites []legacyInvite `json:"invites"`
}

type legacyUser struct {
	ID           string `json:"id"`
	Name         string `json:"name"`
	Created      string `json:"created,omitempty"`
	Disabled     bool   `json:"disabled,omitzero"`
	SV           int    `json:"sv,omitzero"`
	Admin        bool   `json:"admin,omitzero"`
	InvitedBy    string `json:"invitedBy,omitempty"`
	LastReminder string `json:"lastReminder,omitempty"`
}

type legacyCred struct {
	ID         string   `json:"id"`
	UserID     string   `json:"userId"`
	PublicKey  string   `json:"publicKey"` // b64url COSE key
	Counter    int      `json:"counter"`
	Transports []string `json:"transports"`
}

type legacySub struct {
	UserID   string `json:"userId"`
	Endpoint string `json:"endpoint"`
	Created  string `json:"created,omitempty"`
	Keys     struct {
		P256DH string `json:"p256dh"`
		Auth   string `json:"auth"`
	} `json:"keys"`
}

type legacyToken struct {
	ID      string `json:"id"`
	UserID  string `json:"userId"`
	Name    string `json:"name,omitempty"`
	Hash    string `json:"hash"`
	Created string `json:"created,omitempty"`
}

type legacyInvite struct {
	Code      string `json:"code"`
	Note      string `json:"note,omitempty"`
	CreatedBy string `json:"createdBy,omitempty"`
	Created   string `json:"created,omitempty"`
	UsedBy    string `json:"usedBy,omitempty"`
	UsedAt    string `json:"usedAt,omitempty"`
	Revoked   bool   `json:"revoked,omitzero"`
}

// Counts reports how many records of each kind were imported.
type Counts struct {
	Users, Creds, Subs, Tokens, Invites, States, Errors int
}

func (c Counts) String() string {
	return fmt.Sprintf("users=%d creds=%d subs=%d tokens=%d invites=%d states=%d errors=%d",
		c.Users, c.Creds, c.Subs, c.Tokens, c.Invites, c.States, c.Errors)
}

// importData upserts every record from a legacy JSON data dir into the SQLite
// database at dbPath. Every record is attempted even after earlier failures;
// the returned error aggregates them so callers can exit non-zero on partial
// failure. Re-running over an already-imported DB changes nothing.
func importData(dataDir, dbPath string) (Counts, error) {
	// Read and parse the source first: a wrong -data dir must not leave a
	// freshly migrated (empty) database behind at the target path.
	raw, err := os.ReadFile(filepath.Join(dataDir, "db.json"))
	if err != nil {
		return Counts{}, fmt.Errorf("read db.json: %w", err)
	}
	var db legacyDB
	if err := json.Unmarshal(raw, &db); err != nil {
		return Counts{}, fmt.Errorf("parse db.json: %w", err)
	}

	st, err := store.OpenAtPath(dbPath)
	if err != nil {
		return Counts{}, err
	}
	defer st.DB.Close() //nolint:errcheck // read-only teardown
	var counts Counts
	var errs []error

	for _, u := range db.Users {
		if err := st.UpsertUser(store.User{
			ID: u.ID, Name: u.Name, Created: u.Created,
			Disabled: u.Disabled, SV: u.SV, Admin: u.Admin,
			InvitedBy: u.InvitedBy, LastReminder: u.LastReminder,
		}); err != nil {
			errs = append(errs, fmt.Errorf("user %s: %w", u.ID, err))
			continue
		}
		counts.Users++
	}
	for _, i := range db.Invites {
		if err := st.UpsertInvite(store.Invite{
			Code: i.Code, Note: i.Note, CreatedBy: i.CreatedBy, Created: i.Created,
			UsedBy: i.UsedBy, UsedAt: i.UsedAt, Revoked: i.Revoked,
		}); err != nil {
			errs = append(errs, fmt.Errorf("invite %s: %w", i.Code, err))
			continue
		}
		counts.Invites++
	}
	for _, c := range db.Creds {
		transports := "[]"
		if len(c.Transports) > 0 {
			if b, err := json.Marshal(c.Transports); err == nil {
				transports = string(b)
			}
		}
		if err := st.UpsertCredential(store.Credential{
			ID: c.ID, UserID: c.UserID, PublicKey: c.PublicKey,
			Counter: c.Counter, Transports: transports,
		}); err != nil {
			errs = append(errs, fmt.Errorf("credential %s: %w", c.ID, err))
			continue
		}
		counts.Creds++
	}
	for _, s := range db.Subs {
		if err := st.UpsertPushSub(store.PushSub{
			Endpoint: s.Endpoint, UserID: s.UserID,
			P256DH: s.Keys.P256DH, Auth: s.Keys.Auth, Created: s.Created,
		}); err != nil {
			errs = append(errs, fmt.Errorf("sub %s: %w", s.Endpoint, err))
			continue
		}
		counts.Subs++
	}

	// state-<uid>.json blobs land in user_state verbatim; users must exist
	// first, hence this runs last (user_state.user_id references users).
	entries, _ := fs.Glob(os.DirFS(dataDir), "state-*.json")
	for _, name := range entries {
		uid := strings.TrimSuffix(strings.TrimPrefix(name, "state-"), ".json")
		blob, err := os.ReadFile(filepath.Join(dataDir, name))
		if err != nil {
			errs = append(errs, fmt.Errorf("state %s: %w", name, err))
			continue
		}
		if !jsontext.Value(blob).IsValid() {
			errs = append(errs, fmt.Errorf("state %s: invalid JSON", name))
			continue
		}
		if err := st.WriteState(uid, blob); err != nil {
			errs = append(errs, fmt.Errorf("state %s: %w", name, err))
			continue
		}
		counts.States++
	}

	counts.Errors = len(errs)
	if errs != nil {
		return counts, errors.Join(errs...)
	}
	return counts, nil
}
