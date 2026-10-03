import { describe, expect, it } from "vitest";
import { EXIDX } from "@/domain/exercises/exercises";
import { DEFAULT_APP_STATE } from "./default-state";
import {
  adaptSession,
  availableAlternatives,
  canUndoSessionCopy,
  createSessionRoutine,
  estimateSessionMinutes,
  fitSession,
  SESSION_MOVEMENTS,
  validSessionConfig,
  validSessionConstraints,
} from "./session-planner";
import type { Routine } from "@/shared/lib/types";

const source: Routine = {
  id: "synthetic-source",
  name: "Travel strength",
  emoji: "barbell",
  prog: "linear",
  ex: [
    { id: "0043", sets: 4, reps: 8, weight: 60, sg: "pair" },
    { id: "0025", sets: 4, reps: 8, weight: 40, sg: "pair" },
    { id: "0027", sets: 3, reps: 10, weight: 40 },
    { id: "3666", sets: 1, min: 25, speed: 8 },
  ],
};

const constraints = { equipment: ["dumbbell", "stationary bike"], budgetMin: 30, restSec: 90 };

describe("equipment and time session planning", () => {
  it("automatically uses distinct alternatives and explains exhausted choices", () => {
    const press = {
      ...source,
      ex: [
        { id: "0025", sets: 3, reps: 8 },
        { id: "0047", sets: 3, reps: 8 },
      ],
    };

    const rows = adaptSession(press, { ...constraints, equipment: [] });
    expect(rows[0].planned?.id).toBe("0662");
    expect(rows[1].planned).toBeNull();
    expect(rows[1].reason).toBe("duplicate");
  });
  it("does not change logging modes across alternatives", () => {
    expect(
      availableAlternatives({ id: "0043", sets: 1, mode: "cardio", min: 10 }, ["dumbbell"]),
    ).toEqual([]);
    expect(
      availableAlternatives({ id: "3666", sets: 1, mode: "reps", reps: 10 }, ["stationary bike"]),
    ).toEqual([]);
  });
  it("uses catalogue identities and explicitly known equipment requirements", () => {
    expect(new Set(SESSION_MOVEMENTS.map((entry) => entry.id)).size).toBe(SESSION_MOVEMENTS.length);

    for (const entry of SESSION_MOVEMENTS) expect(EXIDX[entry.id]).toBeDefined();
  });
  it.each(
    [
      [],
      ["dumbbell"],
      ["band"],
      ["barbell"],
      ["barbell", "bench", "squat rack"],
      ["chest press machine", "row machine"],
      ["outdoor route"],
      ["stationary bike"],
    ].map((equipment) => ({ equipment })),
  )("never selects a movement with missing equipment: $equipment", ({ equipment }) => {
    const rows = adaptSession(source, { ...constraints, equipment });

    for (const row of rows) {
      if (!row.planned) continue;
      const requirements = SESSION_MOVEMENTS.find((candidate) => candidate.id === row.planned?.id);
      expect(requirements?.needs.every((item) => equipment.includes(item))).toBe(true);
    }
  });
  it("keeps available originals and accounts for bench/rack requirements", () => {
    const original = source.ex[1];
    expect(
      availableAlternatives(original, ["barbell"]).some((entry) => entry.id === original.id),
    ).toBe(false);

    const row = adaptSession(source, {
      ...constraints,
      equipment: ["barbell", "bench", "squat rack"],
    })[1];

    expect(row.reason).toBe("kept");
    expect(row.planned?.weight).toBe(40);
    expect(row.planned?.sg).toBeUndefined();
  });
  it("does not keep added bodyweight loads without selected load equipment", () => {
    const loaded = { id: "0662", sets: 3, reps: 12, weight: 10 };
    expect(availableAlternatives(loaded, []).some((entry) => entry.id === loaded.id)).toBe(false);
    expect(
      availableAlternatives(loaded, ["added weight"]).some((entry) => entry.id === loaded.id),
    ).toBe(true);
  });
  it("shows unavailable and unknown movements rather than inventing alternatives", () => {
    const routine = {
      ...source,
      ex: [
        { id: "0585", sets: 3, reps: 10 },
        { id: "synthetic-custom", sets: 2, reps: 10 },
      ],
    };

    const rows = adaptSession(routine, constraints);
    expect(rows.map((row) => row.reason)).toEqual(["unavailable", "unknown"]);
    expect(rows.every((row) => row.planned === null)).toBe(true);
    expect(() => createSessionRoutine(routine, constraints, rows, "copy", "Copy")).toThrow(
      /Review equipment/u,
    );
  });
  it("resets transferred load/speed and allows rejecting or editing choices", () => {
    const snapshot = structuredClone(source);
    const rows = adaptSession(source, constraints, [{ sets: 2, amount: 12 }, { id: "" }]);
    expect(rows[0].planned).toMatchObject({
      id: "1760",
      sets: 2,
      reps: 12,
      weight: 0,
      prog: "off",
    });
    expect(rows[1].reason).toBe("rejected");
    expect(rows[3].planned).toMatchObject({ id: "2138", speed: 0, min: 25 });
    expect(source).toEqual(snapshot);
  });
  it("omits a stale manual choice after its equipment is deselected", () => {
    const rows = adaptSession(source, { ...constraints, equipment: [] }, [{ id: "1760" }]);
    expect(rows[0].planned).toBeNull();
  });
  it("keeps intentional timed targets without suggesting different rep movements", () => {
    const config = { id: "0043", mode: "time" as const, sec: 30, sets: 2 };
    expect(availableAlternatives(config, ["dumbbell"])).toEqual([]);
    expect(
      availableAlternatives(config, ["barbell", "squat rack"]).map((entry) => entry.id),
    ).toEqual(["0043"]);
  });
  it("fits the approximate budget without modifying original targets", () => {
    const rows = adaptSession(source, constraints);
    expect(
      estimateSessionMinutes(
        rows.flatMap((row) => (row.planned ? [row.planned] : [])),
        constraints.restSec,
      ),
    ).toBeGreaterThan(30);
    const choices = fitSession(rows, constraints);
    const fitted = adaptSession(source, constraints, choices);
    const copy = createSessionRoutine(source, constraints, fitted, "copy", "Copy");
    expect(estimateSessionMinutes(copy.ex, 90)).toBeLessThanOrEqual(30);
    expect(source.ex[3].min).toBe(25);
    expect(copy.sessionPlan?.rows[3].original.min).toBe(25);
    expect(copy.sessionPlan?.sourceName).toBe("Travel strength");
  });
  it("cannot save an empty tiny-budget session, invalid targets, or duplicate alternatives", () => {
    const tiny = { ...constraints, budgetMin: 5 };
    const rows = adaptSession(source, tiny);
    expect(() =>
      createSessionRoutine(
        source,
        tiny,
        adaptSession(source, tiny, fitSession(rows, tiny)),
        "copy",
        "Copy",
      ),
    ).toThrow(/Review equipment/u);
    const duplicates = { ...source, ex: [source.ex[0], { ...source.ex[0], id: "0739" }] };
    expect(() =>
      createSessionRoutine(
        duplicates,
        constraints,
        adaptSession(duplicates, constraints, [{ id: "1760" }, { id: "1760" }]),
        "copy",
        "Copy",
      ),
    ).toThrow(/Review equipment/u);
    expect(validSessionConfig({ id: "0662", sets: 2, reps: 1.5 })).toBe(false);
    expect(validSessionConstraints({ ...constraints, restSec: Number.NaN })).toBe(false);
    expect(validSessionConstraints({ ...constraints, equipment: ["all machines"] })).toBe(false);
  });
  it("undo only removes an unchanged, unused, unscheduled copy", () => {
    const copy = createSessionRoutine(
      source,
      constraints,
      adaptSession(source, constraints, fitSession(adaptSession(source, constraints), constraints)),
      "copy",
      "Copy",
    );

    const state = structuredClone(DEFAULT_APP_STATE);
    state.routines = [source, copy];
    expect(canUndoSessionCopy(state, copy)).toBe(true);
    state.week[1] = [{ routineId: copy.id }];
    expect(canUndoSessionCopy(state, copy)).toBe(false);
    state.week = {};
    state.routines[1] = { ...copy, name: "Edited" };
    expect(canUndoSessionCopy(state, copy)).toBe(false);
  });
});
