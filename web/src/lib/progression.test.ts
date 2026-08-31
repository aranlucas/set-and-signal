import { describe, it, expect } from "vitest";
import {
  readSession,
  sessionsFor,
  stallCount,
  nextPrescription,
  applyPrescription,
  applyPrescriptionToConfig,
  syncSourceRoutineWeights,
  policyFor,
  defaultIncrement,
  POLICIES_FOR,
  DELOAD_AFTER,
  MAX_BW_SETS,
} from "./progression.js";
import { EXDB } from "./exercises.js";
import type { ExConfig } from "./types.js";

const LIFT = EXDB.find(
  (e) =>
    e.bp !== "cardio" && !["upper legs", "lower legs", "back", "hips", "glutes"].includes(e.bp),
)!.id;
const HEAVY = EXDB.find((e) => e.bp === "upper legs" && e.eq === "barbell")!.id;
const DUMBBELL_HEAVY = EXDB.find((e) => e.bp === "upper legs" && e.eq === "dumbbell")!.id;
const GOBLET = "1760";
const CARDIO = EXDB.find((e) => e.bp === "cardio")!.id;

// Build a state whose history is a list of sessions given as [weight, ...repsPerSet].
// A rep count of null means "the set was never checked off".
const hist = (id: string, rows: Array<Array<number | null>>, target?: Partial<ExConfig>) => ({
  unit: "kg" as const,
  workouts: rows.map((row, i) => ({
    d: "2026-01-0" + (i + 1),
    entries: [
      {
        id,
        target: target || { sets: 3, reps: 5, weight: row[0]! },
        sets: row
          .slice(1)
          .map((r) =>
            r === null ? { w: row[0]!, r: 0, done: false } : { w: row[0]!, r, done: true },
          ),
      },
    ],
  })),
});

describe("readSession", () => {
  const T = { sets: 3, reps: 5 };
  it("counts a session where every set made its reps as a hit", () => {
    const s = readSession({
      id: LIFT,
      target: T,
      sets: [
        { w: 60, r: 5, done: true },
        { w: 60, r: 5, done: true },
        { w: 60, r: 6, done: true },
      ],
    });
    expect(s.ok).toBe(true);
    expect(s.weight).toBe(60);
    expect(s.amrap).toBe(6);
    expect(s.low).toBe(5);
  });

  it("counts short reps as a miss even when the set was checked off", () => {
    expect(
      readSession({
        id: LIFT,
        target: T,
        sets: [
          { w: 60, r: 5, done: true },
          { w: 60, r: 5, done: true },
          { w: 60, r: 3, done: true },
        ],
      }).ok,
    ).toBe(false);
  });

  it("counts an unchecked set as a miss — it was not performed", () => {
    const s = readSession({
      id: LIFT,
      target: T,
      sets: [
        { w: 60, r: 5, done: true },
        { w: 60, r: 5, done: true },
        { w: 60, r: 0, done: false },
      ],
    });
    expect(s.ok).toBe(false);
    expect(s.weight).toBe(60); // the working weight is still known from the sets that counted
  });

  it("counts fewer sets than prescribed as a miss", () => {
    expect(
      readSession({
        id: LIFT,
        target: T,
        sets: [
          { w: 60, r: 5, done: true },
          { w: 60, r: 5, done: true },
        ],
      }).ok,
    ).toBe(false);
  });

  it("refuses to call a session a hit when nothing was prescribed", () => {
    expect(readSession({ id: LIFT, target: {}, sets: [{ w: 60, r: 5, done: true }] }).ok).toBe(
      false,
    );
  });

  it("ignores warm-up sets when judging the session", () => {
    const s = readSession({
      id: LIFT,
      target: { sets: 3, reps: 8, weight: 155 },
      sets: [
        { w: 95, r: 8, done: true, wu: true },
        { w: 155, r: 8, done: true },
        { w: 155, r: 8, done: true },
        { w: 155, r: 8, done: true },
      ],
    });
    expect(s.ok).toBe(true);
    expect(s.weight).toBe(155);
  });

  it("falls back to the prescribed weight when working sets were logged at 0", () => {
    expect(
      readSession({
        id: LIFT,
        target: { sets: 3, reps: 8, weight: 155 },
        sets: [
          { w: 0, r: 8, done: true },
          { w: 0, r: 8, done: true },
          { w: 0, r: 8, done: true },
        ],
      }).weight,
    ).toBe(155);
  });

  it("reads a timed session by the hold, not by reps", () => {
    const s = readSession({
      id: LIFT,
      target: { sets: 2, sec: 45, mode: "time" },
      sets: [
        { sec: 45, w: 0, done: true },
        { sec: 50, w: 0, done: true },
      ],
    });
    expect(s.mode).toBe("time");
    expect(s.ok).toBe(true);
    expect(s.best).toBe(50);
    expect(
      readSession({
        id: LIFT,
        target: { sets: 2, sec: 45, mode: "time" },
        sets: [
          { sec: 45, done: true },
          { sec: 30, done: true },
        ],
      }).ok,
    ).toBe(false);
  });
});

