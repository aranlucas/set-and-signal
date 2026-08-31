-- +goose Up
DROP TABLE IF EXISTS tokens;

-- +goose Down
CREATE TABLE tokens (
    id TEXT PRIMARY KEY,
    user_id TEXT,
    name TEXT,
    hash TEXT UNIQUE,
    created TEXT
);
