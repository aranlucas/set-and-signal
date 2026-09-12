import { describe, expect, it } from "vitest";
import { volumeTrend, weeklySummary } from "./training-summary";
import type { Workout } from "@/shared/lib/types";

const session = (d: string, vol: number, prs: string[] = []): Workout => ({
  id: d,
  d,
  vol,
  prs,
  name: "Session",
  start: 0,
  end: 0,
  routineId: null,
  entries: [],
});

describe("dashboard training summaries", () => {
  it("groups sessions by calendar week across the year boundary and excludes future logs", () => {
    const workouts = [
      session("2025-12-28", 100),
      session("2025-12-29", 200, ["bench"]),
      session("2026-01-02", 300),
      session("2026-01-03", 500),
    ];
    expect(weeklySummary(workouts, "2026-01-02")).toEqual({
      sessions: 2,
      volume: 500,
      records: 1,
      change: 400,
    });
    expect(volumeTrend(workouts, "2026-01-02", 2)).toEqual([
      { date: "2025-12-22", volume: 100, sessions: 1 },
      { date: "2025-12-29", volume: 500, sessions: 2 },
    ]);
  });
  it("keeps empty weeks and does not invent a percentage without a baseline", () => {
    expect(weeklySummary([session("2026-09-12", 200)], "2026-09-12").change).toBeNull();
    expect(volumeTrend([], "2026-09-12")).toHaveLength(6);
    expect(volumeTrend([], "2026-09-12").every((week) => week.volume === 0)).toBe(true);
  });
  it("normalizes range bounds while keeping the current week last", () => {
    expect(volumeTrend([], "2026-09-12", 80)).toHaveLength(52);
    expect(volumeTrend([], "2026-09-12", 80).at(-1)?.date).toBe("2026-09-07");
    expect(volumeTrend([], "2026-09-12", -2)).toEqual([
      { date: "2026-09-07", volume: 0, sessions: 0 },
    ]);
  });
});
