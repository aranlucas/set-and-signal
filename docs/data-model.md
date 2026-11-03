# Storage and compatibility contracts

## Ownership and writes

| Data                                                       | Authority                                    |
| ---------------------------------------------------------- | -------------------------------------------- |
| Accounts, credentials, OAuth, push subscriptions           | SQLite                                       |
| Saved routines, completed workouts, measurements, settings | Convex owner-scoped records                  |
| Active workout                                             | Device-local state, isolated by account      |
| Guest training data                                        | Browser localStorage                         |
| Standalone mobile data                                     | Local state plus `workset-state.json` mirror |

Convex stores workouts, routines, custom exercises, and profile fields as
independent records; order records preserve array order. Browser writes compare
each changed record with its previous value and commit atomically. Replaying the
same value succeeds; stale competing edits conflict. Only server-signed service
identities can replace a snapshot. Go mutations use bounded compare-and-swap
retries against the server-owned revision. Clients derive ownership from the
authenticated identity, never a caller-selected user ID.

The authenticated `GET /api/data` returns snapshots for exports and integrations.
Browsers write through Convex; there is no whole-profile HTTP upload endpoint.
Unknown export fields must survive typed Go mutations. See
[offline recovery](convex.md#offline-behavior-and-recovery) before discarding
pending edits.

## Training formats

Completed workouts retain performed sets and target snapshots. CSV imports may
omit targets because external files describe performed work rather than a
prescription. Deleted custom exercises retain names and muscle metadata in
`muscleSnapshot` so historical analytics remain meaningful.

Weekly schedules map weekday keys to ordered session arrays. Calendar overrides
contain either `{ "rest": true }` or an explicit `sessions` array; an empty array
clears the weekly template for that date. Plan files use `opengym_plan: 2`.
String schedules and version-one plans are rejected rather than converted.
Active workouts are excluded from hosted training records.

## Migration boundaries

Startup does not import old SQLite training snapshots into Convex. Those
snapshots do not receive Convex edits. Export current Convex data before changing
storage authority; changing configuration does not restore another backend's
edits. SQLite schema migrations still run for identity and operational tables.

The browser reads `gym_user@v1` directly without importing pre-versioned user
keys. Older session cookies require signing in again. Preserve the runtime names
`opengym-api`, `opengym.db`, `gym_state_v1`, `opengym_plan`,
`workset-state.json`, and OAuth scope `workset`: they protect deployments, local
data, exports, and client grants despite the Set & Signal product name. Changes
to these identifiers, API payloads, or route paths require compatibility and a
migration plan.
