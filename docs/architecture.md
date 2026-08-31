# Architecture

Set & Signal ships as one Go server with an embedded React application. The
repository separates deployable entry points, backend domains, frontend
features, generated assets, and infrastructure so a change has one obvious
home.

## Repository map

```text
.
├── cmd/
│   ├── opengym-api/       # production server entry point
│   └── opengym-import/    # one-shot legacy data importer
├── internal/
│   ├── httpapi/           # HTTP routes, auth guards, static SPA and MCP transport
│   ├── training/          # training model, repository, analytics and prescriptions
│   ├── exercises/         # embedded exercise catalogue
│   ├── store/             # SQLite access and migrations
│   └── ...                # auth, OAuth, push, presence, AI and configuration
├── web/
│   ├── catalog/           # authored exercise catalogue and instruction shards
│   ├── scripts/           # catalogue generation and validation
│   └── src/
│       ├── app/           # bootstrap, router, global styles and client store
│       ├── domain/        # framework-light exercise and training rules
│       ├── features/      # pages and sheets grouped by user flow
│       ├── generated/     # generated source consumed by the app
│       ├── i18n/          # translation runtime, types and locale catalogues
│       └── shared/        # reusable components, hooks, utilities and UI primitives
├── docs/                  # product, design, architecture and i18n references
└── .railway/              # Railway infrastructure as code
```

## Backend boundaries

`cmd/opengym-api` is the composition root. It opens the store, constructs auth,
OAuth, WebAuthn, push, presence, and AI services, then passes those dependencies
to `internal/httpapi`.

`internal/httpapi` owns protocol concerns: request identity, authorization
guards, JSON responses, route registration, static delivery, and the MCP
Streamable HTTP endpoint. It delegates durable training state and calculations
to `internal/training`. Keeping MCP in this transport package avoids a second
HTTP/auth stack while keeping its data model and computations independent of
the router.

`internal/training` owns the typed training state, its repository, digest and
history projections, progression analytics, session prescriptions, and
exercise-set logging. It may depend on `internal/store` and
`internal/exercises`; it must not depend on `internal/httpapi`.

The intended dependency direction is:

```text
cmd/opengym-api -> internal/httpapi -> internal/training -> internal/store
                                   \-> auth/oauth/push/presence/ai
```

## Frontend boundaries

- `app` composes the application and may import any frontend layer.
- `features` own user flows such as Home, Plan, Workout, and Settings. A feature
  may use `domain`, `i18n`, and `shared` modules.
- `domain` contains reusable exercise and training rules without route or sheet
  ownership. It may use `shared` utilities and generated catalogue data.
- `shared` contains UI primitives and genuinely cross-feature helpers. Do not
  move a module here only because two nearby files use it.
- `generated` is rebuilt from `web/catalog` by the catalogue scripts. Edit the
  catalogue source, not generated output.

Use direct imports rather than new barrel files. Route pages remain lazy-loaded
from `web/src/app/router.ts` so feature chunks retain their existing loading
behavior.

## Workspace and build

The repository has one pnpm workspace and one lockfile at the root. Root scripts
manage Railway infrastructure; the `web` workspace owns frontend commands.
Examples:

```bash
pnpm install --frozen-lockfile
pnpm --dir web test
pnpm --dir web build
pnpm infra:check
```

The Dockerfile installs both root and web dependencies from that lockfile,
builds the SPA, then embeds `web/dist` into the Go binary. Runtime state belongs
under `/data`; it is not part of the image or repository.

## Compatibility rules

Folder and public product names may evolve without changing persisted
identifiers. The compatibility-sensitive names listed in
[the design guide](design.md) require an explicit migration. Preserve API
payloads, route paths, local-state keys, database filenames, and OAuth scopes
unless a change includes backwards compatibility and release notes.
