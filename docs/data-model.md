# Data model and storage

> The review below describes the pre-Convex architecture. The hosted training
> backend has since moved to Convex; see [current setup and migration](convex.md).
> SQLite now retains identity data and pre-migration training snapshots.

## Current ownership

| Data | Authoritative storage | Access pattern |
| --- | --- | --- |
| Accounts, credentials, OAuth, push subscriptions | SQLite tables | Keyed lookups and transactional changes |
| Saved plans, completed workouts, measurements, settings | One JSON document per user in SQLite `user_state` | Whole-profile browser sync; typed server mutations |
| Active workout | Device-local application state | Frequent set edits; resume after reload |
| Guest data | Browser localStorage | Whole-profile persistence |
| Standalone mobile data | Local state plus `workset-state.json` mirror | Offline use, restore after WebView storage eviction |

SQLite is already the server database. Training records are documents inside it,
so adding SQLite elsewhere would not by itself eliminate full-profile reads,
copies, or writes. Browser updates currently clone and serialize the whole
profile; hosted sync uploads that profile after a debounce.

The typed training repository owns training fields while preserving unknown
top-level fields during mutations. Completed workouts retain their performed
sets and prescription snapshots; they must not be reconstructed from today's
editable routine. The full-state upload removes `active`, which stays local.

## Changes in this review

- Decode the typed training view directly from stored JSON. The intermediate
  object decode and re-encode added work to every load and mutation.
- Preserve raw JSON values in whole-profile uploads. Decoding arbitrary fields
  through floating-point numbers rounded large integers and precise decimals
  before SQLite ever received them.
- Use SQLite WAL mode so an existing reader can retain its snapshot while a
  writer commits. Keep immediate transactions for atomic mutations, the
  per-connection foreign-key and busy-timeout settings, default checkpointing,
  and the default durability setting.
- Read admin user summaries through one SQLite projection with an indexed
  subscription existence check. Full workout documents no longer cross into
  Go just to compute counts and the last stored workout date. The query honors
  request cancellation and reads one consistent database snapshot; the
  authenticated drill-down remains the separate full-history path.

A local synthetic benchmark with 10 users and 1,000 workouts per user measured
about 24 MB of Go allocations per summary request before the projection and
11 KB after it. Median time across three runs was 38.3 ms versus 8.1 ms.
These are benchmark allocations, not total process memory or production latency:
SQLite still reads and parses the JSON documents internally. The summary-data
query count drops from `1 + 2 * users` to one, excluding authentication queries.

