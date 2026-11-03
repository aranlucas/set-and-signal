# Contributing to Set & Signal

Persisted-data and public-protocol changes need a compatible migration and a
release note. See the [storage contracts](docs/data-model.md).

## Checks

Install dependencies with `pnpm install --frozen-lockfile`, then run from the
repository root:

```bash
go test -race ./...
go vet ./...
go fix -diff ./...
(cd .railway && go test ./... && go vet ./...)
pnpm format:check
pnpm --dir web lint:strict
pnpm --dir web test
pnpm --dir web build
```

Run Go checks before the web build: Vite replaces `web/dist`, which Go reads
through `go:embed`. The web test command regenerates exercise artifacts before
Vitest; build includes typechecking. Local unit tests need no live Convex
deployment. The opt-in live check is described in the [Convex guide](docs/convex.md#verification).

For UI changes, check phone and desktop viewports, keyboard focus, and dark
mode. Follow the [interface constraints](docs/design.md) and
[translation workflow](docs/i18n.md). Describe the affected user behavior or
storage contract and the checks actually run in the pull request.

Infrastructure changes also require a reviewed `railway config plan`. Keep
plans and decrypted variables out of Git. Preserve data-bearing resource names
unless the change includes a migration and rollback procedure; see the
[Railway guide](.railway/README.md).