describe("stallCount", () => {
  it("counts consecutive misses back from the most recent session", () => {
    expect(stallCount([{ ok: true }, { ok: true }])).toBe(0);
    expect(stallCount([{ ok: true }, { ok: false }])).toBe(1);
    expect(stallCount([{ ok: false }, { ok: false }, { ok: false }])).toBe(3);
    expect(stallCount([{ ok: false }, { ok: true }, { ok: false }])).toBe(1);
    expect(stallCount([])).toBe(0);
  });
});

describe("policyFor", () => {
  it("keeps the app's long-standing behaviour as the default for reps work", () => {
    expect(policyFor({ id: LIFT }, null, "reps")).toBe("linear");
  });
  it("leaves timed and cardio work alone unless asked", () => {
    expect(policyFor({ id: LIFT, mode: "time" }, null, "time")).toBe("off");
    expect(policyFor({ id: CARDIO }, null, "cardio")).toBe("off");
  });
  it("lets the exercise override the routine, and the routine override the default", () => {
    expect(policyFor({ id: LIFT }, { prog: "greyskull" }, "reps")).toBe("greyskull");
    expect(policyFor({ id: LIFT, prog: "double" }, { prog: "greyskull" }, "reps")).toBe("double");
  });
  it("refuses a policy that makes no sense for the mode", () => {
    expect(policyFor({ id: LIFT, mode: "time", prog: "greyskull" }, null, "time")).toBe("off");
    expect(policyFor({ id: CARDIO, prog: "linear" }, null, "cardio")).toBe("off");
    expect(POLICIES_FOR.cardio).toEqual(["off"]);
  });
});

describe("defaultIncrement", () => {
  it("gives lower-body lifts the bigger jump", () => {
    expect(defaultIncrement(LIFT, "kg")).toBe(2.5);
    expect(defaultIncrement(HEAVY, "kg")).toBe(5);
  });
  it("scales to pounds", () => {
    expect(defaultIncrement(LIFT, "lb")).toBe(5);
    expect(defaultIncrement(HEAVY, "lb")).toBe(10);
  });
  it("keeps dumbbells on the small plate, even on squat and hinge work", () => {
    expect(defaultIncrement(DUMBBELL_HEAVY, "lb")).toBe(5);
    expect(defaultIncrement(DUMBBELL_HEAVY, "kg")).toBe(2.5);
    expect(defaultIncrement(GOBLET, "lb")).toBe(5);
  });
  it("falls back for an unknown exercise", () => {
    expect(defaultIncrement("nope", "kg")).toBe(2.5);
  });
});

