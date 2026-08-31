import { describe, expect, it } from "vitest";
import { DEFAULT_APP_STATE } from "./default-state";
import { parseBackup } from "./backup";

describe("parseBackup", () => {
  it("restores a valid exported state", () => {
    const exportedState = structuredClone(DEFAULT_APP_STATE);
    exportedState.unit = "lb";
    exportedState.routines.push({
      id: "routine-1",
      name: "Strength",
      emoji: "dumbbell",
      ex: [],
    });

    const restoredState = parseBackup(JSON.stringify(exportedState));

    expect(restoredState.unit).toBe("lb");
    expect(restoredState.routines[0]?.name).toBe("Strength");
  });

  it("rejects malformed nested workout data", () => {
    const exportedState: Record<string, unknown> = {
      ...structuredClone(DEFAULT_APP_STATE),
      workouts: [
        {
          id: "workout-1",
          d: "2026-08-24",
          name: "Bad",
          start: 1,
          end: 2,
          vol: 0,
          entries: [{ id: "exercise-1", sets: [{ done: "yes", w: 20, r: 5 }] }],
        },
      ],
    };

    expect(() => parseBackup(JSON.stringify(exportedState))).toThrow(/Invalid server payload/u);
  });
});
