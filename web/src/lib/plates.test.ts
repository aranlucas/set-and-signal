import { describe, expect, it } from "vitest";
import {
  barWeightFor,
  COMMON_PLATES,
  defaultPlateSetup,
  effectivePlateSetup,
  platesFor,
} from "./plates";

describe("platesFor", () => {
  const kg = defaultPlateSetup("kg");
  const lb = defaultPlateSetup("lb");

  it("returns null when the target is at or below the bare bar", () => {
    expect(platesFor(20, kg)).toBeNull();
    expect(platesFor(10, kg)).toBeNull();
    expect(platesFor(45, lb)).toBeNull();
  });

  it("returns null when the calculator is off or unconfigured", () => {
    expect(platesFor(100, null)).toBeNull();
    expect(platesFor(100, { on: false, bar: 20, avail: [10] })).toBeNull();
  });

  it("solves an exact kg load", () => {
    // 100 kg total = 40 kg per side = 25 + 15
    expect(platesFor(100, kg)).toEqual({
      perSide: [
        { w: 25, count: 1 },
        { w: 15, count: 1 },
      ],
      achieved: 100,
      exact: true,
    });
  });

  it("takes multiple copies of a heavy plate before dropping down", () => {
    // 180 kg = 80/side = 25×3 + 5
    const result = platesFor(180, { ...kg, avail: [25, 5] });
    expect(result?.perSide).toEqual([
      { w: 25, count: 3 },
      { w: 5, count: 1 },
    ]);
    expect(result?.exact).toBe(true);
  });

  it("respects a finite inventory and reports the closest achievable weight", () => {
    // 62.5 kg needs 21.25/side; with only 10+2.5 you get 20/side → 60 kg
    const poor = { on: true, bar: 20, avail: [10, 2.5] };
    const result = platesFor(62.5, poor);
    expect(result?.achieved).toBe(60);
    expect(result?.exact).toBe(false);
  });

  it("handles fractional plates", () => {
    const result = platesFor(102.5, kg);
    expect(result?.exact).toBe(true);
    expect(result?.perSide.at(-1)).toEqual({ w: 1.25, count: 1 });
  });

  it("solves a common lb load", () => {
    // 225 lb = 90/side = 45×2
    expect(platesFor(225, lb)?.perSide).toEqual([{ w: 45, count: 2 }]);
  });

  it("ignores duplicates and non-positive entries in the inventory", () => {
    const messy = { on: true, bar: 20, avail: [10, 10, 0, -5, 5] };
    expect(platesFor(70, messy)?.perSide).toEqual([
      { w: 10, count: 2 },
      { w: 5, count: 1 },
    ]);
  });
});

describe("defaultPlateSetup", () => {
  it("matches the unit's defaults and is fresh per call", () => {
    expect(defaultPlateSetup("kg").bar).toBe(20);
    expect(defaultPlateSetup("lb").bar).toBe(45);
    const setup = defaultPlateSetup("kg");
    setup.avail.pop();
    expect(defaultPlateSetup("kg").avail).toHaveLength(COMMON_PLATES.kg.length);
  });

  it("uses unit defaults until the profile saves a setup", () => {
    expect(barWeightFor("kg", null)).toBe(20);
    expect(barWeightFor("lb", null)).toBe(45);
    expect(effectivePlateSetup("kg", null).on).toBe(true);
  });

  it("preserves a saved custom bar and explicit off state", () => {
    const custom = { on: false, bar: 15, avail: [5] };
    expect(barWeightFor("kg", custom)).toBe(15);
    expect(effectivePlateSetup("kg", custom)).toBe(custom);
  });
});
