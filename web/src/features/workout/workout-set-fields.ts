import type { LoggedSet } from "@/shared/lib/types";

export type SetField = "w" | "r" | "sec" | "min" | "speed" | "rir" | "rpe";

// LoggedSet deliberately has no persisted discriminant. Read and write fields through the
// field names that identify each shape instead of casting a set to an arbitrary record.
export const fieldOf = (set: LoggedSet, field: SetField): number | undefined => {
  switch (field) {
    case "w":
      return "w" in set ? set.w : undefined;
    case "r":
      return "r" in set ? set.r : undefined;
    case "sec":
      return "sec" in set ? set.sec : undefined;
    case "min":
      return "min" in set ? set.min : undefined;
    case "speed":
      return "speed" in set ? set.speed : undefined;
    case "rir":
      return "r" in set || "sec" in set ? set.rir : undefined;
    case "rpe":
      return "r" in set || "sec" in set ? set.rpe : undefined;
  }
};

export const setFieldValue = (set: LoggedSet, field: SetField, value: number | null) => {
  switch (field) {
    case "w":
      if ("w" in set) set.w = value ?? 0;
      return;
    case "r":
      if ("r" in set) set.r = value ?? 0;
      return;
    case "sec":
      if ("sec" in set) set.sec = value ?? 0;
      return;
    case "min":
      if ("min" in set) set.min = value ?? 0;
      return;
    case "speed":
      if ("speed" in set) set.speed = value ?? 0;
      return;
    case "rir":
      if ("r" in set || "sec" in set) {
        if (value == null) delete set.rir;
        else set.rir = value;
      }
      return;
    case "rpe":
      if ("r" in set || "sec" in set) {
        if (value == null) delete set.rpe;
        else set.rpe = value;
      }
  }
};

export const weightOf = (set?: LoggedSet) => (set && "w" in set ? set.w : undefined);
export const repsOf = (set: LoggedSet) => ("r" in set ? set.r : undefined);
export const hasWeight = (set: LoggedSet) => {
  const weight = weightOf(set);
  return weight !== undefined && weight > 0;
};
