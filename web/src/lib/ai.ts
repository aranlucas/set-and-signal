// Digest builder for AI workout planning — turns live app state into the compact JSON the
// coach model sees. Exercise names resolve here (the API doesn't carry the library), and
// logged sets are flattened to short strings to keep the prompt small.
import { EXIDX } from "./exercises.js";
import { todayISO } from "./format.js";
import type { AppState, ExConfig, Id, LoggedSet, Routine } from "./types.js";

type DigestState = Pick<
  AppState,
  "unit" | "targetW" | "bodyweight" | "workouts" | "customEx" | "exWeights"
>;

type DigestCfg = Partial<
  Pick<ExConfig, "sets" | "reps" | "weight" | "sec" | "min" | "speed" | "bodyweight" | "side">
> & { id: Id; name: string; lastWeight?: number | null };

const nameOf = (state: DigestState, id: Id): string =>
  EXIDX[id]?.n || (state.customEx || []).find((exercise) => exercise.id === id)?.n || id;

export function buildDigest(state: DigestState, routine: Routine) {
  // unrolled from the original key loop so each field copy stays typed
  const configDigest = (exerciseConfig: ExConfig): DigestCfg => {
    const digestConfig: DigestCfg = {
      id: exerciseConfig.id,
      name: nameOf(state, exerciseConfig.id),
    };
    if (exerciseConfig.sets !== undefined) digestConfig.sets = exerciseConfig.sets;
    if (exerciseConfig.reps !== undefined) digestConfig.reps = exerciseConfig.reps;
    if (exerciseConfig.weight !== undefined) digestConfig.weight = exerciseConfig.weight;
    if (exerciseConfig.sec !== undefined) digestConfig.sec = exerciseConfig.sec;
    if (exerciseConfig.min !== undefined) digestConfig.min = exerciseConfig.min;
    if (exerciseConfig.speed !== undefined) digestConfig.speed = exerciseConfig.speed;
    if (exerciseConfig.bodyweight !== undefined)
      digestConfig.bodyweight = exerciseConfig.bodyweight;
    if (exerciseConfig.side !== undefined) digestConfig.side = exerciseConfig.side;
    digestConfig.lastWeight = state.exWeights?.[exerciseConfig.id]?.w ?? null;
    return digestConfig;
  };
  const setDigest = (loggedSet: LoggedSet): string | null => {
    if (!loggedSet.done) return null;
    if ("sec" in loggedSet)
      return (loggedSet.w ? loggedSet.w + state.unit + "×" : "") + loggedSet.sec + "s";
    if ("min" in loggedSet) return loggedSet.min + "min@" + (loggedSet.speed ?? "?");
    return [loggedSet.w ?? 0, loggedSet.r]
      .filter((value) => value !== null && value !== undefined)
      .join("×");
  };
  return {
    unit: state.unit,
    today: todayISO(),
    bodyweightGoal: state.targetW ?? null,
    bodyweight: (state.bodyweight || []).slice(-10).map((entry) => ({ d: entry.d, w: entry.w })),
    routine: { name: routine.name, entries: routine.ex.map(configDigest) },
    lastWorkouts: (state.workouts || []).slice(-8).map((workout) => ({
      d: workout.d,
      name: workout.name,
      bw: workout.bw ?? null,
      entries: (workout.entries || []).map((workoutEntry) => ({
        id: workoutEntry.id,
        name: nameOf(state, workoutEntry.id),
        target: workoutEntry.target || null,
        sets: (workoutEntry.sets || [])
          .map(setDigest)
          .filter((digest): digest is string => digest != null),
      })),
    })),
  };
}
