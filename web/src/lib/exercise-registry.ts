import type { CustomEx, Exercise } from "./types.js";

export const EXIDX: Record<string, Exercise | CustomEx> = {};

let catalogIndex: Record<string, Exercise> = {};
let customIndex: Record<string, CustomEx> = {};

export function registerExerciseCatalog(exercises: readonly Exercise[]) {
  for (const id of Object.keys(catalogIndex)) {
    if (!customIndex[id]) delete EXIDX[id];
  }
  catalogIndex = Object.fromEntries(exercises.map((exercise) => [exercise.id, exercise]));
  for (const exercise of exercises) {
    if (!customIndex[exercise.id]) EXIDX[exercise.id] = exercise;
  }
}

export function registerCustom(exercises?: readonly CustomEx[] | null) {
  for (const id of Object.keys(customIndex)) {
    const catalogExercise = catalogIndex[id];
    if (catalogExercise) EXIDX[id] = catalogExercise;
    else delete EXIDX[id];
  }
  customIndex = Object.fromEntries((exercises || []).map((exercise) => [exercise.id, exercise]));
  for (const exercise of exercises || []) EXIDX[exercise.id] = exercise;
}

export const registeredCustomExercise = (id: string) => customIndex[id];
