import { describe, expect, it } from "vitest";
import { exerciseMuscleSnapshot, loadOfWorkouts, musclesOf } from "@/domain/exercises/muscles";

describe("workout muscle load", () => {
  it("ignores completed warm-up sets", () => {
    const load = loadOfWorkouts([
      {
        entries: [
          {
            id: "deleted-custom",
            muscleSnapshot: { muscleWeights: { chest: 1 } },
            sets: [
              { done: true, w: 20, r: 8, wu: true },
              { done: true, w: 60, r: 8 },
            ],
          },
        ],
      },
    ]);

    expect(load).toEqual({ chest: 1 });
  });

  it("creates a durable snapshot for a custom body-part exercise", () => {
    const snapshot = exerciseMuscleSnapshot({
      n: "Paused squat",
      bp: "upper legs",
      tg: "",
      sm: [],
    });

    expect(snapshot).toEqual({
      n: "Paused squat",
      bp: "upper legs",
      muscleWeights: { quadriceps: 0.4, hamstring: 0.35, gluteal: 0.25 },
    });
    expect(musclesOf(snapshot)).toEqual(snapshot.muscleWeights);
  });

  it("uses snapshot weights when the exercise is no longer in the catalogue", () => {
    expect(
      loadOfWorkouts([
        {
          entries: [
            {
              id: "deleted-custom",
              sets: [{ done: true, w: 0, r: 10 }],
              muscleSnapshot: {
                n: "Deleted custom",
                bp: "chest",
                muscleWeights: { chest: 1 },
              },
            },
          ],
        },
      ]),
    ).toEqual({ chest: 1 });
  });
});
