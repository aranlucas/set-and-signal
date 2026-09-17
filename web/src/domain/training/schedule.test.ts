import { describe, expect, it } from "vitest";
import {
  nextPlannedRoutine,
  sessionProgress,
  effectiveRoutine,
  effectiveRoutineId,
  effectiveRoutineIds,
  effectiveSessions,
} from "@/domain/training/schedule.js";
import type { AppState, Routine, Workout } from "@/shared/lib/types.js";

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

function logged(routineId: string, d = "2026-09-14"): Workout {
  return {
    id: `${routineId}-${d}`,
    d,
    routineId,
    name: routineId,
    start: 1,
    end: 2,
    entries: [],
    prs: [],
    vol: 0,
  };
}

describe("session progress", () => {
  it("advances to the second routine after finishing the first and counts duplicates separately", () => {
    const state = {
      ...scheduleState({ 1: [{ routineId: "a" }, { routineId: "b" }, { routineId: "b" }] }),
      workouts: [logged("a"), logged("b", "2026-09-13")],
    };
    expect(nextPlannedRoutine(state, "2026-09-14")?.id).toBe("b");
    state.workouts.push(logged("b"));
    expect(sessionProgress(state, "2026-09-14").map((session) => session.completed)).toEqual([
      true,
      true,
      false,
    ]);
    expect(nextPlannedRoutine(state, "2026-09-14")?.id).toBe("b");
    state.workouts.push(logged("b"));
    expect(nextPlannedRoutine(state, "2026-09-14")).toBeNull();
  });

  it("falls back for deleted override routines but preserves an explicitly empty day", () => {
    const state = scheduleState(
      { 1: [{ routineId: "a" }] },
      { "2026-09-14": { sessions: [{ routineId: "deleted" }] } },
    );
    expect(effectiveRoutineIds(state, "2026-09-14")).toEqual(["a"]);
    state.dayPlan["2026-09-14"] = { sessions: [] };
    expect(effectiveRoutineIds(state, "2026-09-14")).toEqual([]);
  });
});
