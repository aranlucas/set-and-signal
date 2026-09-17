import { describe, expect, it } from "vitest";
import { buildPlanBundle, mergePlan, parsePlan } from "./plan-share";
import { DEFAULT_APP_STATE } from "@/domain/training/default-state";

describe("multi-session plan sharing", () => {
  it("preserves ordered sessions and metadata through export and import with new routine IDs", () => {
    const source = structuredClone(DEFAULT_APP_STATE);
    source.routines = [
      { id: "rehab", name: "Rehab", emoji: "", ex: [] },
      { id: "run", name: "Run", emoji: "", ex: [] },
    ];
    source.week = {
      2: [{ routineId: "rehab" }, { routineId: "run", start: "18:00", label: "Easy" }],
    };
    const exported = buildPlanBundle(source);
    expect(exported.opengym_plan).toBe(2);
    const destination = structuredClone(DEFAULT_APP_STATE);
    mergePlan(destination, parsePlan(JSON.stringify(exported)), { schedule: true });
    const sessions = destination.week[2]!;
    expect(
      sessions.map(
        (session) => destination.routines.find((routine) => routine.id === session.routineId)?.name,
      ),
    ).toEqual(["Rehab", "Run"]);
    expect(sessions[1]).toMatchObject({ start: "18:00", label: "Easy" });
    expect(sessions[1].routineId).not.toBe("run");
  });

  it("still imports legacy version-one schedules", () => {
    const parsed = parsePlan(
      JSON.stringify({
        opengym_plan: 1,
        exported: "2026-09-15",
        name: "Legacy",
        routines: [],
        customEx: [],
        week: { 2: "a" },
      }),
    );
    expect(parsed.week).toEqual({ 2: [{ routineId: "a" }] });
  });
});
