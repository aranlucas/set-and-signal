import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { buildDigest } from "@/features/assistant/ai.js";
import type { Routine } from "@/shared/lib/types.js";

// The digest must follow the user's calendar day, not the UTC day used by an ISO timestamp.
const routine: Routine = {
  id: "routine-1",
  name: "Strength",
  emoji: "barbell",
  ex: [{ id: "0605", sets: 3, reps: 8 }],
};

const state = {
  unit: "lb" as const,
  targetW: null,
  bodyweight: [],
  customEx: [],
  exWeights: {},
  workouts: [
    {
      id: "workout-1",
      d: "2026-08-22",
      start: 0,
      end: 0,
      routineId: routine.id,
      name: routine.name,
      prs: [],
      vol: 0,
      entries: [
        {
          id: "0605",
          topW: null,
          sets: [
            { sec: 60, w: 25, done: true },
            { sec: 30, w: 0, done: true },
          ],
        },
      ],
    },
  ],
};

beforeEach(() => vi.stubEnv("TZ", "America/Los_Angeles"));
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
});
describe("buildDigest", () => {
  it("uses the local calendar day rather than UTC for today", () => {
    const now = new Date("2026-08-24T06:30:00Z"); // 23:30 on August 23 in Los Angeles
    vi.setSystemTime(now);

    expect(buildDigest(state, routine).today).toBe("2026-08-23");
  });

  it("labels weighted timed sets with the profile unit", () => {
    const digest = buildDigest(state, routine);

    expect(digest.unit).toBe("lb");
    expect(digest.lastWorkouts[0].entries[0].sets).toEqual(["25lb×60s", "30s"]);
  });
});
