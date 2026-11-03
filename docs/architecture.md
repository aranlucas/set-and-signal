# Architecture boundaries

The Go server embeds the web build so a deployment ships one application binary.
Identity and operations stay in SQLite; hosted training records live in Convex.
See [storage contracts](data-model.md) and [Convex setup](convex.md).

## Backend

`cmd/opengym-api` composes the services. `internal/httpapi` owns HTTP and MCP
transport, identity checks, and responses; `internal/training` owns training
mutations and calculations. Training may depend on `store` and `exercises`, but
must not depend on `httpapi`. MCP shares the HTTP transport to avoid a second
authentication stack.

## Frontend

- `app` composes the application and may import any frontend layer.
- `features` own user flows and may use `domain`, `i18n`, and `shared`.
- `domain` owns reusable training and exercise rules without route or sheet
  ownership. It may use `shared` utilities and generated catalogue data.
- `shared` holds cross-feature primitives. Keep helpers used only by nearby
  feature files with that feature.

Use direct imports rather than new barrel files. Keep route pages lazy-loaded
from `web/src/app/router.ts` to preserve feature chunking.

Edit exercise content in `web/catalog`, then run
`pnpm --dir web instructions:generate`. `web/src/generated` and
`web/public/instructions` are outputs. The compact runtime catalogue excludes
instructions; the exercise-detail flow loads instruction shards on demand.

Railway uses a separate Go module in `.railway`; its persistent volume is not
part of the application image. Build and test ordering is documented in
[CONTRIBUTING.md](../CONTRIBUTING.md#checks).
