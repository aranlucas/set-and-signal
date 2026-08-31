# Changelog

## Initial public release — 2026-08-30

- Introduced the Set & Signal identity and the Working Proof visual system while
  keeping the existing routes, storage keys, exports, and workout flows compatible.
- Kept exercise images and animations outside the source snapshot, with a pinned
  runtime CDN and explicit attribution guidance in [NOTICE.md](NOTICE.md).
- Stopped both rest and timed-work countdowns when a workout is discarded, so a
  cancelled session cannot keep sounding or completing in the background.
- Made muscle-load analytics ignore warm-up ramp sets and retain canonical muscle
  weights for custom exercises after they are deleted.
- Kept deleted custom exercises visible in history, Stats, and the home progress
  insight through their persisted snapshot metadata.
- Published from a reviewed source-only root commit under the public Go module
  `github.com/aranlucas/set-and-signal`; private legacy refs and media blobs were
  not carried into the public repository.

The upstream [GitLab project](https://gitlab.com/DuarteSantos8/opengym) remains a
separate Node/JavaScript implementation. Only behavior and publication-boundary
improvements that fit this repository's Go/TypeScript architecture were carried
across; no upstream routes or data model were copied wholesale.
