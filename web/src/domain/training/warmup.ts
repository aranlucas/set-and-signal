// Warm-up set generator (Hevy-Pro-style ramp builder).
//
// A working weight becomes a short percentage ramp: 40% × 8, 60% × 5, 80% × 3,
// each snapped to a loadable increment so the numbers stay plate-friendly. Sets that
// collapse onto a previous step, land under two increments, or reach the working weight
// itself are dropped — a "warm-up" equal to your top set is just another working set,
// and a 2.5 kg warm-up for a 5 kg lift is theatre, not preparation.
import type { RepsSet, Unit } from "@/shared/lib/types";

export const WARMUP_RAMP: Array<{ pct: number; reps: number }> = [
  { pct: 0.4, reps: 8 },
  { pct: 0.6, reps: 5 },
  { pct: 0.8, reps: 3 },
];

// Loadable step the ramp snaps to — the smallest common plate pair.
export const warmupRound = (unit: Unit): number => (unit === "lb" ? 5 : 2.5);

/**
 * Build warm-up sets for `topWeight` (the heaviest working set). Every set carries the
 * warm-up flag so volume/PR/progression reads skip it; callers splice these in front of
 * the working sets. Returns [] when the working weight is too light to warrant one.
 */
export function warmupSets(topWeight: number, unit: Unit): RepsSet[] {
  if (!(topWeight > 0)) return [];
  const step = warmupRound(unit);
  const floor = Math.min(step * 2, topWeight);
  const sets: RepsSet[] = [];
  for (const { pct, reps } of WARMUP_RAMP) {
    const w = Math.round((topWeight * pct) / step) * step;
    if (w < floor || w >= topWeight) continue;
    if (sets.length > 0 && sets.at(-1)!.w === w) continue; // ramp plateaued at this weight
    sets.push({ w, r: reps, done: false, wu: true });
  }
  return sets;
}
