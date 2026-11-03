# Set & Signal feature roadmap

Updated 2026-10-26. Proposed release order, not delivery dates or evidence of customer demand. Targets below are pilot decision gates, not measured results.

## User and outcome

A lifter who wants to finish a session quickly, keep a reliable log and understand the next workout.

## Prioritized releases

| Order | Feature                             | User value and scope                                                                                                                         | Release acceptance                                                                                                           |
| ----- | ----------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| Now   | A resilient in-gym session          | Keep the active exercise, last set and next suggested set obvious; preserve unsent set entries through connection loss and show sync status. | A user completes a session through a disconnect/reconnect without duplicate sets or losing a draft.                          |
| Next  | Explain and adjust the next workout | Show why the existing progression helper suggests a change and let the user accept, edit or substitute an exercise.                          | The accepted prescription and user overrides are recorded separately; later reviews can explain what was actually performed. |
| Next  | A weekly adherence review           | Compare planned and logged sessions, identify missed sessions and help the user choose a realistic next week.                                | Users can correct incomplete logs and reschedule deliberately; missing data is not treated as confirmed non-adherence.       |
| Later | User-approved assistant logging     | Allow an MCP client to draft a workout/log change with a preview of the affected session.                                                    | The user approves a concrete change and retries cannot append the same sets twice.                                           |

## Measure value before expanding

Baseline five gym sessions: taps/time per logged set, lost/duplicate entries, completed-session rate and weekly return use. Proposed gate: no lost or duplicate set entries in the disconnect pilot, with logging effort no worse than the current app.

Collect the baseline before building the first slice. Use voluntary pilot feedback and minimal aggregate events; do not log private content or credentials to measure adoption. If the first workflow is not used again, revisit the problem before adding the later features. Revenue impact is unvalidated.

## Dependencies and deliberate limits

Keep recommendations editable and avoid medical or guaranteed-outcome claims. Garmin can provide activity context later through explicit account linking; it must not overwrite manually logged strength work.

Update this roadmap when a user-visible increment ships, recording the outcome and remaining limits.
