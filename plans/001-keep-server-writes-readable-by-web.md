# Plan 001: Server-side training writes always produce state the web app can load

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat bb294b5..HEAD -- web/convex/training.ts internal/training/repository.go internal/training/prescription.go internal/httpapi/program_preview.go internal/httpapi/granular.go`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P1
- **Effort**: M
- **Risk**: MED (tightens what the server accepts; some previously accepted MCP/REST inputs now get defaults or a 400)
- **Depends on**: none
- **Category**: bug
- **Planned at**: commit `bb294b5`, 2026-11-11

## Why this matters

Hosted training data lives in Convex. The browser loads the whole snapshot and
parses it with the strict Valibot schema `appStatePatch`
(`web/src/shared/lib/schemas.ts`). If **any** record fails, `parseStoredState`
returns `null` and `TrainingSync.accept` throws `"Invalid training data from
Convex"` (`web/src/app/store/training-sync.ts:236-240`). The account is then
stuck in the "Changes haven't synced" state on every device, and new remote
data never shows up.

Browser writes are validated record by record in `training:commit`, but Go
writes (every MCP tool and every REST mutation) go through `training:replace`,
which validates nothing beyond "is an object". Several ordinary Go write paths
persist values the browser rejects:

1. `log_exercise_sets` for a bodyweight exercise (for example push-ups, catalog
   id `0662`) without a weight stores a reps set with no `w`. The web
   `repsSet` requires `w`.
2. `set_program`, `POST /api/routine` and `POST /api/routines` accept exercises
   without `sets` (`MCPExConfig.Sets` is `omitzero`, `validate:"omitempty,..."`).
   The web `exerciseConfig.sets` is required.
3. `POST /api/settings` accepts any `theme`, `accent` or `gifSize` string up to
   24 characters, including `""` (the code comment says empty strings "clear"
   preferences). The web schema only accepts specific values for these fields.
4. `log_workout` accepts logged sets in any shape, for example `{done:true,r:8}`
   with no `w`.

One assistant call such as "log 3×10 push-ups" is enough to break the web app
for that account.

## Current state

- `web/convex/training.ts` — Convex mutations. `commit` validates each changed
  record (key pattern, canonical encoding, `appStatePatch`, record id). `replace`
  (service identity only, used by Go) splits the state and writes it without
  validation:
  ```ts
  // web/convex/training.ts:134-147
  const value = JSON.parse(args.state);
  if (!value || Array.isArray(value) || !validation.is(validation.object({}), value))
    throw new ConvexError("State must be an object");
  const next = new Map(splitState(value).map((row) => [row.key, row.value]));
  for (const row of records) {
    const value = next.get(row.key);
    if (value === undefined) await ctx.db.delete(row._id);
    else if (row.value !== value) await ctx.db.patch(row._id, { value });
  ```
- `internal/training/prescription.go:404-411` — `LogExerciseSets` copies `set.W`
  as is, and it can be `nil` for non-loaded exercises:
  `loggedSet := MCPLoggedSet{Done: done, W: cloneFloat(set.W), R: new(set.R)}`.
- `internal/training/repository.go:122-160` — `PutWorkout` validates the
  workout struct and loaded working sets but does not normalize set shapes or
  `Target.Sets`.
- `internal/httpapi/program_preview.go:47-78` — `normalizeRoutine` rounds
  numeric fields but leaves `Sets` nil when it is omitted.
- `internal/httpapi/granular.go:399-412` — `settingsPatch` only enforces
  `max=24` on `Theme`, `Accent` and `GIFSize`. `applySettings` copies every
  marshalled key into state with `maps.Copy`.
- Web defaults to match (`web/src/domain/training/history.ts:223-240`,
  `defaultConfig`): 3 sets for reps/time, 1 for cardio. Bodyweight reps sets
  store `w: 0`.
- Allowed web values: `theme` ∈ {dark, light}; `gifSize` ∈ {full, mini};
  `accent` ∈ `ACCENT_NAMES` in `web/src/shared/lib/accents.ts`
  (lime, sky, orange, violet, pink, red, teal, gold).

Conventions: Go tests are table or behavior tests under `internal/**/_test.go`.
Use `newTestEnv(t)` and `e.post(...)` in `internal/httpapi` (see
`validation_test.go`). Convex tests use `convex-test` in
`web/test/app/store/convex.test.ts`.

