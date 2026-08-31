package store

import (
	"context"
	"crypto/rand"
	"database/sql"
	"encoding/base64"
	"encoding/json/v2"
	"errors"
	"fmt"
	"time"
)

// OAuthClient is a dynamically registered or preconfigured OAuth client.
type OAuthClient struct {
	ClientID                string
	ClientSecretHash        string // empty for public clients
	ClientName              string
	RedirectURIs            []string
	GrantTypes              []string
	TokenEndpointAuthMethod string
	Created                 string
}

// OAuthCode is a short-lived authorization code (PKCE).
type OAuthCode struct {
	CodeHash            string
	ClientID            string
	UserID              string
	RedirectURI         string
	CodeChallenge       string
	CodeChallengeMethod string
	Scope               string
	Resource            string
	Exp                 int64
}

// OAuthRefresh is a hashed refresh token.
type OAuthRefresh struct {
	TokenHash string
	ClientID  string
	UserID    string
	Scope     string
	Resource  string
	Exp       int64
}

// OIDCIdentity links an IdP subject to a local user.
type OIDCIdentity struct {
	Provider string
	Subject  string
	UserID   string
	Email    string
	Created  string
}

func (s *Store) SaveOAuthClient(c OAuthClient) error {
	uris, err := json.Marshal(c.RedirectURIs)
	if err != nil {
		return err
	}
	grants, err := json.Marshal(c.GrantTypes)
	if err != nil {
		return err
	}
	if c.TokenEndpointAuthMethod == "" {
		c.TokenEndpointAuthMethod = "none"
	}
	if c.Created == "" {
		c.Created = time.Now().UTC().Format(time.RFC3339)
	}
	_, err = s.DB.Exec(
		`INSERT INTO oauth_clients
		 (client_id, client_secret_hash, client_name, redirect_uris, grant_types, token_endpoint_auth_method, created)
		 VALUES (?, ?, ?, ?, ?, ?, ?)
		 ON CONFLICT(client_id) DO UPDATE SET
		   client_secret_hash = excluded.client_secret_hash,
		   client_name = excluded.client_name,
		   redirect_uris = excluded.redirect_uris,
		   grant_types = excluded.grant_types,
		   token_endpoint_auth_method = excluded.token_endpoint_auth_method`,
		c.ClientID, c.ClientSecretHash, c.ClientName, string(uris), string(grants),
		c.TokenEndpointAuthMethod, c.Created,
	)
	if err != nil {
		return fmt.Errorf("store: save oauth client: %w", err)
	}
	return nil
}

func (s *Store) OAuthClientByID(id string) (*OAuthClient, error) {
	row := s.DB.QueryRow(
		`SELECT client_id, coalesce(client_secret_hash,''), coalesce(client_name,''),
		        redirect_uris, grant_types, token_endpoint_auth_method, created
		 FROM oauth_clients WHERE client_id = ?`, id,
	)
	var c OAuthClient
	var uris, grants string
	if err := row.Scan(&c.ClientID, &c.ClientSecretHash, &c.ClientName, &uris, &grants,
		&c.TokenEndpointAuthMethod, &c.Created); err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, nil
		}
		return nil, fmt.Errorf("store: oauth client: %w", err)
	}
	if err := json.Unmarshal([]byte(uris), &c.RedirectURIs); err != nil {
		return nil, fmt.Errorf("store: oauth client %s redirect URIs: %w", id, err)
	}
	if err := json.Unmarshal([]byte(grants), &c.GrantTypes); err != nil {
		return nil, fmt.Errorf("store: oauth client %s grant types: %w", id, err)
	}
	return &c, nil
}

