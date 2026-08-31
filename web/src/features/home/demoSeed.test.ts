// The demo build is the only Set & Signal surface many people ever see, so its seeded history has to
// exercise the stats it is there to show off — including the effort card, which renders as
// dashes on a history that is rated too thinly or not at all.
import { describe, it, expect } from "vitest";
import { buildDemoState, type DemoState } from "@/features/home/demoSeed.js";
import {
  effortSummary,
  effortWeeks,
  effortHistogram,
  hasEffort,
  displayScale,
  avgRir,
  rirOf,
  isHardSet,
  MIN_RATED,
  HARD_RIR,
} from "@/domain/training/effort.js";
import { effortOf, modeOf, type SetFields } from "@/domain/training/history.js";
import type { Workout, WorkoutEntry } from "@/shared/lib/types.js";

const demoState = buildDemoState();
const eachSet = (fn: (s: SetFields, w: Workout, e: WorkoutEntry) => void) =>
  demoState.workouts.forEach((w) => w.entries.forEach((e) => e.sets.forEach((s) => fn(s, w, e))));
const sum = effortSummary(demoState, 0); // 0 = the whole history

describe("demo seed — effort", () => {
  it("labels the kilogram-authored seed with kilograms", () => {
    expect(demoState.unit).toBe("kg");
  });

  it("rates enough of the history to clear every guard in the effort stats", () => {
    expect(hasEffort(demoState)).toBe(true);
    expect(sum.done).toBeGreaterThan(400);
    expect(sum.rated).toBeGreaterThan(MIN_RATED * 20);
    expect(sum.avg).not.toBeNull();
    expect(sum.hardPct).not.toBeNull();
    // Somewhere between "everything is a grinder" and "nothing ever gets close".
    expect(sum.hardPct).toBeGreaterThan(0.3);
    expect(sum.hardPct).toBeLessThan(0.9);
  });

  it("leaves coverage partial, because that is the normal case the UI states a denominator for", () => {
    const cov = sum.rated / sum.done;
    expect(cov).toBeGreaterThan(0.7);
    expect(cov).toBeLessThan(0.95);
  });

  it("never rates a set that has no reps to leave in the tank", () => {
    const invalidModes: string[] = [];
    eachSet((s, _w, e) => {
      if (rirOf(s) != null && modeOf({ ...e.target, id: e.id }) !== "reps") {
        invalidModes.push(e.id);
      }
    });
    expect(invalidModes).toEqual([]);
  });

  it("leaves one exercise unrated throughout, so the per-exercise Effort toggle is absent for it", () => {
    const rated: Record<string, number> = {};
    eachSet((s, _w, e) => {
      rated[e.id] = (rated[e.id] || 0) + (rirOf(s) == null ? 0 : 1);
    });
    const ids = Object.keys(rated);
    expect(ids.filter((id) => rated[id] === 0)).toEqual(["0605"]);
    // …while the rest carry enough rated sessions for a curve of their own (needs 3).
    const shortSessions = ids
      .filter((id) => id !== "0605")
      .map((id) => {
        const sessions = demoState.workouts.filter((w) => {
          const en = w.entries.find((e) => e.id === id);
          // demo history is all rep sets; SetFields just satisfies avgRir's shape
          return en && avgRir(en.sets.filter((s) => s.done) as SetFields[]) != null;
        });
        return sessions.length < 3 ? id : null;
      });
    expect(shortSessions.filter((id): id is string => id !== null)).toEqual([]);
  });

  it("labels the aggregates in the scale the profile logs", () => {
    expect(effortOf(demoState)).toBe("rir");
    expect(displayScale(demoState)).toBe("rir");
    // The oldest block is written in RPE, as if imported — the stats have to average the mix.
    let rir = 0;
    let rpe = 0;
    eachSet((s) => {
      if (s.rir != null) rir++;
      else if (s.rpe != null) rpe++;
    });
    expect(rir).toBeGreaterThan(0);
    expect(rpe).toBeGreaterThan(0);
  });

  it("draws a weekly trend with a point for every week of the history", () => {
    const wks = effortWeeks(demoState, 0);
    expect(wks.length).toBeGreaterThanOrEqual(10);
    wks.forEach((w) => {
      expect(w.n).toBeGreaterThanOrEqual(2);
      expect(w.sets).toBeGreaterThanOrEqual(w.n);
    });
    // Sorted oldest first, one point per calendar week.
    expect(wks.map((w) => w.t)).toEqual(wks.map((w) => w.t).sort((a, b) => a - b));
    expect(new Set(wks.map((w) => w.t)).size).toBe(wks.length);
  });

  it("makes the deload visible as a genuinely easier week", () => {
    const wks = effortWeeks(demoState, 0);
    const easiest = wks.reduce((a, b) => (b.rir > a.rir ? b : a));
    const rest = wks.filter((w) => w !== easiest);
    const restAvg = rest.reduce((a, w) => a + w.rir, 0) / rest.length;
    expect(easiest.rir - restAvg).toBeGreaterThan(1); // a step, not noise
    // and the blocks around it grind toward failure rather than sitting flat
    const hardest = wks.reduce((a, b) => (b.rir < a.rir ? b : a));
    expect(easiest.rir - hardest.rir).toBeGreaterThan(1.5);
    expect(hardest.t).toBeGreaterThan(easiest.t); // the deepest week comes after it
  });

  it("spreads across the scale instead of piling onto one bucket", () => {
    const hist = effortHistogram(demoState, 0);
    expect(hist.reduce((n, b) => n + b.n, 0)).toBe(sum.rated);
    expect(hist.filter((b) => b.pct > 0.05).length).toBeGreaterThan(2);
    expect(Math.max(...hist.map((b) => b.pct))).toBeLessThan(0.6);
    // both ends occupied: sets taken to (or near) failure and sets left well short of it
    expect(hist[0].n + hist[1].n).toBeGreaterThan(0);
    expect(hist.at(-1)?.n).toBeGreaterThan(0);
  });

  it("has hard sets to filter the muscle map by", () => {
    let hard = 0;
    eachSet((s) => {
      if (isHardSet(s)) hard++;
    });
    expect(hard).toBe(sum.hard);
    expect(hard).toBeGreaterThan(50);
    const invalidHardSets: SetFields[] = [];
    eachSet((s) => {
      if (isHardSet(s) && (rirOf(s) ?? Infinity) > HARD_RIR) invalidHardSets.push(s);
    });
    expect(invalidHardSets).toEqual([]);
  });

  it("is deterministic — two builds produce the same ratings", () => {
    const b: DemoState = buildDemoState();
    const flat = (st: { workouts: Array<{ entries: Array<{ sets: SetFields[] }> }> }) =>
      st.workouts
        .map((w) =>
          w.entries
            .map((e) => e.sets.map((s) => `${s.w}x${s.r}/${s.rir ?? ""}/${s.rpe ?? ""}`).join(","))
            .join("|"),
        )
        .join(";");
    expect(flat(b)).toBe(flat(demoState));
  });
});