WAL requires a local filesystem shared by processes on the same host. The
database has companion `-wal` and `-shm` files while open. Use SQLite's online
backup facility or stop the service and close its database before copying it;
copying only the live `.db` file is not a complete backup. See the official
[WAL documentation](https://sqlite.org/wal.html).

## Next priority: synchronize changes safely

`_ts` currently mixes client modification time with a server revision. Typed
server mutations are atomic and can check an expected revision; browser
`PUT /api/data` replaces the document unconditionally. A stale browser can
therefore overwrite an agent's update or another device's newer work. Moving
the same replacement operation into more tables would preserve that problem.

Introduce a server-owned revision separate from client timestamps. A client
must retain the revision it last read and send it with changes. A conflict
must preserve the pending local edit, fetch the newer state, and reconcile or
ask the user to resolve competing edits. A server-only rejection is incomplete:
today's client would retain dirty state without a conflict-resolution flow.

## Incremental relational model

If history size or query latency warrants normalization, start with completed
workouts, which grow independently of settings and the current plan:

- `workouts`: primary key `(user_id, id)`, performed date, explicit order, and
  the complete workout JSON. Index `(user_id, performed_date, id)` for history
  queries. Preserve explicit order because current "last entry" logic reads
  stored array order, not necessarily calendar order.
- Keep exercise entries and sets inside each workout initially. Their order,
  repeated exercise IDs, warm-ups, and target snapshots belong to the workout.
  Separate set tables only when measured cross-workout queries need them.
- Keep settings and the small plan document together until they need independent
  mutation or query behavior. Do not add tables solely to mirror every object.
- Treat units as part of the measurement contract. The current profile-wide
  unit setting relabels values; any canonical-unit or per-record-unit migration
  must handle existing histories explicitly instead of guessing their units.

The migration needs one authoritative write path: backfill and validate existing
records, route both granular mutations and legacy full-state uploads through
the same transaction, and reconstruct the legacy export shape on reads. Do not
leave a JSON blob and relational rows as independently writable copies. Test
imports, deletions, duplicate IDs, ordering, custom exercises, and round-trip
exports before switching authority. Keep an upgrade backup and verify rollback.

For the browser, indexed asynchronous local storage can remove synchronous
whole-profile persistence. Native SQLite may be appropriate for a larger mobile
history, but it introduces a separate storage adapter and migration. Neither is
needed for the server WAL and JSON-boundary improvements above.

## Sync library evaluation (2026-09-07)

| Option | Fit for the current architecture | Required work |
| --- | --- | --- |
| [RxDB HTTP replication](https://rxdb.info/replication-http.html) | Strongest candidate for a complete sync engine while retaining Go and server SQLite | Move the client to document collections; implement authenticated checkpointed pull and atomic conflict-checked push endpoints; define conflict policy and local-storage migration |
| [Dexie](https://dexie.org/docs/Dexie.js) | Smaller conceptual change for asynchronous IndexedDB persistence | Still needs a sync protocol; Dexie alone is local storage, while [Dexie Cloud](https://dexie.org/docs/cloud/consistency) supplies its own synchronization infrastructure |
| [PowerSync](https://powersync.com/) | Useful if adopting client SQLite and a supported source database | Current source integrations list Postgres, MySQL, MongoDB, and SQL Server; our server SQLite is not a listed source, so this adds a database migration and sync service |
| [Electric Sync](https://electric.ax/docs/sync/) | Useful with Postgres | Its read-path sync engine requires Postgres; writes still go through an application API |

Decision after tracing the current store and write paths: defer RxDB. It fits
the backend, but adopting it now is not a demonstrated simplification. The
existing Zustand store exposes whole-profile draft mutations; adding RxDB below
that interface would still clone and write whole histories and require a bridge
between two state systems. Replacing that interface with record queries is a
larger model migration, not something the replication library supplies.

RxDB could replace manual retry scheduling, replication checkpoints, and
cross-tab replication coordination. The application would still own the Go
transactional push/pull protocol, authenticated account isolation, guest-data
migration, record ordering and deletion semantics, and conflict resolution.
The standalone mobile build has no sync server and still needs its native file
backup when WebView storage is evicted. Neither this backup nor import/export
compatibility disappears with RxDB.

In particular, RxDB's [default conflict handler](https://rxdb.info/replication.html#conflict-handling)
uses the server version and discards the conflicting local version. Preserving
offline workout edits requires a deliberate custom policy and recovery flow.
Wrapping the current whole-profile PUT would leave the same conflict scope
while adding a database dependency.

Revisit RxDB when independently stored records and multi-device offline sync
are being implemented together, and compare it against a correct equivalent
implementation rather than today's incomplete sync. Require evidence that it
removes application-owned machinery and acceptable startup, bundle, and memory
costs before adopting it. Dexie remains a narrower candidate if the task is only
replacing synchronous localStorage; no new persistence dependency is added by
this review.

For an RxDB integration, use a server-controlled monotonically ordered checkpoint
and bounded batches, not client wall-clock timestamps. Authorize every batch by
the session user, commit record changes and checkpoint metadata atomically, and
retain deletion tombstones until the resynchronization policy allows pruning.
Repeated uploads must be idempotent. All writers, including MCP and legacy
uploads, must use that same mutation boundary. Preserve the local pending edit
on conflict; do not default to silently choosing the server's workout record.
Measure startup bundle size, memory, offline durability, concurrent edits,
reconnect, account switching, and guest-data migration before switching clients.
