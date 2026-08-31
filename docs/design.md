# Set & Signal design system

status: approved
identity: Set & Signal
world: Working Proof
composition: Press Signatures

Set & Signal is a private training log for the moment between intention and
action: a person has a plan, a phone in one hand, and wants to know what to do
next. The interface should feel like a well-kept proof sheet—measured, direct,
and useful under gym-floor conditions.

## Product contract

- The home surface answers “what is scheduled, what is in progress, and what
  changed this week?” without a tour or a marketing hero.
- The primary action is resume/start today’s workout. Existing route, state,
  auth, and storage behavior are preserved.
- Status is legible without color: labels, checks, diamonds, rules, and values
  carry the meaning; color reinforces it.
- The visual system is light-first, but the user-controlled dark theme remains
  available and uses the same warm palette.

## Visual world: Working Proof

The canvas is warm uncoated bone paper (`#F3ECDD`) with near-black ink
(`#171713`). Surfaces are paper-on-paper rather
than floating cards. Rules are 1px and quiet; crop and registration marks make
the act of recording visible. Fields are square or lightly clipped, never a
stack of identical rounded cards.

- Vermilion (`#E84A35`) is reserved for the active state and one primary action.
- Registry blue (`#2855D9`) marks completion, progress, and navigation signal.
- Body copy uses the existing sans stack; headings use the editorial heading
  token; measurements use tabular numerals and a monospace face.
- Display text is compact and weighted, with generous space above headings and
  short measures below. Avoid decorative gradients, glass, noisy texture, and
  generic fitness pictograms.

## Press Signatures composition

The Home route reads as three horizontal signatures:

1. **Session proof** — compact wordmark/settings, the seven-day galley, then
   today’s routine and a prominent resume/start action.
2. **Recovery proof** — effective-set recovery values for the selected routine.
3. **Weekly record** — adherence, streak, recent progress, bodyweight, and
   measurements, all sourced from the existing state model.

Strong rules separate the signatures. Marginal proof IDs and small crop marks
are orientation aids, not marketing labels. The vermilion resume action may
overprint the boundary between the session and recovery signatures; it is the
single memorable movement on the page.

## Components

- `BrandMark.tsx` is a one-color registration rail with three signal cuts. Use
  it beside the Set & Signal wordmark in Home, login, loading, and install
  metadata. Exercise icons remain exercise icons.
- `WeekCalendar.tsx` keeps the seven-day grid, selected date, accessible status
  labels, and legend. Its checks, diamonds, and rules use the proof palette.
- `TabBar.tsx` remains a five-destination index. The center action keeps its
  large touch target and active workout behavior, but uses the Set & Signal
  registration treatment instead of a dumbbell logo.
- `layout.tsx` rows remain the shared settings/list primitive. Rules and square
  icon stamps are the visual treatment; row semantics and keyboard behavior do
  not change.
- `PlanPrintDocument.tsx` carries the same ink, paper, and vermilion rules into
  the existing print/PDF flow.

## Accessibility and interaction

Keep body and placeholder text at 4.5:1 contrast, large text at 3:1, and retain
visible `:focus-visible` rings. Preserve minimum touch targets, keyboard order,
reduced-motion behavior, loading/error/empty states, and status text alongside
every visual mark. Hover and active states should tint the existing surface,
not hide the control behind animation.

## Compatibility boundary

The public identity is Set & Signal, and the Go module follows the public source
repository at `github.com/aranlucas/set-and-signal`. The following runtime and
migration identifiers remain unchanged on purpose: binaries `opengym-api` and
`opengym-import`; database `opengym.db`; browser key `gym_state_v1`; export key
`opengym_plan`; mobile file `workset-state.json`; native app id
`ch.duarte-santos.opengym2`; and the OAuth scope `workset`. Do not rename these
without a compatible data and deployment migration.

## Implementation notes

Theme tokens live in `web/src/app/index.css`; use semantic classes (`bg-card`,
`bg-muted`, `text-primary`, and their peers) rather than per-component colors.
Exercise media resolves from the pinned dataset CDN by default because the
upstream visual files have separate terms; see [NOTICE.md](../NOTICE.md).

The approved composition reference is kept out of the source release as a
design artifact. The implementation contract is this document and the body
comment in `web/index.html`.
