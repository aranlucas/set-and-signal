import { describe, expect, it } from "vitest";
import { EXDB, normalizeSearchText, searchExercises } from "@/domain/exercises/exercises";

describe("exercise search", () => {
  it("matches query tokens across separate metadata fields", () => {
    const results = searchExercises(EXDB, "chest body weight");

    expect(results.some((exercise) => exercise.n === "push-up")).toBe(true);
    expect(results.some((exercise) => exercise.n === "barbell bench press")).toBe(false);
  });

  it("normalizes accents, punctuation, and ampersands without discarding non-Latin text", () => {
    const exercises = [
      { n: "Développé & fly", bp: "Poitrine" },
      { n: "深蹲", bp: "腿" },
    ];

    expect(normalizeSearchText("  DÉVELOPPÉ & FLY ")).toBe("developpe and fly");
    expect(searchExercises(exercises, "developpe and fly")).toEqual([exercises[0]]);
    expect(searchExercises(exercises, "深蹲 腿")).toEqual([exercises[1]]);
  });

  it("combines text search with structured catalog filters", () => {
    const results = searchExercises(EXDB, "press pectorals", {
      bodyPart: "chest",
      equipment: "dumbbell",
    });

    expect(results.some((exercise) => exercise.n === "dumbbell bench press")).toBe(true);
    expect(results.every((exercise) => exercise.bp === "chest" && exercise.eq === "dumbbell")).toBe(
      true,
    );
  });

  it("matches natural non-contiguous name queries and ranks names before metadata", () => {
    const exercises = [
      { n: "row machine", bp: "upper back", eq: "barbell", tg: "upper back" },
      { n: "barbell bent over row", bp: "upper back", eq: "barbell", tg: "upper back" },
      { n: "barbell row", bp: "upper back", eq: "barbell", tg: "upper back" },
    ];

    expect(searchExercises(exercises, "barbell row")).toEqual([
      exercises[2],
      exercises[1],
      exercises[0],
    ]);
  });
});

describe("exercise catalog", () => {
  it("has unique IDs and complete metadata for every exercise", () => {
    expect(new Set(EXDB.map((exercise) => exercise.id)).size).toBe(EXDB.length);

    for (const exercise of EXDB) {
      expect(exercise.n).not.toBe("");
      expect(exercise.bp).not.toBe("");
      expect(exercise.eq).not.toBe("");
      expect(exercise.tg).not.toBe("");
      expect(exercise.st).toBeUndefined();
      expect(exercise.img).toMatch(/\.jpg$/u);
      expect(exercise.gif).toMatch(/\.gif$/u);
    }
  });
});