describe("linear progression", () => {
  const cfg = {
    id: LIFT,
    sets: 3,
    reps: 5,
    weight: 60,
    prog: "linear",
  } as const;

  it("says nothing useful before there is any history", () => {
    const p = nextPrescription({ unit: "kg" as const, workouts: [] }, cfg);
    expect(p.kind).toBe("first");
    expect(p.weight).toBeUndefined();
  });

  it("adds the increment after a clean session", () => {
    const p = nextPrescription(hist(LIFT, [[60, 5, 5, 5]]), cfg);
    expect(p.kind).toBe("up");
    expect(p.weight).toBe(62.5);
  });

  it("repeats the weight after a miss instead of advancing", () => {
    const p = nextPrescription(hist(LIFT, [[60, 5, 5, 3]]), cfg);
    expect(p.kind).toBe("hold");
    expect(p.weight).toBe(60);
  });

  it("does not advance when the last set was left unchecked", () => {
    const p = nextPrescription(hist(LIFT, [[60, 5, 5, null]]), cfg);
    expect(p.kind).toBe("hold");
    expect(p.weight).toBe(60);
  });

  it("deloads after two misses in a row, onto a loadable weight", () => {
    const p = nextPrescription(
      hist(LIFT, [
        [60, 5, 5, 3],
        [60, 5, 4, 4],
      ]),
      cfg,
    );
    expect(p.kind).toBe("deload");
    expect(p.weight).toBe(55); // 60 × 0.9 = 54 → nearest loadable 2.5 step
    expect(DELOAD_AFTER.linear).toBe(2);
  });

  it("a good session in between clears the stall", () => {
    const p = nextPrescription(
      hist(LIFT, [
        [60, 5, 5, 3],
        [60, 5, 5, 5],
        [60, 5, 5, 3],
      ]),
      cfg,
    );
    expect(p.kind).toBe("hold");
  });

  it("never deloads below one increment, however light the lift already is", () => {
    const p = nextPrescription(
      hist(LIFT, [
        [2.5, 1, 1, 1],
        [2.5, 1, 1, 1],
      ]),
      cfg,
    );
    expect(p.kind).toBe("deload");
    expect(p.weight).toBe(2.5);
  });

  it("always makes a deload actually lighter, even when rounding would not", () => {
    // 20 × 0.9 = 18 → nearest 2.5 step is 17.5, fine. 5 × 0.9 = 4.5 → nearest step is 5,
    // which is no deload at all, so it has to step down instead.
    const p = nextPrescription(
      hist(LIFT, [
        [5, 1, 1, 1],
        [5, 1, 1, 1],
      ]),
      cfg,
    );
    expect(p.weight).toBeLessThan(5);
  });

  it("uses the heavier step for a lower-body lift", () => {
    const p = nextPrescription(hist(HEAVY, [[100, 5, 5, 5]]), {
      id: HEAVY,
      sets: 3,
      reps: 5,
      prog: "linear",
    });
    expect(p.weight).toBe(105);
  });

  it("honours a per-exercise increment override", () => {
    const p = nextPrescription(hist(LIFT, [[60, 5, 5, 5]]), { ...cfg, inc: 1 });
    expect(p.weight).toBe(61);
  });

  it("works in pounds", () => {
    const state = { ...hist(LIFT, [[135, 5, 5, 5]]), unit: "lb" as const };
    expect(nextPrescription(state, cfg).weight).toBe(140);
  });
});

