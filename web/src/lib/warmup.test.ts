import { describe, expect, it } from "vitest";
import { warmupSets } from "./warmup";

describe("warmupSets", () => {
  it("builds the standard 40/60/80 ramp for a heavy kg lift", () => {
    // 100 kg → 40×8, 60×5, 80×3
    expect(warmupSets(100, "kg")).toEqual([
      { w: 40, r: 8, done: false, wu: true },
      { w: 60, r: 5, done: false, wu: true },
      { w: 80, r: 3, done: false, wu: true },
    ]);
  });

  it("snaps to the unit's increment (5 lb)", () => {
    // 135 lb → 55×8 (54 rounds to 55), 80×5 (81→80), 110×3 (108→110)
    const sets = warmupSets(135, "lb");
    expect(sets.map((s) => s.w)).toEqual([55, 80, 110]);
  });

  it("returns nothing for weights too light to warm up", () => {
    expect(warmupSets(0, "kg")).toEqual([]);
    expect(warmupSets(5, "kg")).toEqual([]);
    expect(warmupSets(-10, "lb")).toEqual([]);
  });

  it("keeps a single sensible step for small-but-real lifts", () => {
    expect(warmupSets(7.5, "kg").map((s) => s.w)).toEqual([5]);
  });

  it("collapses plateaued steps instead of repeating one weight", () => {
    // 6.25 kg at 2.5 rounding: 2.5 is under the floor and 80% rounds onto 5 again
    expect(warmupSets(6.25, "kg").map((s) => s.w)).toEqual([5]);
    // Every surviving set of any ramp is distinct
    for (const top of [12.5, 47.5, 100]) {
      const sets = warmupSets(top, "kg");
      expect(new Set(sets.map((s) => s.w)).size).toBe(sets.length);
    }
  });

  it("never suggests warming up at or above the working weight", () => {
    for (const unit of ["kg", "lb"] as const) {
      for (const top of [7.5, 20, 47.5, 135, 225]) {
        for (const set of warmupSets(top, unit)) {
          expect(set.w).toBeLessThan(top);
          expect(set.wu).toBe(true);
          expect(set.done).toBe(false);
        }
      }
    }
  });
});
