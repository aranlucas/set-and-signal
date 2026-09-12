import type { Unit } from "@/shared/lib/types";
import { REP_CAP } from "@/domain/training/onerm";

export const TRAINING_LOAD_PCTS = [65, 75, 80, 85, 90] as const;
export const MAX_TOOL_WEIGHT = 10_000;
export const MAX_REST_SECONDS = 3_600;

/** Keep values coming from an editable field safe for the pure calculators. */
export function clampToolNumber(value: unknown, min: number, max: number, fallback = min): number {
  const safeFallback = Number.isFinite(fallback) ? Math.min(max, Math.max(min, fallback)) : min;
  const parsed = typeof value === "string" && value.trim() === "" ? fallback : Number(value);
  if (!Number.isFinite(parsed)) return safeFallback;
  return Math.min(max, Math.max(min, parsed));
}

export function normalizeToolWeight(value: unknown): number {
  return clampToolNumber(value, 0, MAX_TOOL_WEIGHT);
}

export function normalizeToolReps(value: unknown): number {
  return Math.round(clampToolNumber(value, 1, REP_CAP));
}

export function normalizeRestSeconds(value: unknown): number {
  return Math.round(clampToolNumber(value, 1, MAX_REST_SECONDS));
}

export function formatTimer(seconds: number): string {
  const safeSeconds = Math.max(0, Math.floor(Number.isFinite(seconds) ? seconds : 0));
  return `${Math.floor(safeSeconds / 60)}:${String(safeSeconds % 60).padStart(2, "0")}`;
}

/**
 * Turn an estimated max into useful, loadable working targets. The increments match
 * warmupRound so the suggestions can be used at the rack without mental math.
 */
export function trainingLoads(oneRepMax: number, unit: Unit) {
  if (!Number.isFinite(oneRepMax) || oneRepMax <= 0) return [];
  const step = unit === "lb" ? 5 : 2.5;
  return TRAINING_LOAD_PCTS.map((pct) => ({
    pct,
    weight: Math.round((oneRepMax * (pct / 100)) / step) * step,
  }));
}
