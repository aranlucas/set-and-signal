import { CURATED, curatedRoutines } from "@/features/plan/curated.js";
import { weekdayFromNumber } from "@/shared/lib/format.js";
import type { Id, Routine, Unit, Weekday } from "@/shared/lib/types.js";

export type StrengthExperience = "new" | "some" | "confident";

export const STARTING_STRENGTH_LIFTS = [
  { id: "0043", key: "squat" },
  { id: "0025", key: "bench" },
  { id: "0027", key: "row" },
  { id: "1456", key: "press" },
  { id: "0032", key: "deadlift" },
] as const;

export type StartingStrengthLiftId = (typeof STARTING_STRENGTH_LIFTS)[number]["id"];
export type StartingStrengthWeights = Record<StartingStrengthLiftId, number>;

const STARTING_STRENGTH_LIFT_IDS = new Set<string>(STARTING_STRENGTH_LIFTS.map((lift) => lift.id));

const isStartingStrengthLiftId = (exerciseId: string): exerciseId is StartingStrengthLiftId =>
  STARTING_STRENGTH_LIFT_IDS.has(exerciseId);

const SUGGESTED_STARTING_WEIGHTS: Record<
  Unit,
  Record<StrengthExperience, StartingStrengthWeights>
> = {
  lb: {
    new: { "0043": 45, "0025": 45, "0027": 65, "1456": 45, "0032": 95 },
    some: { "0043": 95, "0025": 95, "0027": 95, "1456": 65, "0032": 135 },
    confident: { "0043": 95, "0025": 95, "0027": 95, "1456": 65, "0032": 135 },
  },
  kg: {
    new: { "0043": 20, "0025": 20, "0027": 30, "1456": 20, "0032": 40 },
    some: { "0043": 40, "0025": 40, "0027": 40, "1456": 30, "0032": 60 },
    confident: { "0043": 40, "0025": 40, "0027": 40, "1456": 30, "0032": 60 },
  },
};

export function suggestedStartingWeights(
  experience: StrengthExperience,
  unit: Unit,
): StartingStrengthWeights {
  return { ...SUGGESTED_STARTING_WEIGHTS[unit][experience] };
}

export function createStartingStrengthPlan(weights: StartingStrengthWeights): {
  routines: Routine[];
  week: Partial<Record<Weekday, Id>>;
} {
  const plan = CURATED.find((candidate) => candidate.key === "linear-5x5");
  if (!plan) throw new Error("StrongLifts starter plan is missing");

  const routines = curatedRoutines(plan);
  for (const routine of routines) {
    for (const exercise of routine.ex) {
      exercise.weight = isStartingStrengthLiftId(exercise.id)
        ? weights[exercise.id]
        : (exercise.weight ?? 0);
    }
  }
  const week: Partial<Record<Weekday, Id>> = {};
  for (const [day, routineIndex] of Object.entries(plan.week)) {
    const weekday = weekdayFromNumber(Number(day));
    const routine = routines[routineIndex];
    if (weekday != null && routine) week[weekday] = routine.id;
  }

  return { routines, week };
}
