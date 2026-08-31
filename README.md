# Set & Signal

Set & Signal is a workout planner and training log.

## Run locally

Requires Go 1.27+, Node.js 24+, and pnpm 11+.

```bash
pnpm install --frozen-lockfile
DATA_DIR="$PWD/.data" ORIGIN=http://localhost:5173 go run ./cmd/opengym-api
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
