import { describe, expect, it } from "vitest";
import { exerciseSearchScore } from "./exercise-search";

const row = {
  n: "barbell bent over row",
  tg: "upper back",
  eq: "barbell",
  desc: "Pull the bar toward your torso.",
};

describe("exerciseSearchScore", () => {
  it("matches natural non-contiguous name queries", () => {
    expect(exerciseSearchScore(row, "barbell row")).toBe(2);
  });

  it("matches tokens across searchable fields", () => {
    expect(exerciseSearchScore(row, "upper barbell")).toBe(3);
  });

  it("ranks exact and phrase matches ahead of token matches", () => {
    expect(exerciseSearchScore(row, row.n)).toBe(0);
    expect(exerciseSearchScore(row, "bent over")).toBe(1);
    expect(exerciseSearchScore(row, "barbell row")).toBe(2);
  });

  it("rejects a query when any token is absent", () => {
    expect(exerciseSearchScore(row, "barbell squat")).toBeNull();
  });
});
