# Plan 004 (direction / spike): Preview assistant-drafted workout logs before they are written

> **Executor instructions**: This is a design spike. Produce a short design note
> and a prototype branch. Do not merge production behavior without the
> maintainer's sign-off.
>
> **Drift check (run first)**: `git diff --stat bb294b5..HEAD -- internal/httpapi/mcp.go internal/training/prescription.go ROADMAP.md`

## Status

- **Priority**: P3
- **Effort**: M (coarse)
- **Risk**: LOW (spike)
- **Depends on**: plans/001 (the preview must validate against the same web contract)
- **Category**: direction
- **Planned at**: commit `bb294b5`, 2026-11-11

## Why this matters

`ROADMAP.md` ("Later" row) lists _User-approved assistant logging_: "Allow an
MCP client to draft a workout/log change with a preview of the affected
session… retries cannot append the same sets twice." Programs already follow
this pattern: `preview_program` returns a diff and a revision, and
`set_program` takes `expectedRevision` (`internal/httpapi/mcp.go:107-153`).
Logging has no equivalent. `log_exercise_sets` and `log_workout` write
immediately (`mcp.go:249-255`, `461-477`), and `log_exercise_sets` takes no
`expectedRevision`.

## Spike questions

1. Can `LogExerciseSets` (`internal/training/prescription.go:371`) run against a
   copy of `TrainingData` and return the resulting workout plus a diff, without
   persisting it? (It is already a pure function over `*TrainingData`.)
2. Should approval be enforced by the server (a short-lived preview token that
   must accompany the write) or advisory (`expectedRevision` only, as with
   programs)?
3. How should the preview appear to the user? Assistant-side only, or as a
   pending item in the web app?

## Deliverable

`docs/assistant-logging.md` with an API sketch for `preview_log_exercise_sets`
(input matches `MCPLogExerciseSetsInput`, output `{workout, diff, revision}`), an
optional `expectedRevision` on `log_exercise_sets`, the decisions on questions
2–3, and a test list.
