-- +goose Up
-- These columns back recurring cleanup jobs and per-user push lookups. Without
-- indexes, each sweep or reminder pass scans the entire table as installations
-- accumulate rows.
CREATE INDEX push_subs_user_id ON push_subs(user_id);
CREATE INDEX challenges_exp ON challenges(exp);
CREATE INDEX oauth_codes_exp ON oauth_codes(exp);
CREATE INDEX oauth_refresh_exp ON oauth_refresh(exp);

-- +goose Down
DROP INDEX IF EXISTS oauth_refresh_exp;
DROP INDEX IF EXISTS oauth_codes_exp;
DROP INDEX IF EXISTS challenges_exp;
DROP INDEX IF EXISTS push_subs_user_id;
