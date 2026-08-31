# Railway infrastructure

[`railway.ts`](railway.ts) declares the production Set & Signal project: one
Dockerfile-built Go service and the persistent SQLite volume mounted at `/data`.
Railway-generated domains remain attached but are not managed by the IaC API.

The service and volume retain their original Railway resource addresses so the
declaration can adopt the existing deployment without recreating or detaching
its data. Those names are infrastructure identifiers, not product branding.

## Prerequisites

- Node.js 24+ and pnpm 11+
- Railway CLI 5.42.1 or newer
- Access to the linked Railway project and its `production` environment

Install the authoring SDK and type-check the declaration:

```bash
pnpm install --frozen-lockfile
pnpm infra:check
```

Always review a plan before applying it:

```bash
railway link
railway environment production
pnpm infra:plan
pnpm infra:apply
```

`OPENROUTER_API_KEY` uses `preserve()`: Railway retains the value already stored
in the environment and never writes it to this repository. Before applying the
file to a brand-new Railway project, create that optional variable or remove its
entry if AI suggestions should remain disabled.

The generated `opengym2.up.railway.app` hostname is kept as a compatibility
boundary for existing OAuth clients, passkeys, and bookmarks. Add and verify a
custom domain before changing `domains`, `ORIGIN`, `PUBLIC_URL`, or `RP_ID`
together.