## Commands you will need

| Purpose         | Command                                           | Expected on success |
| --------------- | ------------------------------------------------- | ------------------- |
| Go tests        | `GOMAXPROCS=2 go test -p 1 ./internal/...`        | ok                  |
| Go vet / fix    | `go vet ./... && go fix -diff ./...`              | no output, exit 0   |
| Web tests       | `pnpm --dir web exec vitest run --maxWorkers=1`   | all pass            |
| Lint / format   | `pnpm format:check && pnpm --dir web lint:strict` | exit 0              |
| Typecheck/build | `pnpm --dir web build`                            | exit 0              |

## Scope

**In scope**: `web/convex/training.ts`, `web/test/app/store/convex.test.ts`,
`internal/training/prescription.go`, `internal/training/repository.go`,
`internal/training/types.go` (small helpers only), `internal/httpapi/program_preview.go`,
`internal/httpapi/granular.go`, and Go tests next to them.

**Out of scope**: the browser schema itself (`web/src/shared/lib/schemas.ts`). It
is the contract; do not loosen it. Also out of scope: `TrainingSync` error
handling, and repairing data that is already invalid (the "Maintenance notes"
cover this).

## Steps

### Step 1: Validate changed records in `training:replace`

Extract the per-record checks from `commit` into a shared function, for example
`checkRecord(key, value)`, and call it from `replace` for every new or changed
record. Throw `ConvexError` and write nothing when a check fails. Leave records
whose stored value is unchanged alone, so legacy data does not block unrelated
server edits.
**Verify**: a new convex-test case shows that `replace` with a reps set missing
`w` rejects and leaves the snapshot unchanged.

### Step 2: Normalize logged sets on Go write paths

Add a training helper that maps an `MCPLoggedSet` onto one web shape:

- cardio (`min` or `speed`) needs both values;
- time (`sec`) gets `w` 0 when it is missing;
- reps (`r`) gets `w` 0 when it is missing;
- a set with none of these is an error.

Apply it in `LogExerciseSets` and `PutWorkout`. In `PutWorkout`, also default a
missing `entry.Target.Sets` to the number of logged sets (at least 1), which
mirrors `LogExerciseSets`.
**Verify**: Go tests show that push-ups logged without a weight store `w=0`,
and that `log_workout` with a shapeless set returns an error.

### Step 3: Default exercise `sets` in routines

In `normalizeRoutine`, set a missing `Sets` to 3, or to 1 for a cardio
exercise, matching web `defaultConfig`.
**Verify**: a Go test shows that `POST /api/routine` with `{"id":"bench"}`
stores `sets: 3`.

### Step 4: Constrain presentation settings

Use `oneof` validation for theme, accent and gifSize, and keep `omitempty` so
`""` is still accepted. In `applySettings`, delete a key whose value is `""`
instead of storing it, which keeps the documented "empty clears" behavior.
**Verify**: a Go test shows that `theme:"system"` returns 400 and that
`theme:""` removes the stored theme.

## Test plan

- Convex: `replace` rejects an invalid changed record atomically, and accepts a
  write when a legacy invalid record is unchanged.
- Go training: bodyweight `LogExerciseSets` stores `w=0`; `PutWorkout` defaults
  set weights and target sets, and rejects sets with no shape.
- Go httpapi: a routine without sets gets the default; settings enums and
  clearing behave as described.

## Done criteria

- [ ] All commands in the table exit 0.
- [ ] New tests exist and fail on `bb294b5` (check by reasoning, or by
      temporarily reverting the source).
- [ ] `git status` shows only in-scope files and `plans/`.

## STOP conditions

- A Go test that exists today asserts that an exercise without `sets` is
  stored without `sets` (that would be a contract decision).
- Convex validation rejects data produced by an existing Go test fixture through
  the real handlers, outside the four cases above.

## Maintenance notes

- New fields added to the web schema must also be emitted by Go writers. The
  Convex `replace` check is the backstop: Go gets an error instead of
  corrupting the profile.
- Accounts already corrupted before this fix still fail to load in the browser.
  A follow-up could add a repair path that lists the invalid record keys.
