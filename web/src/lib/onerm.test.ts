import { describe, it, expect } from "vitest";
import {
  estimate1RM,
  bestSetOf,
  e1rmSeries,
  best1RM,
  is1RMRecord,
  REP_CAP,
  FORMULAS,
} from "./onerm";

describe("estimate1RM", () => {
  it("returns the load unchanged for a single rep", () => {
    expect(estimate1RM(100, 1)).toBe(100);
    expect(estimate1RM(62.5, 1)).toBe(62.5);
  });

  it("matches Epley by hand across the usual rep ranges", () => {
    expect(estimate1RM(100, 5)).toBe(116.7); // 100 · (1 + 5/30)
    expect(estimate1RM(100, 10)).toBe(133.3);
    expect(estimate1RM(80, 8)).toBe(101.3);
    expect(estimate1RM(60, 3)).toBe(66);
  });

  it("rounds to one decimal", () => {
    expect(estimate1RM(101.25, 7)).toBe(124.9);
    expect(Number.isInteger(estimate1RM(100, 3)! * 10)).toBe(true);
  });

  it("refuses reps beyond the cap rather than guessing", () => {
    expect(estimate1RM(100, REP_CAP)).not.toBeNull();
    expect(estimate1RM(100, REP_CAP + 1)).toBeNull();
    expect(estimate1RM(60, 30)).toBeNull();
  });

  it("rejects invalid, zero and negative input", () => {
    expect(estimate1RM(0, 5)).toBeNull();
    expect(estimate1RM(-100, 5)).toBeNull();
    expect(estimate1RM(100, 0)).toBeNull();
    expect(estimate1RM(100, -3)).toBeNull();
    expect(estimate1RM(undefined, 5)).toBeNull();
    expect(estimate1RM(100)).toBeNull();
    expect(estimate1RM(NaN, 5)).toBeNull();
    expect(estimate1RM(Infinity, 5)).toBeNull();
    expect(estimate1RM("", "")).toBeNull();
  });

  it("accepts numeric strings, the shape number inputs arrive in", () => {
    expect(estimate1RM("100", "5")).toBe(116.7);
  });

  it("offers the other documented formulas and agrees with them at low reps", () => {
    expect(estimate1RM(100, 5, "brzycki")).toBe(112.5);
    expect(estimate1RM(100, 5, "lombardi")).toBe(117.5);
    expect(Object.keys(FORMULAS)).toContain("epley");
  });

  it("keeps the formulas within a few percent up to 8 reps, and diverges most at the cap", () => {
    // 100 × r ≤ REP_CAP always estimates, so the null branch never fires here
    const spread = (r: number) =>
      Math.max(...Object.keys(FORMULAS).map((f) => estimate1RM(100, r, f)!)) -
      Math.min(...Object.keys(FORMULAS).map((f) => estimate1RM(100, r, f)!));
    expect(spread(1)).toBe(0); // one rep is measured, not estimated
    for (let r = 2; r <= 8; r++) expect(spread(r)).toBeLessThan(6);
    const upTo: number[] = [];
    for (let r = 1; r < REP_CAP; r++) upTo.push(spread(r));
    expect(spread(REP_CAP)).toBeGreaterThan(Math.max(...upTo)); // why REP_CAP exists
  });

  it("falls back to the default for an unknown formula name", () => {
    expect(estimate1RM(100, 5, "nope")).toBe(estimate1RM(100, 5));
  });
});

