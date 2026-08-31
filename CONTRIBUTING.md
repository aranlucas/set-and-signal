# Contributing to Set & Signal

Small, focused pull requests are easiest to review. Keep the existing feature
flows and persisted data contracts intact unless a change explicitly includes a
migration and release note.

## Before opening a pull request

```bash
go test -race ./...
go vet ./...
go fix -diff ./...
cd web
pnpm format
pnpm lint:tailwind
pnpm lint
pnpm test
pnpm build
```

For visual work, check a narrow phone viewport and a desktop viewport, including
keyboard focus and dark mode. Use semantic theme tokens and the existing icon
primitives; do not introduce copied screenshots, local secrets, or bundled
exercise media. Update user-facing copy in every locale when a brand term changes.

## Commit and review notes

Describe the user-visible behavior, the routes or storage contracts touched,
and the verification you ran. If a change depends on a provider, CDN, or
environment variable, document the fallback and the privacy implication.