describe("bodyweight exercises", () => {
  const cfg: ExConfig = {
    id: LIFT,
    sets: 3,
    reps: 10,
    weight: 0,
    bodyweight: true,
    prog: "linear",
  };
  const bw = (rows: Array<Array<number | null>>) => hist(LIFT, rows, { sets: 3, reps: 10 });

  it("never invents a weight to deload to — there is nothing to take off a push-up", () => {
    const p = nextPrescription(
      bw([
        [0, 10, 10, 8],
        [0, 10, 10, 9],
        [0, 10, 10, 8],
      ]),
      cfg,
    );
    expect(p.kind).toBe("hold");
    expect(p.weight).toBe(0);
    expect(p.reps).toBe(10);
  });

  it("progresses in reps instead of load after a clean session", () => {
    const p = nextPrescription(bw([[0, 10, 10, 10]]), cfg);
    expect(p.kind).toBe("up");
    expect(p.weight).toBe(0);
    expect(p.reps).toBe(11);
  });

  /* A ceiling turns "+1 rep forever" into a plan — issue #33. */
  it("climbs to the ceiling one rep at a time", () => {
    const p = nextPrescription(bw([[0, 10, 10, 10]]), { ...cfg, repsMax: 15 });
    expect(p.kind).toBe("up");
    expect(p.reps).toBe(11);
    expect(p.sets).toBeUndefined();
  });

  it("adds a set and restarts the range once the ceiling is reached", () => {
    const at15 = hist(LIFT, [[0, 15, 15, 15]], { sets: 3, reps: 15 });
    const p = nextPrescription(at15, { ...cfg, reps: 10, repsMax: 15 });
    expect(p.kind).toBe("up");
    expect(p.sets).toBe(4);
    expect(p.reps).toBe(10);
    expect(p.weight).toBe(0);
  });

  it("stops adding sets at the cap and says what to do instead", () => {
    const at15 = hist(LIFT, [[0, 15, 15, 15]], { sets: 3, reps: 15 });
    const p = nextPrescription(at15, {
      ...cfg,
      sets: MAX_BW_SETS,
      reps: 10,
      repsMax: 15,
    });
    expect(p.kind).toBe("hold");
    expect(p.sets).toBeUndefined();
    expect(Array.isArray(p.why) ? p.why[0] : p.why?.defaultValue).toMatch(/harder variation/);
  });

  it("leaves a belted set to the normal policies — there is a load to add now", () => {
    const belted = hist(LIFT, [[10, 10, 10, 10]], { sets: 3, reps: 10 });
    const p = nextPrescription(belted, {
      ...cfg,
      bodyweight: true,
      repsMax: 15,
    });
    expect(p.kind).toBe("up");
    expect(p.weight).toBeGreaterThan(10);
    expect(p.sets).toBeUndefined();
  });

  it("steps a unilateral total by two, so it lands on 16, 18, 20 (issue #31)", () => {
    const at16 = hist(LIFT, [[0, 16, 16, 16]], { sets: 3, reps: 16 });
    expect(nextPrescription(at16, { ...cfg, reps: 16, side: true }).reps).toBe(18);
    // and by one when it is not
    expect(nextPrescription(at16, { ...cfg, reps: 16 }).reps).toBe(17);
  });

  it("keeps climbing reps forever when no ceiling was set — the old behaviour", () => {
    const at30 = hist(LIFT, [[0, 30, 30, 30]], { sets: 3, reps: 30 });
    const p = nextPrescription(at30, cfg);
    expect(p.kind).toBe("up");
    expect(p.reps).toBe(31);
    expect(p.sets).toBeUndefined();
  });

  it("applies to every policy, not just linear", () => {
    for (const prog of ["linear", "greyskull", "double"] as const) {
      const p = nextPrescription(
        bw([
          [0, 10, 10, 4],
          [0, 10, 10, 4],
          [0, 10, 10, 4],
        ]),
        { ...cfg, prog },
      );
      expect(p.weight).toBe(0);
      expect(p.kind).toBe("hold");
    }
  });

  it("still adds load the moment the exercise is actually weighted", () => {
    const p = nextPrescription(hist(LIFT, [[10, 10, 10, 10]], { sets: 3, reps: 10 }), cfg);
    expect(p.kind).toBe("up");
    expect(p.weight).toBe(12.5);
  });
});

describe("Greyskull LP", () => {
  const cfg: ExConfig = {
    id: LIFT,
    sets: 3,
    reps: 5,
    weight: 60,
    prog: "greyskull",
  };

  it("advances when the final set makes the target", () => {
    const p = nextPrescription(hist(LIFT, [[60, 5, 5, 5]]), cfg);
    expect(p.kind).toBe("up");
    expect(p.weight).toBe(62.5);
  });

  it("takes a double jump when the last set doubles the target reps", () => {
    const p = nextPrescription(hist(LIFT, [[60, 5, 5, 10]]), cfg);
    expect(p.kind).toBe("up");
    expect(p.weight).toBe(65);
    expect(Array.isArray(p.why) ? p.why[0] : p.why?.defaultValue).toContain("double");
  });

  it("resets 10 % on the very first failure, unlike plain linear", () => {
    const p = nextPrescription(hist(LIFT, [[60, 5, 5, 3]]), cfg);
    expect(p.kind).toBe("deload");
    expect(p.weight).toBe(55);
    expect(DELOAD_AFTER.greyskull).toBe(1);
  });

  it("keeps resetting from the reduced weight, not the original", () => {
    const p = nextPrescription(
      hist(LIFT, [
        [60, 5, 5, 3],
        [55, 5, 5, 2],
      ]),
      cfg,
    );
    expect(p.kind).toBe("deload");
    expect(p.weight).toBe(50); // 55 × 0.9 = 49.5 → nearest loadable 2.5 step
  });
});

