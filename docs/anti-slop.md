# Anti-slop policy

Oxforge supplies all 18 generic rules through its published anti-slop dependency.
Native `oxc/no-accumulating-spread` remains an error. The existing standalone
lint pass imports the shared rule map rather than keeping a local copy.

Only the opt-in Effect rules and their tests remain in `web/tools/oxlint/effect/`,
with their original license and provenance. There is no direct Effect dependency,
so that policy remains disabled.

The existing strict, type-aware frontend checks retain their scope and settings.
`lint:strict` additionally runs `lint:anti-slop` across all owned web/backend/build
JavaScript and TypeScript. That second config adds generic policy to previously
unlinted files without imposing the frontend-only ESLint restrictions on Convex
transactions or sequential filesystem build scripts. Agent assets and vendored
rules are excluded; no application source or tests were blanket-excluded.

## Documented boundary exceptions

Per-line exceptions retain established contracts where changing a type or adding
a schema wrapper only to satisfy syntax would be misleading. Consumers still
validate domain fields. No `any` replacement or fabricated assertion was added.

- `parsePayload`, `payloadMessage`, `parseUser`: arbitrary server/account input
  immediately passes through its Valibot schema; existing normalized error text
  remains part of the contract.
- `parseCSV`, `parseWhen`, `parseWorkoutCSV`, `parseBodyweight`, `parseImport`:
  public import boundaries preserve accepted raw inputs and coercion, followed by
  their existing CSV/XML/date/domain checks. Internal cell helpers now use their
  actual string-cell contracts.
- `estimate1RM` load/repetition inputs and `clampToolNumber`: editable inputs are
  numerically coerced, checked for finite/range/cap constraints, and rejected or
  clamped before calculation. Normalizer exports use native schema parsers.
- The weight Slider callback validates the library's untyped scalar/array input
  before selecting a number. The Convex snapshot callback validates state before
  admitting it.
- `convex/model.ts`: heterogeneous forward-compatible persisted fields remain
  unknown through splitting/reassembly. The canonical serializer retains its
  object discrimination to avoid cloning values or changing property/getter
  evaluation and canonical conflict bytes. Collection IDs and mutation payloads
  are separately validated. Regression tests cover unknown fields, nested record
  metadata, prototype-named keys, omission versus null, stable key ordering,
  preserved collection order, and duplicate/invalid IDs.

## Test seams

Module replacements were removed. Convex tests inject a disabled real client and
spy only on instance operations, with explicit credential loading. UI tests use
real translation and router providers; the start chooser separates its store
container from a state-driven view. Browser globals use Vitest's scoped global
stubs and are restored. Existing persistence/concurrency/isolation tests remain.

The application Vitest config explicitly selects `test/**/*.test.*`; upstream
Effect RuleTester fixtures remain in `tools/oxlint/effect/test/` and run separately.
The formatter excludes those retained upstream assets.
