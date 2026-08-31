import { exerciseMetadata } from "./exercise-metadata";
import { loadOfRoutine, loadOfWorkouts, MUSCLES, rankOf } from "./muscles";
import type { MuscleSlug } from "./muscles";
import { e1rmSeries } from "./onerm";
import type { AppState, Routine, Workout } from "./types";

export interface RecoveryInsight {
  muscle: MuscleSlug;
  recovery: number;
}

export interface ProgressInsight {
  exerciseId: string;
  exerciseName: string;
  estimate: number;
  previousEstimate: number | null;
  delta: number | null;
  date: string;
}

const MS_PER_DAY = 86_400_000;

const utcDay = (iso: string): number => {
  const [year, month, day] = iso.split("-").map(Number);
  return Date.UTC(year || 1970, (month || 1) - 1, day || 1);
};

/** A practical session estimate, based on the user's configured rest time and planned work. */
export function estimateRoutineMinutes(routine: Routine | null, restSeconds: number): number {
  if (!routine?.ex.length) return 0;
  const transitionSeconds = Math.max(0, routine.ex.length - 1) * 75;
  const setupSeconds = routine.ex.length * 60;
  const workSeconds = routine.ex.reduce((total, exercise) => {
    if (exercise.mode === "cardio" || "min" in exercise)
      return total + Math.max(1, exercise.sets || 1) * Math.max(1, exercise.min || 20) * 60;
    const secondsPerSet = exercise.mode === "time" ? Math.max(15, exercise.sec || 45) : 45;
    const sets = Math.max(1, exercise.sets || 1);
    return total + sets * secondsPerSet + Math.max(0, sets - 1) * Math.max(0, restSeconds);
  }, 0);
  return Math.max(5, Math.round((workSeconds + transitionSeconds + setupSeconds) / 300) * 5);
}

/**
 * A transparent recovery estimate for the muscles today's routine uses most.
 * Effective sets fade linearly over six days; this is deliberately described as
 * an estimate in the UI rather than a physiological measurement.
 */
export function recoveryForRoutine(
  workouts: Workout[],
  routine: Routine | null,
  todayIso: string,
): RecoveryInsight[] {
  const routineLoad = loadOfRoutine(routine);
  const rankedTargets = rankOf(routineLoad).worked;
  const fallbackTargets = rankOf(loadOfWorkouts(workouts.slice(-12))).worked;
  const targets = [...rankedTargets, ...fallbackTargets, ...MUSCLES]
    .filter((muscle, index, all) => all.indexOf(muscle) === index)
    .slice(0, 3);

  return targets.map((muscle) => {
    let fatigue = 0;
    workouts.forEach((workout) => {
      const age = Math.max(0, Math.floor((utcDay(todayIso) - utcDay(workout.d)) / MS_PER_DAY));
      if (age >= 6) return;
      const effectiveSets = loadOfWorkouts([workout])[muscle] || 0;
      fatigue += effectiveSets * 9 * ((6 - age) / 6);
    });
    return { muscle, recovery: Math.max(5, Math.round(100 - Math.min(95, fatigue))) };
  });
}

/** The latest lift with enough history to make progress visible on the home screen. */
export function latestProgress(state: Pick<AppState, "workouts">): ProgressInsight | null {
  const latestRecordWorkout = state.workouts.toReversed().find((workout) => workout.prs.length > 0);
  const recentExerciseIds = [
    ...(latestRecordWorkout?.prs || []),
    ...state.workouts.toReversed().flatMap((workout) => workout.entries.map((entry) => entry.id)),
  ].filter((exerciseId, index, all) => all.indexOf(exerciseId) === index);

  for (const exerciseId of recentExerciseIds) {
    const series = e1rmSeries(state, exerciseId);
    if (!series.length) continue;
    const latest = series.at(-1);
    if (!latest) continue;
    const previous = series.length > 1 ? series.at(-2) : null;
    const delta = previous ? Math.round((latest.y - previous.y) * 10) / 10 : null;
    const historicalEntry = state.workouts
      .toReversed()
      .flatMap((workout) => workout.entries)
      .find((entry) => entry.id === exerciseId);
    return {
      exerciseId,
      exerciseName:
        exerciseMetadata(exerciseId)?.n ||
        historicalEntry?.muscleSnapshot?.n ||
        historicalEntry?.n ||
        exerciseId,
      estimate: latest.y,
      previousEstimate: previous?.y ?? null,
      delta,
      date: latest.d,
    };
  }
  return null;
}