describe("double progression", () => {
  const cfg: ExConfig = {
    id: LIFT,
    sets: 3,
    reps: 12,
    repsMin: 8,
    weight: 40,
    prog: "double",
  };

  it("adds weight and drops back to the bottom of the range at the top of it", () => {
    const p = nextPrescription(hist(LIFT, [[40, 12, 12, 12]], { sets: 3, reps: 12 }), cfg);
    expect(p.kind).toBe("up");
    expect(p.weight).toBe(42.5);
    expect(p.reps).toBe(8);
  });

  it("keeps the weight and asks for one more rep while inside the range", () => {
    const p = nextPrescription(hist(LIFT, [[40, 10, 9, 9]], { sets: 3, reps: 12 }), cfg);
    expect(p.kind).toBe("hold");
    expect(p.weight).toBe(40);
    expect(p.reps).toBe(10); // worst set was 9 → aim for 10
  });

  it("never asks for more than the top of the range", () => {
    const p = nextPrescription(hist(LIFT, [[40, 12, 12, 11]], { sets: 3, reps: 12 }), cfg);
    expect(p.reps).toBeLessThanOrEqual(12);
  });

  it("deloads after a run of stalls and restarts at the bottom of the range", () => {
    const rows = [
      [40, 9, 9, 9],
      [40, 9, 9, 9],
      [40, 9, 9, 9],
    ];
    const p = nextPrescription(hist(LIFT, rows, { sets: 3, reps: 12 }), cfg);
    expect(p.kind).toBe("deload");
    expect(p.reps).toBe(8);
    expect(p.weight).toBe(35); // 40 × 0.9 = 36 → nearest loadable 2.5 step
  });
});

describe("timed progression", () => {
  const cfg: ExConfig = {
    id: LIFT,
    mode: "time",
    sets: 2,
    sec: 45,
    prog: "time",
  };
  const T = { sets: 2, sec: 45, mode: "time" } as const;
  const timeHist = (rows: number[][]) => ({
    unit: "kg" as const,
    workouts: rows.map((row, i) => ({
      d: "2026-02-0" + (i + 1),
      entries: [
        {
          id: LIFT,
          target: T,
          sets: row.map((sec) => ({ sec, w: 0, done: true })),
        },
      ],
    })),
  });

  it("adds time when every set went the full duration", () => {
    const p = nextPrescription(timeHist([[45, 45]]), cfg);
    expect(p.kind).toBe("up");
    expect(p.sec).toBe(50);
    expect(p.weight).toBeUndefined();
  });

  it("repeats the target when a hold came up short", () => {
    const p = nextPrescription(timeHist([[45, 38]]), cfg);
    expect(p.kind).toBe("hold");
    expect(p.sec).toBe(45);
  });

  it("backs the target off after a run of short sessions", () => {
    const p = nextPrescription(
      timeHist([
        [45, 30],
        [45, 32],
        [45, 31],
      ]),
      cfg,
    );
    expect(p.kind).toBe("deload");
    expect(p.sec).toBe(40); // 45 × 0.9 = 40.5 → nearest 5 s step
  });

  it("ignores reps history when the exercise switched to time", () => {
    const state = hist(LIFT, [[60, 5, 5, 5]]);
    const p = nextPrescription({ ...state, unit: "kg" as const }, cfg);
    expect(p.kind).toBe("first"); // no timed session yet, so no opinion
  });
});

describe('policy "off"', () => {
  it("has no opinion at all", () => {
    const p = nextPrescription(hist(LIFT, [[60, 5, 5, 5]]), {
      id: LIFT,
      sets: 3,
      reps: 5,
      prog: "off",
    });
    expect(p.kind).toBe("off");
    expect(p.weight).toBeUndefined();
  });
  it("is what cardio always gets", () => {
    expect(
      nextPrescription({ unit: "kg" as const, workouts: [] }, { id: CARDIO, sets: 1, min: 20 })
        .kind,
    ).toBe("off");
  });
});

describe("sessionsFor", () => {
  it("skips workouts where the exercise was never actually logged", () => {
    const state = {
      unit: "kg" as const,
      workouts: [
        {
          d: "2026-01-01",
          entries: [
            {
              id: LIFT,
              target: { sets: 1, reps: 5 },
              sets: [{ w: 60, r: 5, done: true }],
            },
          ],
        },
        {
          d: "2026-01-02",
          entries: [
            {
              id: LIFT,
              target: { sets: 1, reps: 5 },
              sets: [{ w: 60, r: 0, done: false }],
            },
          ],
        },
        {
          d: "2026-01-03",
          entries: [{ id: "other", target: {}, sets: [{ w: 20, r: 5, done: true }] }],
        },
      ],
    };
    expect(sessionsFor(state, LIFT).map((s) => s.d)).toEqual(["2026-01-01"]);
  });

  it("reads a legacy entry that has no target without crashing", () => {
    const state = {
      unit: "kg" as const,
      workouts: [
        {
          d: "2026-01-01",
          entries: [{ id: LIFT, sets: [{ w: 60, r: 5, done: true }] }],
        },
      ],
    };
    expect(sessionsFor(state, LIFT)).toHaveLength(1);
  });
});

