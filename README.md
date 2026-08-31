# Set & Signal

[![CI](https://github.com/aranlucas/set-and-signal/actions/workflows/go.yml/badge.svg)](https://github.com/aranlucas/set-and-signal/actions/workflows/go.yml)
[![License: AGPL-3.0-or-later](https://img.shields.io/badge/license-AGPL--3.0--or--later-2855D9.svg)](LICENSE)

Set & Signal is a privacy-first, self-hostable workout planner and set-by-set training
log. It keeps the next session obvious on a phone while giving the same data a
durable home: a Go API, SQLite storage, a React web app, and an OAuth-protected
MCP endpoint for coaching agents.

The product identity is new; the storage and protocol identifiers are deliberately
stable. Existing `opengym.db` files, `gym_state_v1` browser state, `opengym_plan`
exports, and native app data continue to work after the visual rebrand.

## What it does

- Build weekly plans, edit routines, and start a workout in one tap.
- Log sets, rest timers, notes, bodyweight, and measurements with offline-friendly
  browser or mobile storage.
- See adherence, estimated 1RM progress, history, and muscle recovery.
- Import/export plans and backups without sending data to a third party.
- Connect Grok, Cursor, or another MCP client through the server's OAuth 2.1 + PKCE
  flow. Preview program changes before applying them.

## Run locally

Requirements: Go 1.27+, Node 24+, and pnpm 11+.

```bash
go run ./cmd/opengym-api

# In a second terminal, during frontend work:
cd web
pnpm install
pnpm dev
```

For a production-shaped build, the Dockerfile builds the SPA and embeds it in the
single Go binary:

```bash
docker build -t set-and-signal .
docker run --rm -p 3000:3000 -v set-and-signal-data:/data set-and-signal
```

Copy `.env.example` to `.env` for local overrides. At minimum, set `PUBLIC_URL` to
the public HTTPS origin when enabling OAuth or MCP clients. Configure one or more
of `GOOGLE_*`, `GITHUB_*`, or `APPLE_*` credentials for sign-in.

## Architecture

- `cmd/opengym-api` — HTTP server binary
- `cmd/opengym-import` — one-shot migration from a legacy `./data` directory
- `internal/config` — environment parsing and runtime defaults
- `internal/store` — SQLite connection, goose migrations, and typed queries
- `internal/auth` — signed sessions, bearer tokens, and WebAuthn
- `internal/oauth` — OAuth 2.1 authorization server with DCR + PKCE
- `internal/api` — chi handlers, static SPA delivery, and MCP tools at `/mcp`
- `internal/exercises` — embedded exercise catalogue and instruction shards
- `web/` — React 19, Vite, Tailwind v4, and the browser/mobile surfaces

The frontend routes are unchanged: `/home`, `/plan`, `/plan/r/$id`, `/workout`,
`/stats`, `/history`, `/library`, `/settings`, and `/admin`, plus the existing
home sheets. The identity and visual system changed; those flows did not.

## Exercise media

The catalogue is embedded, but the large exercise image and animation files are
not part of the public source snapshot. The web build resolves them from a pinned
commit of `hasaneyldrm/exercises-dataset` through jsDelivr; deployments can set
`VITE_IMG_BASE` and `VITE_GIF_BASE` to an approved media host. This keeps clones
and container layers small and makes the media attribution boundary explicit.
See [NOTICE.md](NOTICE.md) before mirroring or redistributing that media.

## Clean public history

This public repository starts from a reviewed, source-only root commit. The
private development history and its media-bearing legacy refs were deliberately
not imported. Keep `web/public/img`, `web/public/gif`, generated builds, local
training data, design-review artifacts, and credentials out of future commits.

## Data and privacy

Guest and mobile state stays on the device. A self-hosted server stores each
authenticated profile in its own SQLite-backed state record under `DATA_DIR`.
`/data`, `.env`, OAuth credentials, VAPID keys, and OpenRouter keys are deployment
secrets and must never be committed. The optional OpenRouter-powered suggestions
feature sends the prompt you choose to that provider; leave `OPENROUTER_API_KEY`
unset to disable it.

## MCP

Point an MCP client at `https://your-host.example/mcp`. The server advertises its
OAuth protected-resource metadata, registers clients dynamically, and uses
Authorization Code + PKCE. Planning writes are revision-checked: call
`preview_program` first, then pass its `expectedRevision` to `set_program`.

## Development checks

```bash
go test ./...
go vet ./...
cd web
pnpm format
pnpm lint
pnpm test
pnpm build
```

Please read [CONTRIBUTING.md](CONTRIBUTING.md) before opening a pull request and
see [SECURITY.md](SECURITY.md) for private vulnerability reports.

## License and attribution

Set & Signal is released under the GNU Affero General Public License, version 3
or later. See [LICENSE](LICENSE) and [NOTICE.md](NOTICE.md) for the upstream code,
body-map, exercise catalogue, instruction, and media attributions that travel with
the project.
