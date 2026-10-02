# Convex training backend

Convex owns hosted training records. Go retains passkeys, OAuth/MCP, accounts,
notifications, and external integrations. The React application uses Convex's
JavaScript client for reactive training updates and mutations; Zustand remains
the UI-facing view and device-local active workout state.

## Data and writes

`records` contains one document per workout, routine, or custom exercise, with
separate order records preserving export order. Other profile fields are
independent records. `profiles` tracks a server-owned revision. Both tables are
indexed by the authenticated owner. Unknown export fields survive server edits.

Browser mutations compare each changed record with its previous value and
commit atomically. Unrelated fields can change independently. Repeated writes
with the same value succeed; stale competing values produce a conflict. Go's
existing typed mutation callbacks use a bounded compare-and-swap retry against
the profile revision. Only a server-signed service identity can replace a
snapshot. Browser identities cannot call that operation or select another user.

The authenticated `/api/data` read returns a snapshot for integrations and
exports. Browsers write through Convex mutations; there is no whole-profile
HTTP upload endpoint.

## Offline behavior and recovery

Active workouts stay local and are keyed by user. Guest, demo, and standalone
mobile builds retain local persistence and the mobile file mirror. Hosted
profiles cache the last received snapshot for offline display. Pending edits
are saved separately before they are transmitted and replayed after reopening.
This is a durable queue around Convex's in-memory mutation retries, not a
claim that Convex itself supplies persistent offline sync.

A conflict keeps the pending queue intact. The notification can download a
recovery file or choose synced data; the latter retains a timestamped local
recovery copy. Account changes close the old Convex client. Pending edits and
cached profiles are isolated by account. Signing out waits for pending writes;
a failed write leaves the session and edits intact.

## Configure a deployment

From `web`, run `pnpm exec convex dev` to create/link a Convex deployment.
The CLI stores its deployment URL in ignored `web/.env.local`. The current
cloud project is `lucas-arango/set-and-signal`.

Production uses `https://cheerful-peacock-198.convex.cloud` with the existing
Railway service at `https://opengym2.up.railway.app`. Its signing key lives on
the existing `/data` volume. Development uses a separate deployment and key.
Deploy production functions from `web` with `pnpm exec convex deploy` before
deploying an API or frontend change that depends on them. Set production auth
variables with `pnpm exec convex env set ... --prod`.

The Go API issues two-minute RS256 tokens using a private key in
`DATA_DIR/convex-signing.pem`. Keep this private file with the API's persistent
data, and never expose it to the frontend. Existing sessions are checked before
each token issuance. Revocation of already issued Convex tokens takes at most
two minutes.

Initialize the key and print its **public** JWKS data URI:

```sh
DATA_DIR="$PWD/data" go run ./cmd/opengym-convex-key
```

Set these Convex deployment variables with `pnpm exec convex env set` from
`web`:

- `AUTH_ISSUER`: the Go API's exact `PUBLIC_URL`.
- `AUTH_JWKS`: the public data URI printed above.

Then run `pnpm exec convex dev --once` from `web` to push the functions and auth
configuration. Start Go with `CONVEX_URL` set to the matching cloud URL and
`PUBLIC_URL` matching `AUTH_ISSUER`. The browser learns the URL from its
authenticated `/api/convex/token` response; it needs no deployment secret.

## Current formats and storage

The API reads and writes training records in the configured Convex deployment.
Startup does not import SQLite training snapshots. Accounts and credentials
remain in SQLite; its schema migrations still create and maintain those tables.
The one-shot Node JSON importer has been removed.

Weekly schedules contain ordered arrays of session objects. Calendar overrides
contain either `{ "rest": true }` or an explicit `sessions` array, including an
empty array to clear a day. Plan files use `opengym_plan: 2`. Older string-based
schedules, version-one plans, and pre-versioned browser user keys are not
converted. Session cookies must include the current session version; older
cookies require signing in again.

This code change does not delete stored profiles or backup files. Export current
Convex profiles through the authenticated read API before changing storage
backends. Existing SQLite snapshots do not receive edits made in Convex.

## Verification

Web tests exercise real Convex functions with `convex-test`: owner isolation,
service/browser separation, CAS conflicts, retry idempotency,
and record ordering. Go tests verify token claims and CAS retries. The opt-in
`TestLiveDevelopment` uses synthetic users against a configured development
deployment; it never reads real profiles.

```sh
CONVEX_TEST_URL=https://YOUR-DEV.convex.cloud \
CONVEX_TEST_KEY_DIR="$PWD/data" \
go test ./internal/convex -run TestLiveDevelopment -v
```
