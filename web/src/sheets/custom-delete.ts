import { cleanupSg } from "../lib/history";
import { exerciseMuscleSnapshot } from "../lib/muscles";
import { translate } from "../lib/translate";
import { toast } from "../lib/toast";
import type { AppState, CustomEx } from "../lib/types";
import { getAppState, updateAppState, type SheetEx } from "./shared";

function removeCustomExerciseFromState(exercise: CustomEx | SheetEx): void {
  updateAppState((state) => {
    state.customEx = state.customEx.filter((candidate) => candidate.id !== exercise.id);
    state.routines.forEach((routine) => {
      routine.ex = routine.ex.filter((routineExercise) => routineExercise.id !== exercise.id);
      cleanupSg(routine.ex);
    });
    state.workouts.forEach((workout) =>
      workout.entries.forEach((entry) => {
        if (entry.id !== exercise.id) return;
        // Keep both the old flat name and the canonical weighted snapshot: the former serves
        // pre-snapshot readers, while the latter keeps recovery maps correct after deletion.
        entry.n = exercise.n;
        if (!entry.muscleSnapshot || Object.keys(entry.muscleSnapshot).length === 0)
          entry.muscleSnapshot = exerciseMuscleSnapshot(exercise);
      }),
    );
    delete state.exWeights[exercise.id];
  });
}

export function removeCustomExercise(exercise: CustomEx, afterDelete?: () => void): void {
  if (getAppState().active?.entries.some((entry) => entry.id === exercise.id)) {
    toast(
      translate("customExercise.finishCurrentWorkoutFirst", "Finish your current workout first"),
    );
    return;
  }
  removeCustomExerciseFromState(exercise);
  toast(translate("customExercise.exerciseDeleted", "Exercise deleted"));
  afterDelete?.();
}

export function exerciseUsage(appState: AppState): Record<string, number> {
  const usageByExercise: Record<string, number> = {};
  appState.routines.forEach((routine) =>
    routine.ex.forEach((exercise) => {
      usageByExercise[exercise.id] = (usageByExercise[exercise.id] || 0) + 1;
    }),
  );
  appState.workouts.forEach((workout) =>
    workout.entries.forEach((entry) => {
      usageByExercise[entry.id] = (usageByExercise[entry.id] || 0) + 1;
    }),
  );
  return usageByExercise;
}
