# Data model and storage

## Ownership

| Data | Authoritative storage | Access pattern |
| --- | --- | --- |
| Accounts, credentials, OAuth, push subscriptions | SQLite tables | Keyed lookups and transactional changes |
| Saved plans, completed workouts, measurements, settings | Convex owner-scoped records | Reactive browser reads; atomic record mutations; typed Go mutations |
| Active workout | Device-local application state | Frequent set edits; resume after reload |
| Guest data | Browser localStorage | Local persistence |
| Standalone mobile data | Local state plus `workset-state.json` mirror | Offline use, restore after WebView storage eviction |

The hosted API requires a configured Convex deployment. SQLite retains identity
and integration data. Existing SQLite training snapshots are not imported at
startup, and the Node JSON importer has been removed.

## Training contracts

The typed Go repository owns training fields while preserving unrelated JSON
fields during mutations. Completed workouts retain performed sets and target
snapshots. CSV imports can omit a target because the external file records
performed sets rather than a prescribed plan. Deleted custom exercises retain
names and muscle metadata in `muscleSnapshot`.

Weekly schedules map weekday keys to ordered arrays of session objects.
Calendar overrides contain either `{ "rest": true }` or an explicit `sessions`
array. An empty array clears the weekly template for that date. Plan exports
use `opengym_plan: 2`. String schedules and version-one plans are rejected;
readers do not convert old formats.

Go validates typed requests with `go-playground/validator`; the frontend uses
Valibot schemas for persisted and server data. Device-local drafts and server
patches may contain a partial current state. Active workouts are excluded from
hosted training records.

## Writes and conflicts

Convex stores workouts, routines, custom exercises, and profile fields as
independent records. Order records preserve array order. Each record belongs
to its authenticated owner; browser clients cannot select another owner or
replace an entire snapshot.

Browser writes compare changed records with their previous values and commit
atomically. Replaying the same value succeeds; stale competing edits produce a
conflict and retain the local pending queue for review or recovery. Go service
identities use a bounded compare-and-swap retry against a server-owned revision.
The authenticated `GET /api/data` endpoint returns snapshots for exports and
integrations. The former whole-profile upload endpoint is removed.

Hosted caches, pending edits, and active workouts are isolated by account.
Guest and mobile persistence remain local. The application reads the current
versioned user storage key directly and does not move pre-versioned keys.
See [Convex setup and storage](convex.md) for deployment and recovery details.

## SQLite operation

SQLite schema migrations create and maintain the identity and integration
tables. They remain part of application startup. The database uses WAL and a
busy timeout so readers can proceed during writes. Store tests use SQLite as a
local training repository to exercise atomic mutations without cloud access.

Stored backup files and profiles are not deleted by the compatibility cleanup.
Changing code or storage configuration does not restore edits from another
backend; export current data before changing storage authority.
