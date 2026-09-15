import { describe, expect, it } from "vitest";
import {
  effectiveRoutine,
  effectiveRoutineId,
  effectiveRoutineIds,
  effectiveSessions,
} from "@/domain/training/schedule.js";
import type { AppState, Routine } from "@/shared/lib/types.js";

const routines: Routine[] = [
  { id: "a", name: "Workout A", emoji: "dumbbell", ex: [] },
  { id: "b", name: "Workout B", emoji: "dumbbell", ex: [] },
  { id: "orphan", name: "Gone", emoji: "dumbbell", ex: [] },
];

function scheduleState(
  week: AppState["week"],
  dayPlan: AppState["dayPlan"] = {},
): Pick<AppState, "dayPlan" | "routines" | "week"> {
  return { routines, week, dayPlan };
}

describe("effectiveSessions", () => {
  it("returns ordered weekly sessions for a weekday", () => {
    const state = scheduleState({
      1: [{ routineId: "a" }, { routineId: "b" }],
    });
    expect(effectiveSessions(state, "2026-09-14")).toEqual([
      { routineId: "a" },
      { routineId: "b" },
    ]);
    expect(effectiveRoutineIds(state, "2026-09-14")).toEqual(["a", "b"]);
    expect(effectiveRoutineId(state, "2026-09-14")).toBe("a");
    expect(effectiveRoutine(state, "2026-09-14")?.name).toBe("Workout A");
  });

  it("drops sessions whose routines no longer exist", () => {
    const state = scheduleState({
      1: [{ routineId: "a" }, { routineId: "missing" }],
    });
    expect(effectiveSessions(state, "2026-09-14")).toEqual([{ routineId: "a" }]);
  });

  it("honors rest overrides with an empty session list", () => {
    const state = scheduleState({ 1: [{ routineId: "a" }] }, { "2026-09-14": { rest: true } });
    expect(effectiveSessions(state, "2026-09-14")).toEqual([]);
    expect(effectiveRoutineId(state, "2026-09-14")).toBeNull();
    expect(effectiveRoutine(state, "2026-09-14")).toBeNull();
  });

  it("replaces the weekly template when a day override is present", () => {
    const state = scheduleState(
      { 1: [{ routineId: "a" }] },
      { "2026-09-14": { sessions: [{ routineId: "b" }, { routineId: "a" }] } },
    );
    expect(effectiveSessions(state, "2026-09-14")).toEqual([
      { routineId: "b" },
      { routineId: "a" },
    ]);
  });

  it("treats missing or empty week slots as rest", () => {
    const state = scheduleState({});
    expect(effectiveSessions(state, "2026-09-15")).toEqual([]);
    expect(effectiveRoutineIds(state, "2026-09-15")).toEqual([]);
  });
});
