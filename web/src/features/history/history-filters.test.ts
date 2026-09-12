import { describe, expect, it } from "vitest";
import type { Workout } from "@/shared/lib/types";
import {
  filterHistoryWorkouts,
  groupHistoryWorkoutsByMonth,
  historyRangeStart,
  summarizeHistoryWorkouts,
} from "./history-filters";

const workout = (overrides: Partial<Workout>): Workout => ({
  id: "workout",
  d: "2026-09-12",
  start: 1_000,
  end: 61_000,
  routineId: "routine-a",
  name: "Session",
  entries: [],
  prs: [],
  vol: 100,
  ...overrides,
});

describe("historyRangeStart", () => {
  it("uses an inclusive 30-day window", () => {
    expect(historyRangeStart("2026-09-12", "30")).toBe("2026-08-14");
    expect(historyRangeStart("2026-09-12", "90")).toBe("2026-06-15");
    expect(historyRangeStart("2026-09-12", "all")).toBeNull();
  });

  it("handles month and year boundaries using calendar dates", () => {
    expect(historyRangeStart("2026-01-01", "30")).toBe("2025-12-03");
    expect(historyRangeStart("2024-03-01", "30")).toBe("2024-02-01");
  });
});

describe("filterHistoryWorkouts", () => {
  it("keeps both date boundaries and excludes the day outside them", () => {
    const workouts = [
      workout({ id: "start", d: "2026-08-14" }),
      workout({ id: "today", d: "2026-09-12" }),
      workout({ id: "old", d: "2026-08-13" }),
    ];

    expect(
      filterHistoryWorkouts(
        workouts,
        { query: "", routineId: "all", range: "30" },
        "2026-09-12",
      ).map((item) => item.id),
    ).toEqual(["today", "start"]);
  });

  it("matches session names, exercise names, notes, and routines", () => {
    const workouts = [
      workout({
        id: "match",
        name: "Upper strength",
        routineId: "routine-b",
        note: "Felt crisp",
        entries: [{ id: "bench", n: "Bench press", sets: [] }],
      }),
      workout({ id: "other", name: "Leg day", routineId: "routine-a" }),
    ];

    expect(
      filterHistoryWorkouts(
        workouts,
        { query: "CRISP", routineId: "routine-b", range: "all" },
        "2026-09-12",
      ).map((item) => item.id),
    ).toEqual(["match"]);
    expect(
      filterHistoryWorkouts(
        workouts,
        { query: "bench press", routineId: "all", range: "all" },
        "2026-09-12",
      ).map((item) => item.id),
    ).toEqual(["match"]);
  });
});

describe("history summaries and month groups", () => {
  it("summarizes matching sessions without mutating them", () => {
    const workouts = [
      workout({ id: "one", vol: 500, start: 1_000, end: 121_000 }),
      workout({ id: "two", vol: 250, start: 10_000, end: 70_000 }),
    ];
    expect(summarizeHistoryWorkouts(workouts)).toEqual({
      sessions: 2,
      volume: 750,
      durationMs: 180_000,
    });
  });

  it("groups already sorted workouts by descending month", () => {
    const workouts = [
      workout({ id: "sep", d: "2026-09-01" }),
      workout({ id: "aug", d: "2026-08-31" }),
      workout({ id: "aug-2", d: "2026-08-01" }),
    ];
    expect(groupHistoryWorkoutsByMonth(workouts)).toEqual([
      { month: "2026-09", workouts: [workouts[0]] },
      { month: "2026-08", workouts: [workouts[1], workouts[2]] },
    ]);
  });
});
