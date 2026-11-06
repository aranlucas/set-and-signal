import type { CatalogExercise, CustomEx, Exercise } from "@/shared/lib/types";

export type SheetEx = (Exercise | CustomEx) & {
  custom?: boolean;
  desc?: string;
};

export const toCatalogExercise = (exercise: SheetEx): CatalogExercise => {
  if ("img" in exercise) {
    return exercise;
  }

  return {
    ...exercise,
    tg: exercise.tg || "",
    eq: exercise.eq || "",
    img: "",
    gif: "",
    mg: "",
    sm: [],
  };
};