// Workouts only began storing their prescription in v1.2.2. Everything logged before that is
// targetless, and reading it as "missed" would tell every long-standing user to deload on
// their first session after updating — which is exactly what the demo history did.
describe("history logged before targets were recorded", () => {
  const legacy = (rows: number[][]) => ({
    unit: "kg" as const,
    workouts: rows.map((row, i) => ({
      d: "2026-03-" + String(i + 1).padStart(2, "0"),
      entries: [
        {
          id: LIFT,
          sets: row.slice(1).map((r) => ({ w: row[0]!, r, done: true })),
        },
      ], // no target
    })),
  });
  const cfg: ExConfig = {
    id: LIFT,
    sets: 3,
    reps: 5,
    weight: 60,
    prog: "linear",
  };

  it("judges a targetless session against the current plan instead of calling it a miss", () => {
    const p = nextPrescription(legacy([[60, 5, 5, 5]]), cfg);
    expect(p.kind).toBe("up");
    expect(p.weight).toBe(62.5);
  });

  it("does not manufacture a stall out of a long clean history", () => {
    const p = nextPrescription(legacy(Array.from({ length: 11 }, () => [60, 5, 5, 5])), cfg);
    expect(p.kind).toBe("up");
  });

  it("still spots a genuine miss in old data", () => {
    expect(nextPrescription(legacy([[60, 5, 5, 2]]), cfg).kind).toBe("hold");
  });

  it("matches the weight hint the app showed before this engine existed", () => {
    // Old rule: every set at or above the plan's reps, with a real weight → suggest a step up.
    expect(nextPrescription(legacy([[60, 5, 6, 5]]), cfg).weight).toBe(62.5);
    expect(nextPrescription(legacy([[60, 5, 4, 5]]), cfg).kind).toBe("hold");
  });
});

describe("applyPrescription", () => {
  const sets = [
    { w: 60, r: 5, done: true },
    { w: 60, r: 5, done: false },
  ];

  it("rewrites only what the policy decided, and only unlogged sets", () => {
    const out = applyPrescription(sets, { kind: "up", weight: 62.5 });
    expect(out[0]).toEqual({ w: 60, r: 5, done: true });
    expect(out[1]).toEqual({ w: 62.5, r: 5, done: false });
  });

  it("sets reps too when the policy has an opinion about them", () => {
    expect(applyPrescription(sets, { kind: "up", weight: 42.5, reps: 8 })[1]).toEqual({
      w: 42.5,
      r: 8,
      done: false,
    });
  });

  it('touches nothing for "off" or a first session', () => {
    expect(applyPrescription(sets, { kind: "off" })).toBe(sets);
    expect(applyPrescription(sets, { kind: "first" })).toBe(sets);
    expect(applyPrescription(sets, null)).toBe(sets);
  });

  it("adjusts a timed set without inventing a weight", () => {
    const timed = [{ sec: 45, w: 0, done: false }];
    expect(applyPrescription(timed, { kind: "up", sec: 50 })).toEqual([
      { sec: 50, w: 0, done: false },
    ]);
  });

  it("grows the list when the policy added a set (issue #33)", () => {
    const three = [
      { w: 0, r: 10, done: false },
      { w: 0, r: 10, done: false },
      { w: 0, r: 10, done: false },
    ];
    const out = applyPrescription(three, {
      kind: "up",
      weight: 0,
      reps: 10,
      sets: 4,
    });
    expect(out).toHaveLength(4);
    expect(out[3]).toEqual({ w: 0, r: 10, done: false });
  });

  it("never shrinks a session that has already logged sets", () => {
    expect(applyPrescription(sets, { kind: "up", weight: 60, sets: 1 })).toHaveLength(sets.length);
  });
});

