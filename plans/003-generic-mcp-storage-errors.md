# Plan 003: Keep internal storage errors out of MCP tool responses

> **Executor instructions**: Follow the steps, run every verification, and honor
> the STOP conditions. Update `plans/README.md` when done.
>
> **Drift check (run first)**: `git diff --stat bb294b5..HEAD -- internal/httpapi/mcp.go internal/convex/client.go`

## Status

- **Priority**: P3
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none
- **Category**: security (data minimization)
- **Planned at**: commit `bb294b5`, 2026-11-11

## Why this matters

MCP write tools return repository errors to the assistant unchanged. Examples:
`logWorkoutTool` (`internal/httpapi/mcp.go:249-255`), `logBodyweightTool`
(`:180-200`), `setProgramTool`, `add/remove_day_session` and
`logExerciseSetsTool` (`:461-477`). Those errors include transport details such
as `"Convex HTTP 500"`, `"Convex function failed: <server message>"`
(`internal/convex/client.go:128-140`) and `"store: mutate state <uid> ..."`
(`internal/store/state.go`). The REST equivalents map the same failures to
`"server error"` (`internal/httpapi/granular.go`). Input-validation and
revision-conflict errors should still reach the assistant, because the
assistant uses them to correct its call.

## Steps

1. In `internal/convex/client.go` and `internal/store/state.go`, wrap transport
   and storage failures in a sentinel such as `store.ErrUnavailable` (use
   `%w`). Do not wrap errors that come back from the caller's `fn`.
   **Verify**: `go vet ./...` → no output.
2. In `mcp.go`, add a helper `mcpError(err error) error` that returns
   `errors.New("server error")` when `errors.Is(err, store.ErrUnavailable)`, and
   returns `err` unchanged otherwise. Apply it to every write tool.
3. Add an `internal/httpapi/mcp_test.go` case that uses a failing store and
   asserts the generic message. Keep one case that asserts a validation message
   (for example, a missing exercise weight) still reaches the caller.
   **Verify**: `GOMAXPROCS=2 go test -p 1 ./internal/httpapi -run MCP` → ok.

## STOP conditions

- If the store cannot be made to fail in tests without a new mocking layer,
  report back instead of adding one.
