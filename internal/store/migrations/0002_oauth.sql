-- +goose Up
-- OAuth 2.1 AS state for MCP clients (DCR) + OIDC-linked identities.
CREATE TABLE oauth_clients (
    client_id TEXT PRIMARY KEY,
    client_secret_hash TEXT,          -- empty for public clients
    client_name TEXT,
    redirect_uris TEXT NOT NULL,      -- JSON array
    grant_types TEXT NOT NULL,        -- JSON array
    token_endpoint_auth_method TEXT NOT NULL DEFAULT 'none',
    created TEXT NOT NULL
);
CREATE TABLE oauth_codes (
    code_hash TEXT PRIMARY KEY,
    client_id TEXT NOT NULL,
    user_id TEXT NOT NULL REFERENCES users(id),
    redirect_uri TEXT NOT NULL,
    code_challenge TEXT NOT NULL,
    code_challenge_method TEXT NOT NULL DEFAULT 'S256',
    scope TEXT NOT NULL DEFAULT '',
    resource TEXT NOT NULL DEFAULT '',
    exp INT NOT NULL
);
CREATE TABLE oauth_refresh (
    token_hash TEXT PRIMARY KEY,
    client_id TEXT NOT NULL,
    user_id TEXT NOT NULL REFERENCES users(id),
    scope TEXT NOT NULL DEFAULT '',
    resource TEXT NOT NULL DEFAULT '',
    exp INT NOT NULL
);
CREATE TABLE oidc_identities (
    provider TEXT NOT NULL,           -- google | github | apple
    subject TEXT NOT NULL,           -- IdP `sub`
    user_id TEXT NOT NULL REFERENCES users(id),
    email TEXT NOT NULL DEFAULT '',
    created TEXT NOT NULL,
    PRIMARY KEY (provider, subject)
);
CREATE INDEX oidc_identities_user ON oidc_identities(user_id);

-- +goose Down
DROP INDEX IF EXISTS oidc_identities_user;
DROP TABLE oidc_identities;
DROP TABLE oauth_refresh;
DROP TABLE oauth_codes;
DROP TABLE oauth_clients;
