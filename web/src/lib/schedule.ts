import { weekdayOf } from "./format.js";
import type { AppState, Id, IsoDate } from "./types.js";

export function effectiveRoutineId(
  appState: Pick<AppState, "dayPlan" | "routines" | "week">,
  iso: IsoDate,
): Id | null {
  const override = appState.dayPlan[iso];
  if (override === "rest") return null;
  if (override && appState.routines.some((routine) => routine.id === override)) return override;
  const weekday = weekdayOf(new Date(`${iso}T12:00:00`));
  return appState.week[weekday] || null;
}

export function effectiveRoutine(
  appState: Pick<AppState, "dayPlan" | "routines" | "week">,
  iso: IsoDate,
) {
  const id = effectiveRoutineId(appState, iso);
  return id ? appState.routines.find((routine) => routine.id === id) || null : null;
}
