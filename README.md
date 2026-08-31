# Set & Signal

[![CI](https://github.com/aranlucas/set-and-signal/actions/workflows/go.yml/badge.svg)](https://github.com/aranlucas/set-and-signal/actions/workflows/go.yml)
[![License: AGPL-3.0-or-later](https://img.shields.io/badge/license-AGPL--3.0--or--later-2855D9.svg)](LICENSE)

A privacy-first, self-hostable workout planner and training log — Go + SQLite API with an embedded React SPA and an OAuth-protected MCP endpoint.

## Features

- Build weekly plans and reusable routines; start a workout in one tap.
- Log sets, rest timers, notes, bodyweight, and measurements (offline-friendly).
- Track adherence, estimated 1RM progress, workout history, and muscle recovery.
- Import/export plans and backups without third-party data sharing.
- Preview and apply program changes from MCP clients (`preview_program` → `set_program` with `expectedRevision`).

## Stack

Go 1.27 + `modernc.org/sqlite` · chi router · React 19 + TanStack Router/Query · Vite 8 + Tailwind 4 · pnpm workspaces · Docker multi-stage build.

## Requirements

Go 1.27+, Node.js 24+, pnpm 11+.

## Run locally

```bash
pnpm install --frozen-lockfile

# Terminal 1: API (defaults: PORT=3000, DATA_DIR=/data, ORIGIN=http://localhost:8080)
DATA_DIR="$PWD/.data" ORIGIN=http://localhost:5173 go run ./cmd/opengym-api

# Terminal 2: web app (Vite on http://localhost:5173, proxies /api → http://127.0.0.1:3000)
pnpm --dir web dev
```

Copy [`.env.example`](.env.example) to `.env` for local overrides. Key variables:

| Variable | Default | Notes |
|---|---|---|
| `PORT` | `3000` | API listen port |
| `DATA_DIR` | `/data` | SQLite + session keys (`opengym.db`) |
| `DB_PATH` | `$DATA_DIR/opengym.db` | Override DB location |
| `ORIGIN` | `http://localhost:8080` | Allowed WebAuthn origin |
| `PUBLIC_URL` | `$ORIGIN` | Public HTTPS origin for OAuth issuer / MCP resource; set to `https://…` when exposing OAuth or MCP |
| `RP_ID` / `RP_NAME` | `localhost` / `Set & Signal` | WebAuthn relying party |
| `GOOGLE_*` / `GITHUB_*` / `APPLE_*` | — | At least one OIDC provider for web sign-in + MCP OAuth |
| `ADMIN_UIDS` / `INVITE_ONLY` | — | Comma-separated admin UIDs; `1`/`true`/`yes`/`on` to require invites |
| `SESSION_DAYS` | `90` | Cookie lifetime, clamped to ≥ 1 |
| `OPENROUTER_API_KEY` / `OPENROUTER_MODEL` | — / `openai/gpt-4o-mini` | Optional AI workout suggestions |

Exercise images/animations are not bundled; the web build loads them at runtime from a pinned jsDelivr commit of `hasaneyldrm/exercises-dataset` (override with `VITE_IMG_BASE` / `VITE_GIF_BASE`). See [NOTICE.md](NOTICE.md).

## Deploy

Single Docker image builds the SPA and embeds `web/dist` in the Go binary:

```bash
docker build -t set-and-signal .
docker run --rm -p 3000:3000 -v set-and-signal-data:/data set-and-signal
```

For Railway, the production topology (service + 5 GB volume at `/data`) is declared in [`.railway/railway.ts`](.railway/railway.ts). See [the infrastructure guide](.railway/README.md):

```bash
pnpm infra:check
pnpm infra:plan   # always review before apply
pnpm infra:apply
```

## MCP

Connect an MCP client to `https://your-host.example/mcp`. The server advertises OAuth protected-resource metadata and supports dynamic client registration with Authorization Code + PKCE. Program writes are revision-checked — call `preview_program` first, then pass its `expectedRevision` to `set_program`.

## Privacy

Guest and mobile (Capacitor) data stays on-device. Self-hosted accounts are stored per-profile in SQLite under `DATA_DIR`. Never commit `/data`, `.env`, OAuth credentials, VAPID keys, or `OPENROUTER_API_KEY`. When enabled, suggestions send only the selected prompt to OpenRouter. Exercise media attribution is in [NOTICE.md](NOTICE.md).

## Development

```bash
go test -race ./...
go vet ./...
go fix -diff ./...
pnpm infra:check
pnpm --dir web format        # check; use format:write to fix
pnpm --dir web lint:tailwind
pnpm --dir web lint
pnpm --dir web test          # validates exercise catalog + app tests
pnpm --dir web build
```

Additional web scripts: `pnpm --dir web i18n:check` / `i18n:extract`, `pnpm --dir web build:mobile` (Capacitor), `pnpm --dir web catalog:validate`.

Routes: `/home`, `/plan`, `/plan/r/$id`, `/workout`, `/stats`, `/history`, `/library`, `/settings`, `/admin` plus home sheets — see [docs/architecture.md](docs/architecture.md) for dependency direction and where new code belongs.

Read [CONTRIBUTING.md](CONTRIBUTING.md) before opening a PR and [SECURITY.md](SECURITY.md) to report a vulnerability. Product, design, and i18n references live under [`docs/`](docs/README.md).

## License

Set & Signal is licensed under the [GNU AGPL v3 or later](LICENSE). Third-party attributions are listed in [NOTICE.md](NOTICE.md).
