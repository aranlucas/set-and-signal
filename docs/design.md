# Interface constraints

Set & Signal serves people with a plan who want their next action to be obvious.
Design first for a phone on the gym floor, with desktop space for planning,
history, and exports. Home should answer what is scheduled, what is in progress,
and what changed this week; starting or resuming training is the primary action.

## Visual and interaction rules

Use the semantic theme tokens in `web/src/app/index.css` and existing shared UI
primitives. The current interface supports accent choices and light/dark themes;
use tokens rather than copying a palette into components. Keep measurements
aligned with tabular numerals.

Status needs text or a symbol alongside color. Keep text contrast at 4.5:1
(3:1 for large text), visible focus rings, keyboard order, reduced-motion
behavior, and loading/error/empty states. Preserve 44px touch targets in the
planning and workout controls.

The masthead carries the product name; profile identity belongs with save
status. Successful saves should not interrupt training. Show loading before an
uncached account's empty state. A failed save must leave edits available for
retry or recovery, and conflicts must show the affected records and changed
values before the user chooses a version. See [recovery behavior](convex.md#offline-behavior-and-recovery).

Keep [compatibility-sensitive identifiers](data-model.md#migration-boundaries)
separate from user-facing branding. Exercise media has separate redistribution
terms; preserve [NOTICE.md](../NOTICE.md).
