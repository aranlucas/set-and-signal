import { cleanupSg } from "@/domain/training/history";
import { exerciseMuscleSnapshot } from "@/domain/exercises/muscles";
import { translate } from "@/i18n/translate";
import { toast } from "@/shared/lib/toast";
import type { AppState, CustomEx } from "@/shared/lib/types";
import { getAppState, updateAppState, type SheetEx } from "@/features/exercises/sheet-shared";

function removeCustomExerciseFromState(exercise: CustomEx | SheetEx): void {
  updateAppState((state) => {
    state.customEx = state.customEx.filter((candidate) => candidate.id !== exercise.id);

    for (const routine of state.routines) {
      routine.ex = routine.ex.filter((routineExercise) => routineExercise.id !== exercise.id);
      cleanupSg(routine.ex);
    }

    for (const workout of state.workouts) {
      for (const entry of workout.entries) {
        if (entry.id !== exercise.id) {
          continue;
        }

        // Preserve the exercise metadata used by history and recovery maps.
        if (!entry.muscleSnapshot || Object.keys(entry.muscleSnapshot).length === 0) {
          entry.muscleSnapshot = exerciseMuscleSnapshot(exercise);
        }
      }
    }

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

export function exerciseUsage(appState: AppState) {
  const usageByExercise: Record<string, number> = {};

  for (const routine of appState.routines) {
    for (const exercise of routine.ex) {
      usageByExercise[exercise.id] = (usageByExercise[exercise.id] || 0) + 1;
    }
  }

  for (const workout of appState.workouts) {
    for (const entry of workout.entries) {
      usageByExercise[entry.id] = (usageByExercise[entry.id] || 0) + 1;
    }
  }

  return usageByExercise;
}
