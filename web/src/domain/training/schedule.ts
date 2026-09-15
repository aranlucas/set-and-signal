import { weekdayOf } from "@/shared/lib/format.js";
import type { AppState, DaySession, Id, IsoDate, Routine, Weekday } from "@/shared/lib/types.js";

type ScheduleState = Pick<AppState, "dayPlan" | "routines" | "week">;

function validSessions(appState: ScheduleState, sessions: DaySession[] | undefined): DaySession[] {
  if (!sessions?.length) return [];
  const validIds = new Set(appState.routines.map((routine) => routine.id));
  return sessions.filter((session) => validIds.has(session.routineId));
}

function weekSessions(appState: ScheduleState, weekday: Weekday): DaySession[] {
  return validSessions(appState, appState.week[weekday]);
}

/** Ordered planned sessions for `iso` (empty when rest). */
export function effectiveSessions(appState: ScheduleState, iso: IsoDate): DaySession[] {
  const override = appState.dayPlan[iso];
  if (override !== undefined) {
    if (override.rest) return [];
    return validSessions(appState, override.sessions);
  }
  const weekday = weekdayOf(new Date(`${iso}T12:00:00`));
  return weekSessions(appState, weekday);
}

export function effectiveRoutineIds(appState: ScheduleState, iso: IsoDate): Id[] {
  return effectiveSessions(appState, iso).map((session) => session.routineId);
}

/** First planned routine id for `iso`, or null when rest / none. */
export function effectiveRoutineId(appState: ScheduleState, iso: IsoDate): Id | null {
  return effectiveRoutineIds(appState, iso)[0] ?? null;
}

/** First planned routine object for `iso` (convenience for single-CTA flows). */
export function effectiveRoutine(appState: ScheduleState, iso: IsoDate): Routine | null {
  const id = effectiveRoutineId(appState, iso);
  return id ? (appState.routines.find((routine) => routine.id === id) ?? null) : null;
}