describe("bestSetOf", () => {
  it("picks the highest estimate, not the heaviest set", () => {
    const entry = {
      id: "x",
      sets: [
        { w: 100, r: 5, done: true }, // 116.7
        { w: 110, r: 3, done: true }, // 121.0
        { w: 120, r: 1, done: true }, // 120.0
      ],
    };
    expect(bestSetOf(entry)).toEqual({ est: 121, w: 110, r: 3 });
  });

  it("ignores sets that were never checked off", () => {
    const entry = {
      id: "x",
      sets: [
        { w: 100, r: 5, done: true },
        { w: 200, r: 5, done: false },
      ],
    };
    expect(bestSetOf(entry)!.w).toBe(100);
  });

  it("ignores topW, which carries no rep count", () => {
    const entry = { id: "x", topW: 200, sets: [{ w: 100, r: 5, done: true }] };
    expect(bestSetOf(entry)!.est).toBe(116.7);
  });

  it("returns null for cardio and timed entries", () => {
    const cardio = { id: "c", sets: [{ min: 20, speed: 9, done: true }] };
    const hold = { id: "p", sets: [{ sec: 60, w: 0, done: true }] };
    const weighted = { id: "p", sets: [{ sec: 60, w: 20, done: true }] };
    expect(bestSetOf(cardio)).toBeNull();
    expect(bestSetOf(hold)).toBeNull();
    expect(bestSetOf(weighted)).toBeNull();
  });

  it("survives a missing or empty entry", () => {
    expect(bestSetOf(null)).toBeNull();
    expect(bestSetOf({ sets: [] })).toBeNull();
  });
});

const state = {
  workouts: [
    {
      d: "2026-01-01",
      start: 1,
      entries: [{ id: "bench", topW: null, sets: [{ w: 80, r: 5, done: true }] }],
    },
    {
      d: "2026-01-08",
      start: 2,
      entries: [{ id: "squat", topW: null, sets: [{ w: 100, r: 5, done: true }] }],
    },
    {
      d: "2026-01-15",
      start: 3,
      entries: [
        {
          id: "bench",
          topW: null,
          sets: [
            { w: 90, r: 5, done: true },
            { w: 90, r: 3, done: false },
          ],
        },
      ],
    },
    {
      d: "2026-01-22",
      start: 4,
      entries: [{ id: "bench", topW: null, sets: [{ w: 85, r: 5, done: true }] }],
    },
    {
      d: "2026-01-29",
      start: 5,
      entries: [{ id: "run", topW: null, sets: [{ min: 30, speed: 10, done: true }] }],
    },
  ],
};

describe("e1rmSeries / best1RM", () => {
  it("yields one chronological point per workout that produced an estimate", () => {
    const pts = e1rmSeries(state, "bench");
    expect(pts.map((p) => p.d)).toEqual(["2026-01-01", "2026-01-15", "2026-01-22"]);
    expect(pts.map((p) => p.y)).toEqual([93.3, 105, 99.2]);
  });

  it("reports the all-time best with the set behind it", () => {
    expect(best1RM(state, "bench")).toEqual({
      est: 105,
      w: 90,
      r: 5,
      d: "2026-01-15",
      t: 3,
    });
  });

  it("has nothing to say about cardio or an unknown exercise", () => {
    expect(e1rmSeries(state, "run")).toEqual([]);
    expect(best1RM(state, "run")).toBeNull();
    expect(best1RM(state, "nope")).toBeNull();
    expect(best1RM({ workouts: [] }, "bench")).toBeNull();
    expect(best1RM({}, "bench")).toBeNull();
  });
});

describe("is1RMRecord", () => {
  it("flags a session that beats every previous estimate", () => {
    const entry = { id: "bench", sets: [{ w: 95, r: 5, done: true }] };
    const rec = is1RMRecord(state, "bench", entry);
    expect(rec).toEqual({ est: 110.8, w: 95, r: 5, prev: 105 });
  });

  it("stays quiet when the session does not beat the record", () => {
    const at = { id: "bench", sets: [{ w: 90, r: 5, done: true }] };
    const under = { id: "bench", sets: [{ w: 80, r: 5, done: true }] };
    expect(is1RMRecord(state, "bench", at)).toBeNull();
    expect(is1RMRecord(state, "bench", under)).toBeNull();
  });

  it("counts the first ever estimate as a record", () => {
    const entry = { id: "deadlift", sets: [{ w: 140, r: 3, done: true }] };
    const rec = is1RMRecord(state, "deadlift", entry)!;
    expect(rec.prev).toBe(0);
    expect(rec.est).toBe(154);
  });

  it("says nothing for a timed or unfinished entry", () => {
    const plank = { id: "plank", sets: [{ sec: 90, done: true }] };
    const skipped = { id: "bench", sets: [{ w: 200, r: 5, done: false }] };
    expect(is1RMRecord(state, "plank", plank)).toBeNull();
    expect(is1RMRecord(state, "bench", skipped)).toBeNull();
  });
});
