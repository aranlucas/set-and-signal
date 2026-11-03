# Convex training backend

For storage ownership, write isolation, and persisted formats, see
[storage contracts](data-model.md). This guide covers deployment and recovery.

## Offline behavior and recovery

Active workouts stay local and are keyed by user. Guest and demo data stays
local; standalone mobile builds also keep a file mirror. Hosted
profiles cache the last received snapshot for offline display. Pending edits
are saved separately before they are transmitted and replayed after reopening.
This is a durable queue around Convex's in-memory mutation retries, not a
claim that Convex itself supplies persistent offline sync.

A conflict keeps the pending queue intact. Download the recovery file before
clearing browser storage. Review the affected records and choose local or synced
values; either choice saves a timestamped local recovery copy and preserves
unrelated pending edits. That local copy is lost if browser storage is cleared.
Account changes close the old Convex client. Signing out waits for pending
writes; a failed write leaves the session and edits intact.

## Configure a deployment

From `web`, run `pnpm exec convex dev` to create/link a Convex deployment.
The CLI stores its deployment URL in ignored `web/.env.local`.

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

From the repository root, initialize the key and print its **public** JWKS data URI:

```sh
DATA_DIR="$PWD/data" go run ./cmd/opengym-convex-key
```

For the root `pnpm dev` command, add
`PUBLIC_URL=https://set-and-signal.localhost` to `web/.env.local`. Keep
`CONVEX_URL` set to the matching deployment. Set these Convex deployment
variables with `pnpm exec convex env set` from `web`:

- `AUTH_ISSUER`: the Go API's exact `PUBLIC_URL` (`https://set-and-signal.localhost` for this local setup).
- `AUTH_JWKS`: the public data URI printed above.

Then run `pnpm exec convex dev --once` from `web` to push the functions and auth
configuration, then start `pnpm dev` from the repository root. For other
deployments, set `PUBLIC_URL` to the public API origin and match `AUTH_ISSUER`
exactly. The browser learns the URL from its authenticated `/api/convex/token`
response; it needs no deployment secret. Keep `web/.env.local`, signing keys,
and provider credentials out of Git.

## Verification

Web tests exercise real Convex functions with `convex-test`: owner isolation,
service/browser separation, CAS conflicts, retry idempotency,
and record ordering. Go tests verify token claims and CAS retries. The opt-in
`TestLiveDevelopment` writes synthetic users to a configured development
deployment. Its key must be trusted by that deployment with
`AUTH_ISSUER=http://localhost:3000`, matching the test's fixed issuer. Use a
dedicated test deployment; this differs from the Portless issuer above. The test
leaves synthetic records behind.

```sh
CONVEX_TEST_URL=https://YOUR-DEV.convex.cloud \
CONVEX_TEST_KEY_DIR="$PWD/data" \
go test ./internal/convex -run TestLiveDevelopment -v
```