func (s *Store) SaveOAuthCode(c OAuthCode) error {
	_, err := s.DB.Exec(
		`INSERT INTO oauth_codes
		 (code_hash, client_id, user_id, redirect_uri, code_challenge, code_challenge_method, scope, resource, exp)
		 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
		c.CodeHash, c.ClientID, c.UserID, c.RedirectURI, c.CodeChallenge, c.CodeChallengeMethod,
		c.Scope, c.Resource, c.Exp,
	)
	if err != nil {
		return fmt.Errorf("store: save oauth code: %w", err)
	}
	return nil
}

// TakeOAuthCode loads and deletes a code in one step (single-use).
func (s *Store) TakeOAuthCode(codeHash string) (*OAuthCode, error) {
	tx, err := s.DB.Begin()
	if err != nil {
		return nil, err
	}
	defer tx.Rollback() //nolint:errcheck

	row := tx.QueryRow(
		`SELECT code_hash, client_id, user_id, redirect_uri, code_challenge, code_challenge_method, scope, resource, exp
		 FROM oauth_codes WHERE code_hash = ?`, codeHash,
	)
	var c OAuthCode
	if err := row.Scan(&c.CodeHash, &c.ClientID, &c.UserID, &c.RedirectURI, &c.CodeChallenge,
		&c.CodeChallengeMethod, &c.Scope, &c.Resource, &c.Exp); err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, nil
		}
		return nil, err
	}
	if _, err := tx.Exec(`DELETE FROM oauth_codes WHERE code_hash = ?`, codeHash); err != nil {
		return nil, err
	}
	if err := tx.Commit(); err != nil {
		return nil, err
	}
	return &c, nil
}

func (s *Store) CleanExpiredOAuthCodes(now int64) error {
	if _, err := s.DB.Exec(`DELETE FROM oauth_codes WHERE exp < ?`, now); err != nil {
		return fmt.Errorf("store: clean expired oauth codes: %w", err)
	}
	return nil
}

// CleanExpiredOAuthRefresh removes refresh tokens after their last valid
// second. Unused refresh tokens otherwise remain in SQLite indefinitely.
func (s *Store) CleanExpiredOAuthRefresh(now int64) error {
	if _, err := s.DB.Exec(`DELETE FROM oauth_refresh WHERE exp < ?`, now); err != nil {
		return fmt.Errorf("store: clean expired oauth refresh tokens: %w", err)
	}
	return nil
}

func (s *Store) SaveOAuthRefresh(t OAuthRefresh) error {
	_, err := s.DB.Exec(
		`INSERT INTO oauth_refresh (token_hash, client_id, user_id, scope, resource, exp)
		 VALUES (?, ?, ?, ?, ?, ?)`,
		t.TokenHash, t.ClientID, t.UserID, t.Scope, t.Resource, t.Exp,
	)
	if err != nil {
		return fmt.Errorf("store: save oauth refresh: %w", err)
	}
	return nil
}

func (s *Store) TakeOAuthRefresh(tokenHash string) (*OAuthRefresh, error) {
	tx, err := s.DB.Begin()
	if err != nil {
		return nil, err
	}
	defer tx.Rollback() //nolint:errcheck

	row := tx.QueryRow(
		`SELECT token_hash, client_id, user_id, scope, resource, exp FROM oauth_refresh WHERE token_hash = ?`,
		tokenHash,
	)
	var t OAuthRefresh
	if err := row.Scan(&t.TokenHash, &t.ClientID, &t.UserID, &t.Scope, &t.Resource, &t.Exp); err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, nil
		}
		return nil, err
	}
	if _, err := tx.Exec(`DELETE FROM oauth_refresh WHERE token_hash = ?`, tokenHash); err != nil {
		return nil, err
	}
	if err := tx.Commit(); err != nil {
		return nil, err
	}
	return &t, nil
}

func (s *Store) OIDCIdentity(provider, subject string) (*OIDCIdentity, error) {
	row := s.DB.QueryRow(
		`SELECT provider, subject, user_id, coalesce(email,''), created
		 FROM oidc_identities WHERE provider = ? AND subject = ?`, provider, subject,
	)
	var id OIDCIdentity
	if err := row.Scan(&id.Provider, &id.Subject, &id.UserID, &id.Email, &id.Created); err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, nil
		}
		return nil, fmt.Errorf("store: oidc identity: %w", err)
	}
	return &id, nil
}

func (s *Store) SaveOIDCIdentity(id OIDCIdentity) error {
	if id.Created == "" {
		id.Created = time.Now().UTC().Format(time.RFC3339)
	}
	_, err := s.DB.Exec(
		`INSERT INTO oidc_identities (provider, subject, user_id, email, created)
		 VALUES (?, ?, ?, ?, ?)
		 ON CONFLICT(provider, subject) DO UPDATE SET
		   user_id = excluded.user_id,
		   email = excluded.email`,
		id.Provider, id.Subject, id.UserID, id.Email, id.Created,
	)
	if err != nil {
		return fmt.Errorf("store: save oidc identity: %w", err)
	}
	return nil
}

// FindOrCreateOIDCUser returns the local user for an IdP identity, creating one
// if needed. The lookup and both inserts share one immediate transaction so
// concurrent callbacks for the same identity cannot leave orphan users.
func (s *Store) FindOrCreateOIDCUser(provider, subject, email, name string) (*User, error) {
	if name == "" {
		if email != "" {
			name = email
		} else {
			name = provider + " user"
		}
	}

	tx, err := s.DB.BeginTx(context.Background(), nil) // BEGIN IMMEDIATE via the store DSN
	if err != nil {
		return nil, fmt.Errorf("store: find or create oidc user begin: %w", err)
	}
	rollback := func(cause error) (*User, error) {
		tx.Rollback() //nolint:errcheck // already returning cause
		return nil, cause
	}

	u, err := scanUser(tx.QueryRow(
		`SELECT u.id, coalesce(u.name,''), coalesce(u.created,''), u.disabled, u.sv, u.admin,
		        coalesce(u.invited_by,''), coalesce(u.last_reminder,'')
		 FROM oidc_identities AS identity
		 JOIN users AS u ON u.id = identity.user_id
		 WHERE identity.provider = ? AND identity.subject = ?`,
		provider, subject,
	))
	if err == nil {
		if err := tx.Commit(); err != nil {
			return nil, fmt.Errorf("store: find oidc user commit: %w", err)
		}
		return u, nil
	}
	if !errors.Is(err, sql.ErrNoRows) {
		return rollback(fmt.Errorf("store: find oidc user: %w", err))
	}

	uidB := make([]byte, 12)
	if _, err := rand.Read(uidB); err != nil {
		return rollback(fmt.Errorf("store: oidc uid: %w", err))
	}
	u = &User{
		ID:      base64.RawURLEncoding.EncodeToString(uidB),
		Name:    name,
		Created: time.Now().UTC().Format(time.RFC3339),
	}
	if _, err := tx.Exec(
		`INSERT INTO users (id, name, created, disabled, sv, admin, invited_by)
		 VALUES (?, ?, ?, 0, 0, 0, '')`,
		u.ID, u.Name, u.Created,
	); err != nil {
		return rollback(fmt.Errorf("store: create oidc user: %w", err))
	}
	if _, err := tx.Exec(
		`INSERT INTO oidc_identities (provider, subject, user_id, email, created)
		 VALUES (?, ?, ?, ?, ?)`,
		provider, subject, u.ID, email, u.Created,
	); err != nil {
		return rollback(fmt.Errorf("store: create oidc identity: %w", err))
	}
	if err := tx.Commit(); err != nil {
		return nil, fmt.Errorf("store: create oidc user commit: %w", err)
	}
	return u, nil
}
