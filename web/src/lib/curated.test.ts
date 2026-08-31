import { describe, expect, it } from "vitest";
import { CURATED, curatedRoutines } from "./curated";
import { EXIDX } from "./exercises";

describe("curated plans", () => {
  it("builds the linear 5x5 A/B plan with valid exercises and linear progression", () => {
    const plan = CURATED.find((candidate) => candidate.key === "linear-5x5");
    expect(plan).toBeDefined();
    expect(plan!.name).toBe("StrongLifts");

    const routines = curatedRoutines(plan!);
    expect(routines.map((routine) => routine.name)).toEqual(["5×5 Workout A", "5×5 Workout B"]);
    expect(routines.map((routine) => routine.prog)).toEqual(["linear", "linear"]);
    expect(routines[0].ex.map(({ id, sets, reps }) => [EXIDX[id]?.n, sets, reps])).toEqual([
      ["barbell full squat", 5, 5],
      ["barbell bench press", 5, 5],
      ["barbell bent over row", 5, 5],
    ]);
    expect(routines[1].ex.map(({ id, sets, reps }) => [EXIDX[id]?.n, sets, reps])).toEqual([
      ["barbell full squat", 5, 5],
      ["barbell standing close grip military press", 5, 5],
      ["barbell deadlift", 1, 5],
    ]);
    expect(plan!.week).toEqual({ 1: 0, 3: 1, 5: 0 });
  });
});
