# Untangle decision log — 2026-11-06

## Baseline and constraints

Inventory began at `19b725d` with a clean worktree. Preserve the merged test
pruning (#90), documentation pruning (#91), storage contracts, wire formats,
and feature behavior. Both comment and test additions are selected. Tests,
benchmarks, and builds run only in CI; no local test result is claimed.
Existing CI runs Go race tests, vet, web behavioral tests, lint, and a web build.
No owned local test execution was started.

## Inventory and redesign (recorded before implementation)

- Expose training operations at their implementation, and have HTTP transport
  name the training package directly.
  - `internal/training/facade.go` wraps private same-package functions without
    adding a contract or behavior.
  - `internal/httpapi/training.go` duplicates those wrappers and aliases almost
    the entire training model, hiding actual ownership from transport callers.
- Put curated training templates with training rules.
  - `domain/training/starter.ts` and `starting-strength.ts` import a feature
    module (`features/plan/curated.ts`) that has no UI dependencies.
- Separate store access from exercise and set data helpers.
  - `features/exercises/sheet-shared.ts` makes unrelated account, settings,
    workout, assistant, and plan flows depend on exercise sheets for store access.
  - Its exercise conversion and logged-set weight helpers have domain ownership.
- Colocate application composition and feature UI with their owners.
  - Shared AppNavigation, TabBar, Toast, SyncStatus, ErrorBoundary depend on
    application state/routing; registration belongs to auth; workout start and
    timer belong to workout. Shared exercise media and plate UI also read store
    preferences and belong to exercises. These are application/feature UI, not
    independent shared primitives.
- Retain the library and picker search contracts and their tests.
  - Initial inventory incorrectly classified `exercise-search.ts` as unused.
    CI exposed its library consumer. The library searches name, target, equipment
    and description; picker search also handles body parts, muscles and accent
    normalization. Preserve these distinct existing contracts.
- Keep imported plan bundles immutable when mapping IDs into a draft.
  - `mergePlan` uses `Object.assign(exercise, ...)`, mutating its input and sharing
    exercise objects across the bundle and destination. Re-importing a bundle
    then loses the original custom IDs. Copy each exercise instead; add a
    regression for repeated import with fresh custom IDs and independent drafts.
- Remove implementation-restating comments encountered in changed files; retain
  contract, external constraint, migration, and failure-recovery explanations.
  Keep meaningful layout/heading contract tests, including class-merging checks:
  those catch actual regressions and are not grounds for further pruning.

## Retained requirements and special cases

Offline queues, revision conflicts, local active workouts, native storage/reminder
mirrors, optional media and missing exercises are genuine product requirements.
Keep their branches and behavioral tests. Runtime validation uses Valibot;
routing, passkeys, query state, and forms retain the established libraries.
Do not replace the storage sync architecture or rename persisted MCP fields as
speculative cleanup. No new general-purpose library or custom script is needed.

## Review and validation

Read-only inventory review in progress, one subagent at a time. Subsequent review
findings and CI evidence will be recorded here before handback.

Inventory review also found duplicated session cookie policy in HTTP/OAuth,
a magic `__web__` OAuth client ID selecting browser login, and a manually
maintained training-field ownership list that duplicates JSON tags. Centralize
cookie creation in auth.Sessions using net/http, represent browser login with
an explicit flag, and derive owned fields from TrainingData tags using standard
reflection. Preserve cookie Max-Age=0 deletion and each transport's origin choice.

## Implementation and review results

Training implementations now export their operations directly; HTTP/MCP use
qualified domain references. Removed both redundant facades and the week-clone
wrapper chain. Kept the server's load adapter because it binds server storage.
Frontend UI moved to app/auth/workout/exercises owners, curated templates moved
to training, and exercise conversion/set-weight helpers moved to their domains.
Store callers access the store directly rather than importing sheet wrappers.
Retained both library and picker search modules and their meaningful tests
after correcting the initial inventory from CI evidence. Imported plan configurations are copied before ID remapping.
Shared cookie issuance/clearing now uses net/http, browser OAuth login has explicit
purpose, and persisted training ownership derives from the model's JSON tags.

The first review found three malformed type imports from the mechanical move;
all were corrected. The final independent review found no worthwhile remaining
structural or correctness issues. Reviews ran serially. Added CI regressions for
repeated plan import/input isolation and HTTP/HTTPS cookie issuance and deletion.
Existing meaningful tests were preserved. Local formatting and whitespace checks
completed; no local tests, builds, or benchmarks ran. CI is authoritative for
behavioral validation, type checking, and compilation. Baseline CI failures, if
any, will be distinguished from failures introduced here.

A local static lint invocation was stopped before producing a result; full lint
remains delegated to CI to avoid expensive local validation. No test process was
started or left running by this thread.

## CI round one

Go race tests, vet, modernization check, formatting and web behavioral tests
passed on `1cc8156`. Web lint identified introduced duplicate imports, a
render-time imperative store read, and an incorrectly deleted library search
helper. Restored that helper and all its original behavioral tests, combined
imports, and used a reactive selector in GoalSheet. Corrected the inventory
above. These are introduced failures, not baseline failures. No local tests
were used to reproduce them.

The follow-up independent static review confirmed the CI fixes and restored
search tests, with no further worthwhile issues. The revised head must pass CI.
