# Set & Signal

Set & Signal is a workout planner and training log.

## Run locally

Requires Go 1.27+, Node.js 24+, pnpm 12+, and a configured Convex deployment.
See [Convex setup and migration](docs/convex.md) before starting the hosted API.

```bash
pnpm install --frozen-lockfile
CONVEX_URL=https://YOUR-DEPLOYMENT.convex.cloud \
PUBLIC_URL=http://localhost:3000 \
DATA_DIR="$PWD/data" ORIGIN=http://localhost:5173 go run ./cmd/opengym-api
```

Run the web app in a second terminal:

```bash
pnpm --dir web dev
```

## Verify

```bash
go test -race ./...
go vet ./...
pnpm infra:check
```

The service is licensed under the [GNU AGPL v3 or later](LICENSE). See [`SECURITY.md`](SECURITY.md) for vulnerability reports.
