import type { CustomEx, ExConfig, Routine } from "../lib/types";
import type { SheetEx } from "./shared";

/**
 * The workout view owns its overlays. Keeping the possible contents explicit
 * means each sheet receives the props it needs without a heterogeneous
 * component registry or a cast at the render boundary.
 */
export type WorkoutSheetState =
  | { type: "top-weight"; entryIdx: number }
  | { type: "workout-complete" }
  | { type: "detail"; exercise: SheetEx }
  | { type: "picker"; onPick: (exercise: SheetEx) => void }
  | { type: "add-to-routine"; exercise: SheetEx }
  | {
      type: "config";
      exercise: SheetEx;
      existing: ExConfig | null;
      onSave: (config: ExConfig) => void;
      onDelete?: (() => void) | null;
      routine: Routine | null;
    }
  | {
      type: "custom";
      existingExercise: CustomEx | null;
      onDone?: (exercise: SheetEx | null) => void;
      prefillName?: string;
      onDelete?: () => void;
    };

export type SetWorkoutSheet = (sheet: WorkoutSheetState) => void;
