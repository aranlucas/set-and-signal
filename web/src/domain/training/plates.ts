// Plate calculator — how to load a bar to hit a target weight (Hevy/JEFIT-style).
//
// Pure math over one side's inventory: per-side load = (target − bar) / 2, filled
// greedily heaviest-plate-first. Real gyms run finite inventories, so the target is
// often unreachable; instead of failing, the result reports the closest achievable
// weight and whether it matched exactly, and the UI says "≈" when it did not.
import type { PlateSetup, Unit } from "@/shared/lib/types";

export const DEFAULT_PLATES: Record<Unit, { bar: number; avail: number[] }> = {
  kg: { bar: 20, avail: [25, 20, 15, 10, 5, 2.5, 1.25] },
  lb: { bar: 45, avail: [45, 35, 25, 10, 5, 2.5] },
};

export const COMMON_PLATES: Record<Unit, number[]> = {
  kg: [25, 20, 15, 10, 5, 2.5, 1.25],
  lb: [100, 45, 35, 25, 10, 5, 2.5],
};

export function defaultPlateSetup(unit: Unit): PlateSetup {
  return { on: true, ...DEFAULT_PLATES[unit], avail: [...DEFAULT_PLATES[unit].avail] };
}

// A profile that has never touched the calculator gets the unit defaults. Once a profile
// explicitly turns it off, its saved setup wins and stays off.
export function effectivePlateSetup(unit: Unit, setup: PlateSetup | null | undefined): PlateSetup {
  return setup ?? defaultPlateSetup(unit);
}

export function barWeightFor(unit: Unit, setup: PlateSetup | null | undefined): number {
  return effectivePlateSetup(unit, setup).bar;
}

export interface PlateBreakdown {
  perSide: Array<{ w: number; count: number }>; // heaviest first
  achieved: number; // total weight the arrangement actually loads
  exact: boolean; // achieved === requested (within rounding)
}

/**
 * Work out the plates for `weight` (total, both sides included). Returns null when there
 * is nothing to compute — target at or below the bare bar, or no plates configured.
 */
export function platesFor(
  weight: number,
  setup: PlateSetup | null | undefined,
): PlateBreakdown | null {
  if (!setup || !setup.on) return null;
  const perSideTarget = (weight - setup.bar) / 2;
  if (!(perSideTarget > 0)) return null;
  const sorted = [...new Set(setup.avail)].filter((w) => w > 0).sort((a, b) => b - a);
  if (sorted.length === 0) return null;

  let remaining = perSideTarget;
  const perSide: Array<{ w: number; count: number }> = [];
  for (const plate of sorted) {
    const count = Math.floor(remaining / plate + 1e-9);
    if (count > 0) {
      perSide.push({ w: plate, count });
      remaining -= count * plate;
    }
    if (remaining <= 1e-9) break;
  }
  const used = perSide.reduce((sum, p) => sum + p.w * p.count, 0);
  const achieved = Math.round((setup.bar + used * 2) * 100) / 100;
  return { perSide, achieved, exact: Math.abs(achieved - weight) < 0.01 };
}
