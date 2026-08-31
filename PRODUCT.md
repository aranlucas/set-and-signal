# Set & Signal product context

## One-line promise

Set & Signal turns a saved training plan into the next clear action, then keeps
the record honest when the workout is complete.

## Who it is for

People who train consistently enough to have a plan but do not want their
training log to become a second job. The primary context is a phone on the gym
floor; the secondary context is a desktop where a plan, history, or export is
being edited.

## Core loop

1. Open Home and see today’s scheduled routine, the week strip, and current
   progress.
2. Start or resume the workout; log sets, rest, notes, and optional bodyweight.
3. Finish the session; the next working weights and history update from the
   saved record.
4. Return to Plan, Stats, History, Library, or Settings when a deeper edit is
   needed.

The routes, sheets, API payloads, and persisted state for this loop are stable.
The Set & Signal release changes the name and visual language, not the loop.

## Capability map

- **Plan:** routines, weekly assignments, day overrides, curated starting plans,
  and import/export.
- **Workout:** check-in, working sets, warm-ups, rest timer, notes, progression,
  and resume after reload.
- **Record:** history, estimated 1RM, adherence, streaks, recovery, bodyweight,
  and measurements.
- **Library:** searchable exercise catalogue, exercise details, custom exercises,
  and add-to-plan flow.
- **Account:** guest/local mode, WebAuthn, OIDC providers, profile sync, push,
  backup, language, units, theme, and mobile reminders.
- **Agents:** OAuth 2.1 + PKCE protected MCP tools with revision-checked program
  previews and typed read/write operations.

## Public identity

The product is **Set & Signal**. The visual world is **Working Proof**: warm paper,
near-black ink, vermilion action, registry-blue progress, and editorial proof
rules. Home uses **Press Signatures**—three horizontal records for session,
recovery, and weekly progress—with a single overprinted resume action.

The mark is a registration rail with three signal cuts. It is deliberately not a
dumbbell, barbell, or mascot. The full system is documented in [DESIGN.md](DESIGN.md).

## Privacy posture

Guest and mobile training data stays on-device. Self-hosted accounts live in the
operator’s SQLite volume. OAuth, Web Push, and MCP are opt-in deployment features.
OpenRouter suggestions are opt-in and send selected prompts to that provider;
the server remains fully useful without an OpenRouter key.

Exercise media is served from a pinned CDN copy rather than bundled in the public
source snapshot. This keeps the repository small and makes the upstream visual
media terms visible in [NOTICE.md](NOTICE.md).

## Compatibility boundary

The public Go import path is `github.com/aranlucas/set-and-signal`. The rebrand
keeps the runtime and migration identifiers `opengym-api`, `opengym-import`,
`opengym.db`, `gym_state_v1`, `opengym_plan`, `workset-state.json`,
`ch.duarte-santos.opengym2`, and the OAuth `workset` scope. Those identifiers
protect existing installations and data; they are not public product copy.
