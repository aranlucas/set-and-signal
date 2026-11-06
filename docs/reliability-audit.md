# Correctness and reliability audit — 2026-11-06

Baseline: remote default `5b0c24a` (merged ownership cleanup #93). Clean isolated worktree; no structural cleanup. Tests and builds run only in CI.

## Inventory and boundaries

- Go API and CLI composition: configuration, embedded assets, SQLite migrations, passkeys/invites, signed cookies, admin guards, OAuth/OIDC and MCP. Public HTTP routes and MCP training contracts must remain compatible.
- Hosted training: Go typed repository uses service JWTs and Convex compare-and-swap; browser uses account-scoped JWTs and per-record expected/value commits. Convex indexes include owner. Pending edits and recovery copies are local per account. Authentication outages must preserve drafts and never claim successful synchronization.
- React web: route-based planner, active workouts, completed history, body measurements, settings, import/export, exercise catalogue and translations. Guest/demo state is local; active workouts remain per-device. Runtime validation uses Valibot.
- Capacitor standalone runtime: localStorage plus delayed native file mirror and notification scheduling. No committed iOS/Android shell projects exist, so this repository offers a web runtime, not a buildable native app target.
- Operations: bounded Convex/push HTTP clients, reminder timers, provider integrations, Railway module and CI. Ordinary regression fixtures must not call production services or require credentials.

## Confirmed findings before implementation

### R1 — newer mobile edits can be overwritten by an older file (high confidence, medium impact)

Location: `web/src/app/store/useStore.ts`, mobile `boot` restoration condition. Trigger: a profile has only settings, custom exercises, measurements or an unfinished workout, changes locally, then exits before the 800ms file mirror. On restart an older native file exists. `hasData(localState)` only counts completed workouts, routines and bodyweight, so the older file wins regardless of timestamps and is persisted over newer local edits. Expected: the newest timestamped copy wins; missing local data still restores the file. Add isolated mobile-store regressions including older/equal/newer file cases and empty local storage.

## Review and rejected hypotheses (initial)

- Existing queue storage admission and acknowledgment protections are intentional and covered by training-sync tests; do not replace them with a debounced save.
- Whole-state Go updates already use expected revisions; Convex transactions enforce account ownership and commit conflicts. No proven lost-update defect found there.
- Cookie-only admin/logout and disabled-user lookup guards are present. Do not invent a new authorization policy.
- Native file write failures fall back to localStorage by existing design; this is a reduced-durability limitation, not proof of successful durable file persistence.
- Independent review is in progress; findings will be reconciled before PR completion.

## Validation and e2e applicability

Existing Go race tests, vet, web Vitest, lint, typecheck/build remain required in CI. Published registry verified `e2e` 0.23.0 (tester-army/e2e), `@e2e-dev/web` 0.15.5 (peer e2e >=0.22.1); both require Node ^22.22.3 or >=24.8, compatible with repository Node 24.22.1. Current quickstart and CI documentation read; installation hooks will be suppressed locally. Deterministic web tests need no agent/model credentials. Planned meaningful journey: demo bodyweight logging, navigation and reload persistence. This covers the actual standalone browser product; it does not establish hosted passkey/OIDC/Convex or native plugin behavior. Native e2e cannot honestly run without committed buildable platform projects.

## Independent review findings before fixes

- R2 (high confidence, high impact): `internal/oauth/authorize.go` callback consumes a global pending state without an initiating-browser cookie or selected-provider binding. Forwarding an unconsumed callback signs another browser into the attacker's profile. Bind a random browser nonce and provider, reject mismatches before exchange/consumption; test both browser and MCP paths with fake providers.
- R3 (high confidence, high impact): Apple requests name/email with query response mode, which Apple requires to be form_post. Accept bounded POST callbacks and use a Secure SameSite=None transient binding cookie for Apple. Primary contract: https://developer.apple.com/documentation/signinwithapple/incorporating-sign-in-with-apple-into-other-platforms .
- R4 (high confidence, medium impact): abandoned OAuth login states never expire from the in-memory map. Prune expired states on insertion (under mutex).
- R5 (high confidence, medium impact): a stopped-but-running old rest callback can delete a newer timer, send early and leave the newer timer uncancellable. Check timer identity before claiming delivery. Add a deterministic blocked-callback race regression.

## Implementation and verification plan

- R1: compare native/local timestamps directly; mirror newer local settings-only profiles too. Four mobile-store cases cover older, newer, equal and missing local copies.
- R2–R4: each login establishes an HttpOnly cookie containing a random nonce; only its hash is kept in pending state. Callback admission requires that nonce and selected provider before consumption or provider exchange. MCP provider selection retains the same browser binding. Per-state cookie names allow separate concurrent login attempts. Apple uses Secure SameSite=None for its bounded form POST; other providers use SameSite=Lax. Expired abandoned entries are pruned under the map mutex on insertion.
- R5: stale callbacks must claim the current timer identity before delivery. A focused test models an already-dispatched old callback after replacement, checks no early send, and verifies the replacement remains cancellable. Existing normal timer firing/replacement/cancellation tests remain.
- Independent implementation review identified and corrected the e2e `expect` import (from `e2e`), Base UI slider scoping (named group around slider), and synchronization of the callback's captured timer pointer. No local tests/builds/browser sessions were run.
- CI adds explicit Go application build, meaningful deterministic demo bodyweight save/reopen/reload assertions through `e2e` + `@e2e-dev/web`, and uploaded runner traces/video/report. No model steps or provider credentials are used. These dependencies were selected because they are the user-requested upstream framework and compatible published web engine; existing framework/runtime versions were preserved.
- A separate CI job restores only original implementation files from `5b0c24a` and requires mobile stale-copy, foreign-browser callback, Apple response-mode and dispatched-timer regressions to fail. Read its logs alongside the passing fixed tests: an arbitrary setup/compiler failure is not sufficient reproduction evidence.

Residual limits: hosted external-provider login and Convex transport are covered by deterministic Go/fake-provider and Convex tests, not live credential-based browser journeys. No committed native shell can be built, so native plugin behavior requires downstream app CI. Time-based state pruning bounds retention to login TTL plus next insertion; it is not a rate limiter. A callback already claimed for delivery may finish during a later cancellation, matching timer cancellation semantics.

CI and merge outcome: [PR #94](https://github.com/aranlucas/set-and-signal/pull/94), CI pending. Final independent static review found no remaining concrete code blockers after its objections were addressed. No passing test claim is made here.

### R6 — stalled identity provider can leave sign-in pending indefinitely (review finding before fix)

`oidcCallback` passes the bare request context into `Provider.Exchange`; oauth2 and user-info calls use the default HTTP client without a timeout. If a provider accepts but never responds, a connected browser's sign-in request has no deadline (the server only bounds header reads). The fix applies a 30-second context deadline spanning token exchange and user-info retrieval. A fake provider that waits for context cancellation checks the bounded error response in Go's virtual-time test runner without external traffic.

## CI follow-up

Run [42307191814](https://github.com/aranlucas/set-and-signal/actions/runs/42307191814) passed the real e2e journey, web tests, Go vet and modernization checks. Its uploaded native reports demonstrate the intended mobile stale-copy assertion, foreign-browser callback assertion (302 and one provider exchange on the old version), and Apple's invalid scoped query response. The timer test exposed a test deadlock: `synctest.Sleep` also waits for runnable callbacks, while that test deliberately held their mutex. It now uses virtual `time.Sleep` before releasing the mutex, and waits for callbacks only after release. The proof gate rejected the timeout rather than counting it as reproduction.

CI also rejected a module mock and minor style issues in the mobile regression. The test now exercises the real Capacitor wrapper with spies on its exported web filesystem implementation and sets the mobile build environment through Vitest, preserving the same restoration and persistence assertions. No product fixes or existing checks were weakened. Replacement CI remains pending.

Run [42309815653](https://github.com/aranlucas/set-and-signal/actions/runs/42309815653) passed Go race tests after the synchronization correction. The mobile fixture revealed Vitest's externalized CommonJS filesystem bundle and the imported ESM filesystem class were distinct: its spies saw no calls. Vitest now inlines that package through its supported dependency configuration, so both paths share the exported ESM implementation. The persisted unit assertion uses typed captured write options rather than an untyped nested matcher. CI is the only execution environment for these changes.
