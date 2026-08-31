import { describe, expect, it } from "vitest";
import { estimateRoutineMinutes, recoveryForRoutine } from "@/features/home/home-insights";
import type { Routine, Workout } from "@/shared/lib/types";

const routine: Routine = {
  id: "upper",
  name: "Upper body",
  emoji: "arm",
  ex: [
    { id: "0025", sets: 3, reps: 5 },
    { id: "0027", sets: 3, reps: 8 },
  ],
};

describe("home insights", () => {
  it("estimates a session from planned sets, rest, and exercise transitions", () => {
    expect(estimateRoutineMinutes(routine, 90)).toBe(15);
    expect(estimateRoutineMinutes(null, 90)).toBe(0);
  });

  it("recovers muscles as training gets older", () => {
    const workout: Workout = {
      id: "w1",
      d: "2026-08-24",
      start: 1,
      end: 2,
      routineId: "upper",
      name: "Upper body",
      entries: [
        {
          id: "0025",
          sets: [
            { w: 100, r: 5, done: true },
            { w: 100, r: 5, done: true },
            { w: 100, r: 5, done: true },
          ],
        },
      ],
      prs: [],
      vol: 1500,
    };

    const nextDay = recoveryForRoutine([workout], routine, "2026-08-25");
    const fiveDaysLater = recoveryForRoutine([workout], routine, "2026-08-29");
    expect(nextDay).toHaveLength(3);
    expect(nextDay[0]?.recovery).toBeLessThan(fiveDaysLater[0]?.recovery ?? 0);
  });
});
