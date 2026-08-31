import { useStore } from "../store/useStore";
import type { AppState, CatalogExercise, CustomEx, Exercise, LoggedSet } from "../lib/types";

export const getAppState = () => useStore.getState().appState;
export const updateAppState = (mutate: (appState: AppState) => void) =>
  useStore.getState().update(mutate);
export const getSoundSettings = () => getAppState().sound;

export const getErrorMessage = (error: unknown): string =>
  error instanceof Error ? error.message : String(error);

export type SheetEx = (Exercise | CustomEx) & {
  custom?: boolean;
  desc?: string;
};

export const toCatalogExercise = (exercise: SheetEx): CatalogExercise => {
  if ("img" in exercise) return exercise;
  return {
    ...exercise,
    tg: exercise.tg || "",
    eq: exercise.eq || "",
    img: "",
    gif: "",
    mg: "",
    sm: [],
    st: [],
  };
};

/** Only reps-mode and time-mode sets carry a load; cardio sets contribute 0. */
export const getSetWeight = (set: LoggedSet): number => ("w" in set ? set.w : 0);
