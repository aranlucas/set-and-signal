import { describe, expect, it } from "vitest";
import {
  createStartingStrengthPlan,
  suggestedStartingWeights,
} from "@/domain/training/starting-strength";

describe("starting strength setup", () => {
  it("suggests conservative first-session loads in both supported units", () => {
    expect(suggestedStartingWeights("new", "lb")).toEqual({
      "0043": 45,
      "0025": 45,
      "0027": 65,
      "1456": 45,
      "0032": 95,
    });
    expect(suggestedStartingWeights("new", "kg")).toEqual({
      "0043": 20,
      "0025": 20,
      "0027": 30,
      "1456": 20,
      "0032": 40,
    });
  });

  it("puts confirmed starting weights on both alternating 5x5 routines", () => {
    const weights = suggestedStartingWeights("some", "lb");
    const { routines, week } = createStartingStrengthPlan(weights);

    expect(routines.map((routine) => routine.name)).toEqual(["5×5 Workout A", "5×5 Workout B"]);
    expect(
      routines.flatMap((routine) => routine.ex.map((exercise) => [exercise.id, exercise.weight])),
    ).toEqual([
      ["0043", 95],
      ["0025", 95],
      ["0027", 95],
      ["0043", 95],
      ["1456", 65],
      ["0032", 135],
    ]);
    expect(week).toEqual({ 1: routines[0].id, 3: routines[1].id, 5: routines[0].id });
  });
});
