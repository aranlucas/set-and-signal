-- +goose Up
CREATE TABLE users (
    id TEXT PRIMARY KEY,
    name TEXT,
    created TEXT,
    disabled INT DEFAULT 0,
    sv INT DEFAULT 0,            -- session version for logout-all
    admin INT DEFAULT 0,
    invited_by TEXT,
    last_reminder TEXT
);
CREATE TABLE credentials (
    id TEXT PRIMARY KEY,
    user_id TEXT REFERENCES users,
    public_key TEXT,             -- b64url
    counter INTEGER NOT NULL DEFAULT 0,
    transports TEXT              -- json array
);
CREATE TABLE tokens (
    id TEXT PRIMARY KEY,
    user_id TEXT,
    name TEXT,
    hash TEXT UNIQUE,
    created TEXT
);
CREATE TABLE invites (
    code TEXT PRIMARY KEY,
    note TEXT,
    created_by TEXT,
    created TEXT,
    used_by TEXT,
    used_at TEXT,
    revoked INT DEFAULT 0
);
CREATE TABLE push_subs (
    endpoint TEXT PRIMARY KEY,
    user_id TEXT,
    p256dh TEXT,
    auth TEXT,
    created TEXT
);
CREATE TABLE challenges (
    cid TEXT PRIMARY KEY,
    payload TEXT,
    exp INT                      -- json; restart-safe (upstream was in-memory)
);
CREATE TABLE user_state (
    user_id TEXT PRIMARY KEY REFERENCES users,
    state TEXT NOT NULL DEFAULT '{}',
    updated_at TEXT
);

-- +goose Down
DROP TABLE user_state;
DROP TABLE challenges;
DROP TABLE push_subs;
DROP TABLE invites;
DROP TABLE tokens;
DROP TABLE credentials;
DROP TABLE users;
