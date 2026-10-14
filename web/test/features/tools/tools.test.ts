import { describe, expect, it } from "vitest";
import {
  clampToolNumber,
  formatTimer,
  normalizeRestSeconds,
  normalizeToolReps,
  normalizeToolWeight,
  trainingLoads,
} from "@/features/tools/tools";

describe("training tools helpers", () => {
  it("formats a countdown with a stable mm:ss display", () => {
    expect(formatTimer(0)).toBe("0:00");
    expect(formatTimer(95.8)).toBe("1:35");
    expect(formatTimer(-12)).toBe("0:00");
    expect(formatTimer(Number.NaN)).toBe("0:00");
  });

  it("rounds estimated max percentages to the profile's loadable step", () => {
    expect(trainingLoads(100, "kg")).toEqual([
      { pct: 65, weight: 65 },
      { pct: 75, weight: 75 },
      { pct: 80, weight: 80 },
      { pct: 85, weight: 85 },
      { pct: 90, weight: 90 },
    ]);
    expect(trainingLoads(181, "lb")[0]).toEqual({ pct: 65, weight: 120 });
  });

  it("rejects unusable estimated maxes instead of emitting NaN targets", () => {
    expect(trainingLoads(0, "kg")).toEqual([]);
    expect(trainingLoads(-100, "kg")).toEqual([]);
    expect(trainingLoads(Number.NaN, "kg")).toEqual([]);
  });

  it("keeps editable tool values inside meaningful bounds", () => {
    expect(clampToolNumber("", 1, 100, 1)).toBe(1);
    expect(clampToolNumber(Number.NaN, 1, 100, 500)).toBe(100);
    expect(clampToolNumber(-5, 0, 100)).toBe(0);
    expect(clampToolNumber(200, 0, 100)).toBe(100);
    expect(normalizeToolWeight(-25)).toBe(0);
    expect(normalizeToolWeight(Number.POSITIVE_INFINITY)).toBe(0);
    expect(normalizeToolReps(2.6)).toBe(3);
    expect(normalizeToolReps(99)).toBe(12);
    expect(normalizeRestSeconds(0)).toBe(1);
    expect(normalizeRestSeconds(99_999)).toBe(3_600);
  });
});
