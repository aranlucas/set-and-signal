# Plan 002: Reject cross-origin browser requests to cookie-authenticated API mutations

> **Executor instructions**: Follow this plan step by step and run every
> verification. Honor the STOP conditions. Update `plans/README.md` when done.
>
> **Drift check (run first)**: `git diff --stat bb294b5..HEAD -- internal/httpapi/router.go internal/httpapi/respond.go cmd/opengym-api/main.go`

## Status

- **Priority**: P2
- **Effort**: S
- **Risk**: MED (an over-broad guard would block OAuth callbacks or MCP clients)
- **Depends on**: none
- **Category**: security
- **Planned at**: commit `bb294b5`, 2026-11-11

## Why this matters

State-changing `/api/*` routes accept the `gymsid` session cookie
(`requireAnyAuth`, `internal/httpapi/router.go:183-190`). The only defense
against forged requests is `SameSite=Lax` on that cookie
(`internal/auth/session.go:129`). `readJSON` (`internal/httpapi/respond.go:41`)
does not check `Content-Type`, so a `text/plain` form POST carrying a JSON
body is parsed. `SameSite=Lax` does not stop requests from a _same-site_
origin, such as a sibling subdomain on a shared self-hosting domain. Go's
standard library includes `http.CrossOriginProtection` (Go 1.25+, and the repo
uses Go 1.27), which rejects cross-origin non-safe browser requests using
`Sec-Fetch-Site` / `Origin`.

## Current state

- `Router` (`internal/httpapi/router.go:39-101`) mounts everything on one chi
  router with only `s.resolveCaller` middleware.
- These must keep working:
  - `POST /oauth/callback/{provider}` (Apple form_post, a cross-site request by
    design: `internal/oauth/authorize.go:205`);
  - `POST /oauth/token` and `/oauth/register` (non-browser clients);
  - `/mcp` (bearer clients, which may run in a browser on another origin).

## Steps

1. Wrap only the `/api/*` routes with `http.NewCrossOriginProtection()`. Either
   mount the API routes in a `r.Group` with `r.Use(cop.Handler)`, or wrap the
   router and call `AddInsecureBypassPattern` for `/oauth/` and `/mcp`. Read the
   `net/http` docs (`go doc net/http.CrossOriginProtection`) first.
   **Verify**: `go doc net/http.CrossOriginProtection` prints the type.
2. Add tests in `internal/httpapi/router_test.go`:
   - a cookie POST to `/api/settings` with `Sec-Fetch-Site: cross-site` gets 403;
   - the same POST with `same-origin`, or with no fetch metadata (CLI), succeeds;
   - a cross-site POST to `/oauth/callback/apple` is not rejected by the guard.
     **Verify**: `GOMAXPROCS=2 go test -p 1 ./internal/httpapi -run CrossOrigin` → ok.
3. Run the full checks: `go test -race ./...`, `go vet ./...`, `go fix -diff ./...`.

## Done criteria

- [ ] The new tests pass, and the existing OAuth/Apple tests
      (`TestAppleProfileScopesUseFormPost`) still pass.
- [ ] Only `internal/httpapi/router.go` and its tests change.

## STOP conditions

- The Vite dev proxy (`web/vite.config.ts`) forwards requests in a way that makes
  same-origin browser requests look cross-origin. Report this rather than
  adding bypasses.

## Maintenance notes

New non-browser POST endpoints outside `/api` need an explicit decision about
whether this guard covers them.
