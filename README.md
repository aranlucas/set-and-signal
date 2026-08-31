# Set & Signal

[![CI](https://github.com/aranlucas/set-and-signal/actions/workflows/go.yml/badge.svg)](https://github.com/aranlucas/set-and-signal/actions/workflows/go.yml)
[![License: AGPL-3.0-or-later](https://img.shields.io/badge/license-AGPL--3.0--or--later-2855D9.svg)](LICENSE)

A simple workout planner and training log.

## Features

- Build weekly plans and reusable routines.
- Log sets, rest timers, notes, bodyweight, and measurements.
- Track adherence, estimated 1RM progress, workout history, and muscle recovery.
- Import and export plans and backups.
- Preview and apply program changes from MCP clients.

## Run locally

Requires Go 1.27+, Node.js 24+, and pnpm 11+.

```bash
pnpm install --frozen-lockfile

# Terminal 1: API
DATA_DIR="$PWD/.data" ORIGIN=http://localhost:5173 go run ./cmd/opengym-api

# Terminal 2: web app
pnpm --dir web dev
```

Runtime configuration is documented in [`.env.example`](.env.example). Set
`PUBLIC_URL` to the public HTTPS origin when exposing OAuth or MCP, and configure
Google, GitHub, or Apple credentials to enable sign-in. OpenRouter-powered
workout suggestions are optional.

## Deploy

The Docker image builds the web app and embeds it in the Go server:

```bash
docker build -t set-and-signal .
docker run --rm -p 3000:3000 -v set-and-signal-data:/data set-and-signal
```

For Railway deployments, follow [the infrastructure guide](.railway/README.md).

## MCP

Connect an MCP client to `https://your-host.example/mcp`. The server supports
OAuth 2.1 with dynamic client registration and PKCE. Program changes are
revision-checked: call `preview_program` before `set_program` and pass the
returned `expectedRevision`.

## Privacy

Guest and mobile data stays on the device. Self-hosted accounts are stored in
SQLite under `DATA_DIR`. Keep data files, credentials, and API keys out of
version control. If enabled, workout suggestions send the selected prompt to
OpenRouter.

Exercise media is loaded from a pinned third-party dataset and is not included
in this repository. See [NOTICE.md](NOTICE.md) before mirroring or redistributing
it.

## Development

```bash
go test -race ./...
go vet ./...
pnpm infra:check
pnpm --dir web format
pnpm --dir web lint:tailwind
pnpm --dir web lint
pnpm --dir web test
pnpm --dir web build
```

See [the documentation index](docs/README.md) for architecture, product, design,
and internationalization guides. Read [CONTRIBUTING.md](CONTRIBUTING.md) before
opening a pull request and [SECURITY.md](SECURITY.md) to report a vulnerability.

## License

Set & Signal is licensed under the [GNU AGPL v3 or later](LICENSE). Third-party
attributions are listed in [NOTICE.md](NOTICE.md).
