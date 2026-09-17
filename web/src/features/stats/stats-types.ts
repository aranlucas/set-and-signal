import type { TFunction } from "i18next";
import { fmtDate } from "@/shared/lib/format";
import type { IsoDate, LoggedSet, Workout } from "@/shared/lib/types";

export type StatsSheet =
  | { kind: "bodyweight" }
  | { kind: "goal" }
  | { kind: "calendar"; start?: IsoDate }
  | { kind: "calendar-day"; iso: IsoDate; workouts: Workout[] }
  | { kind: "workout"; workout: Workout }
  | { kind: "day-override"; iso: IsoDate };

type Translate = TFunction;

export const sheetTitle = (active: StatsSheet, t: Translate): string => {
  switch (active.kind) {
    case "bodyweight":
      return t("weight.logBodyWeight", "Log body weight");
    case "goal":
      return t("weight.targetWeight", "Target weight");
    case "calendar":
      return t("calendar.workoutCalendar", "Workout calendar");
    case "calendar-day":
      return fmtDate(t, active.iso, true);
    case "workout":
      return active.workout.name;
    case "day-override":
      return fmtDate(t, active.iso, true);
  }
};

export const weightDeltaColor = (
  delta: number | null | undefined,
  currentW: number,
  targetW: number | null,
) => {
  if (!delta) return "var(--muted-foreground)";
  if (!targetW) return "var(--foreground)";
  const up = targetW > currentW;
  return delta > 0 === up ? "var(--primary)" : "var(--destructive)";
};

// Cardio sets carry neither rating field; the raters only ever read these two keys.
export const ratingOf = (set: LoggedSet): { rir?: number | null; rpe?: number | null } =>
  "rir" in set || "rpe" in set ? set : {};
// Cardio sets carry speed, timed sets sec, reps sets weight. Read the shape so
// mixed-mode history scores an absent field as zero instead of combining units.
export const loggedMetric = (set: LoggedSet): number =>
  "speed" in set ? set.speed || 0 : "sec" in set ? set.sec || 0 : set.w || 0;
