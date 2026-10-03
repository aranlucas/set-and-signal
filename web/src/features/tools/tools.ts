import * as validation from "valibot";
import type { Unit } from "@/shared/lib/types";
import { REP_CAP } from "@/domain/training/onerm";

export const TRAINING_LOAD_PCTS = [65, 75, 80, 85, 90] as const;

export const MAX_TOOL_WEIGHT = 10_000;

export const MAX_REST_SECONDS = 3_600;

/** Keep values coming from an editable field safe for the pure calculators. */
// eslint-disable-next-line anti-slop/no-unknown-parameters -- Editable-field boundary preserves arbitrary input and validates the coerced number before bounded clamping.
export function clampToolNumber(value: unknown, min: number, max: number, fallback = min): number {
  const safeFallback = Number.isFinite(fallback) ? Math.min(max, Math.max(min, fallback)) : min;

  const parsed =
    validation.is(validation.string(), value) && value.trim() === "" ? fallback : Number(value);

  if (!Number.isFinite(parsed)) return safeFallback;

  return Math.min(max, Math.max(min, parsed));
}

const boundedToolNumber = (min: number, max: number) =>
  validation.pipe(
    validation.unknown(),
    validation.transform((value) => clampToolNumber(value, min, max)),
  );

export const normalizeToolWeight = validation.parser(boundedToolNumber(0, MAX_TOOL_WEIGHT));

export const normalizeToolReps = validation.parser(
  validation.pipe(boundedToolNumber(1, REP_CAP), validation.transform(Math.round)),
);

export const normalizeRestSeconds = validation.parser(
  validation.pipe(boundedToolNumber(1, MAX_REST_SECONDS), validation.transform(Math.round)),
);

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