describe("apartment full-body working weights", () => {
  const cfg: ExConfig = { id: GOBLET, sets: 3, reps: 8, weight: 0, prog: "linear" };
  const routine = {
    id: "apt-full-body",
    name: "Apartment Full Body",
    emoji: "dumbbell",
    prog: "linear" as const,
    ex: [
      { id: GOBLET, sets: 3, reps: 8, weight: 0 },
      { id: "0289", sets: 3, reps: 8, weight: 0 },
    ],
  };

  it("adds 5 lb after a clean 3×8 on a dumbbell squat", () => {
    const state = {
      unit: "lb" as const,
      workouts: [
        {
          d: "2026-08-24",
          entries: [
            {
              id: GOBLET,
              target: { sets: 3, reps: 8, weight: 155 },
              sets: [
                { w: 155, r: 8, done: true },
                { w: 155, r: 8, done: true },
                { w: 155, r: 8, done: true },
              ],
            },
          ],
        },
      ],
    };
    const p = nextPrescription(state, cfg, routine);
    expect(p.kind).toBe("up");
    expect(p.weight).toBe(160);
  });

  it("holds the weight after a miss", () => {
    const p = nextPrescription(
      {
        unit: "lb" as const,
        workouts: [
          {
            d: "2026-08-24",
            entries: [
              {
                id: GOBLET,
                target: { sets: 3, reps: 8, weight: 155 },
                sets: [
                  { w: 155, r: 8, done: true },
                  { w: 155, r: 8, done: true },
                  { w: 155, r: 6, done: true },
                ],
              },
            ],
          },
        ],
      },
      cfg,
      routine,
    );
    expect(p.kind).toBe("hold");
    expect(p.weight).toBe(155);
  });

  it("deloads after two misses instead of stalling", () => {
    const p = nextPrescription(
      {
        unit: "lb" as const,
        workouts: ["2026-08-24", "2026-08-26"].map((d) => ({
          d,
          entries: [
            {
              id: GOBLET,
              target: { sets: 3, reps: 8, weight: 155 },
              sets: [
                { w: 155, r: 8, done: true },
                { w: 155, r: 8, done: true },
                { w: 155, r: 5, done: true },
              ],
            },
          ],
        })),
      },
      cfg,
      routine,
    );
    expect(p.kind).toBe("deload");
    expect(p.weight).toBe(140); // 155 × 0.9 = 139.5 → nearest 5 lb step
  });

  it("does not treat a loaded lift logged at 0 as bodyweight work", () => {
    const p = nextPrescription(
      {
        unit: "lb" as const,
        workouts: [
          {
            d: "2026-08-24",
            entries: [
              {
                id: GOBLET,
                target: { sets: 3, reps: 8, weight: 0 },
                sets: [
                  { w: 0, r: 8, done: true },
                  { w: 0, r: 8, done: true },
                  { w: 0, r: 8, done: true },
                ],
              },
            ],
          },
        ],
      },
      cfg,
      routine,
    );
    expect(p.kind).toBe("hold");
    expect(p.weight).toBe(0);
    expect(p.reps).toBe(8);
  });

  it("writes the next working weight onto the source routine without wiping it", () => {
    const state = {
      unit: "lb" as const,
      workouts: [
        {
          d: "2026-08-24",
          entries: [
            {
              id: GOBLET,
              target: { sets: 3, reps: 8, weight: 155 },
              sets: [
                { w: 155, r: 8, done: true },
                { w: 155, r: 8, done: true },
                { w: 155, r: 8, done: true },
              ],
            },
          ],
        },
      ],
    };
    const updated = syncSourceRoutineWeights(state, routine, [GOBLET]);
    expect(updated.id).toBe("apt-full-body");
    expect(updated.name).toBe("Apartment Full Body");
    expect(updated.ex).toHaveLength(2);
    expect(updated.ex[0]).toMatchObject({ id: GOBLET, sets: 3, reps: 8, weight: 160 });
    expect(updated.ex[1]).toEqual({ id: "0289", sets: 3, reps: 8, weight: 0 });
  });

  it("copies decided fields onto a planned exercise", () => {
    expect(
      applyPrescriptionToConfig(
        { id: GOBLET, sets: 3, reps: 8, weight: 0 },
        { policy: "linear", kind: "up", weight: 160 },
      ),
    ).toMatchObject({ id: GOBLET, sets: 3, reps: 8, weight: 160 });
  });
});
