import { todayISO, uid } from "@/shared/lib/format";
import { buildSets, bestWeightFor, workoutVolume, isWarmup } from "@/domain/training/history";
import { beep } from "@/shared/lib/sound";
import { useWorkoutTimer } from "@/features/workout/useWorkoutTimer";
import { is1RMRecord } from "@/domain/training/onerm";
import {
  nextPrescription,
  applyPrescription,
  syncSourceRoutineWeights,
} from "@/domain/training/progression";
import { EXIDX } from "@/domain/exercises/exercises";
import { exerciseMuscleSnapshot } from "@/domain/exercises/muscles";
import type { ActiveEntry, Id, Workout } from "@/shared/lib/types";
import {
  getAppState,
  getSetWeight,
  getSoundSettings,
  updateAppState,
} from "@/features/exercises/sheet-shared";

export function beginWorkout(
  routineId: Id | null,
  bodyweight: number | null,
  freestyleName: string,
): void {
  const state = getAppState();
  const routine = routineId ? state.routines.find((candidate) => candidate.id === routineId) : null;
  const entries: ActiveEntry[] = (routine ? routine.ex : []).map((config) => {
    const prescription = nextPrescription(state, config, routine);
    return {
      id: config.id,
      sg: config.sg,
      target: { ...config },
      plan: prescription,
      sets: applyPrescription(buildSets(state, config), prescription),
    };
  });
  updateAppState((draft) => {
    draft.active = {
      id: uid(),
      d: todayISO(),
      start: Date.now(),
      routineId,
      name: routine ? routine.name : freestyleName,
      bw: bodyweight || null,
      cur: 0,
      entries,
    };
  });
  useWorkoutTimer.getState().stopRest();
}

export interface FinishSummaryPayload {
  workout: Workout;
  prs: Id[];
  e1prs: Array<{
    id: Id;
    est: number;
    w: number;
    r: number;
    prev?: number;
  }>;
}

export function completeWorkout(): FinishSummaryPayload | null {
  const state = getAppState();
  const activeWorkout = state.active;
  if (!activeWorkout) return null;
  const personalRecords: Id[] = [];
  const personalRecordSet = new Set<Id>();
  const estimatedRecords: Array<{
    id: Id;
    est: number;
    w: number;
    r: number;
    prev?: number;
  }> = [];
  activeWorkout.entries.forEach((entry) => {
    // Warm-up ramp sets never set records or become next session's default weight.
    const maxSetWeight = entry.sets.reduce(
      (max, set) => (set.done && !isWarmup(set) ? Math.max(max, getSetWeight(set)) : max),
      0,
    );
    if (maxSetWeight > 0 && maxSetWeight > bestWeightFor(state, entry.id)) {
      personalRecords.push(entry.id);
      personalRecordSet.add(entry.id);
    }
    const estimatedRecord = is1RMRecord(state, entry.id, entry);
    if (estimatedRecord && !personalRecordSet.has(entry.id)) {
      estimatedRecords.push({ id: entry.id, ...estimatedRecord });
    }
  });
  const workout: Workout = {
    id: activeWorkout.id,
    d: activeWorkout.d,
    start: activeWorkout.start,
    end: Date.now(),
    routineId: activeWorkout.routineId,
    name: activeWorkout.name,
    bw: activeWorkout.bw,
    entries: activeWorkout.entries.flatMap((entry) =>
      entry.sets.some((set) => set.done)
        ? (() => {
            const exercise = EXIDX[entry.id];
            const snapshot =
              exercise && "custom" in exercise && exercise.custom
                ? exerciseMuscleSnapshot(exercise)
                : null;
            return [
              {
                id: entry.id,
                sets: entry.sets,
                topW: entry.topW || null,
                target: entry.target || null,
                ...(snapshot && Object.keys(snapshot).length > 0
                  ? { muscleSnapshot: snapshot }
                  : {}),
              },
            ];
          })()
        : [],
    ),
    prs: personalRecords,
    vol: 0,
  };
  workout.vol = workoutVolume(workout);
  updateAppState((draft) => {
    workout.entries.forEach((entry) => {
      const maxWeight = entry.sets.reduce(
        (max, set) => (set.done && !isWarmup(set) ? Math.max(max, getSetWeight(set)) : max),
        Math.max(0, entry.topW || 0),
      );
      if (maxWeight > 0) {
        const currentWeight = draft.exWeights[entry.id];
        if (!currentWeight || maxWeight > currentWeight.w) {
          draft.exWeights[entry.id] = { w: maxWeight, d: workout.d };
        }
      }
    });
    draft.workouts.push(workout);
    if (workout.routineId) {
      const routineIndex = draft.routines.findIndex(
        (candidate) => candidate.id === workout.routineId,
      );
      if (routineIndex >= 0) {
        draft.routines[routineIndex] = syncSourceRoutineWeights(
          draft,
          draft.routines[routineIndex],
          workout.entries.map((entry) => entry.id),
        );
      }
    }
    draft.active = null;
  });
  useWorkoutTimer.getState().stopRest();
  beep(getSoundSettings(), 880, 0.15);
  beep(getSoundSettings(), 1100, 0.15, 0.18);
  beep(getSoundSettings(), 1320, 0.3, 0.36);
  return {
    workout,
    prs: personalRecords,
    e1prs: estimatedRecords,
  };
}
