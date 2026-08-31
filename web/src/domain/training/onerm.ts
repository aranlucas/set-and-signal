// Estimated one-rep max (issue #18).
//
// Deliberately knows nothing about the exercise database: an estimate needs a weight AND a
// rep count, and only reps-mode sets carry both. Cardio sets ({min, speed}) and timed sets
// ({sec, w}) therefore drop out of every scan here on their own — there is no exercise-type
// check to keep in sync.
//
// Formulas are the usual submaximal-load estimators. Epley is the default because it is the
// one most lifters have seen; all of them agree closely at low reps and diverge as reps rise,
// which is exactly why REP_CAP exists.
import type { Workout } from "@/shared/lib/types";

// Above this many reps an estimate says more about work capacity than about maximal strength,
// and the formulas disagree by double digits. Refusing to guess beats printing a fantasy.
export const REP_CAP = 12;

type FormulaFn = (w: number, r: number) => number;

export const FORMULAS: Record<"epley" | "brzycki" | "lombardi", FormulaFn> = {
  // Epley 1985 — w · (1 + r/30)
  epley: (w, r) => w * (1 + r / 30),
  // Brzycki 1993 — w · 36/(37 − r); undefined at r ≥ 37, but REP_CAP is far below that
  brzycki: (w, r) => (w * 36) / (37 - r),
  // Lombardi 1989 — w · r^0.10
  lombardi: (w, r) => w * Math.pow(r, 0.1),
};
export const DEFAULT_FORMULA = "epley";

const isFormulaName = (value: string): value is keyof typeof FORMULAS => value in FORMULAS;

// Estimate a 1RM from one set. Returns null for anything it cannot honestly answer:
// missing/zero/negative load, no reps, non-finite input, or more reps than REP_CAP.
// A single rep is not an estimate — it is the measurement — and comes back unchanged.
export function estimate1RM(
  w: unknown,
  r?: unknown,
  formula: string = DEFAULT_FORMULA,
): number | null {
  const weight = Number(w);
  const reps = Number(r);
  if (!isFinite(weight) || !isFinite(reps)) return null;
  if (weight <= 0 || reps < 1) return null;
  if (reps > REP_CAP) return null;
  const fn = isFormulaName(formula) ? FORMULAS[formula] : FORMULAS[DEFAULT_FORMULA];
  const est = reps === 1 ? weight : fn(weight, Math.round(reps));
  if (!isFinite(est) || est <= 0) return null;
  return Math.round(est * 10) / 10;
}

// A set as bestSetOf reads it: only done/w/r matter; cardio ({min,speed}) and timed
// ({sec,w}) sets simply carry no `r` and drop out on their own. `wu` marks warm-ups.
interface ScorableSet {
  done?: boolean;
  w?: unknown;
  r?: unknown;
  wu?: boolean;
}
type ScorableEntry = { sets?: readonly ScorableSet[] } | null | undefined;

// Best estimate out of one workout entry's completed sets.
// `topW` is ignored on purpose: it records the working weight a user confirmed after the
// exercise, with no rep count attached, so it cannot produce an estimate. Warm-up sets
// are skipped too — a ramp set is not a strength display.
export function bestSetOf(
  entry: ScorableEntry,
  formula: string = DEFAULT_FORMULA,
): { est: number; w: number; r: number } | null {
  let best: { est: number; w: number; r: number } | null = null;
  (entry?.sets || []).forEach((s) => {
    if (!s.done) return;
    if (s.wu) return;
    const est = estimate1RM(s.w, s.r, formula);
    if (est !== null && (!best || est > best.est))
      best = { est, w: Number(s.w), r: Math.round(Number(s.r)) };
  });
  return best;
}

// One point per workout in which the exercise produced an estimate — feeds the trend chart.
// Chronological, matching the order workouts are appended in.
export interface E1rmPoint {
  t: number;
  d: string;
  y: number;
  w: number;
  r: number;
}
type WorkoutStub = Pick<Workout, "d" | "start" | "entries">;

export function e1rmSeries(
  state: { workouts?: WorkoutStub[] },
  exId: string,
  formula: string = DEFAULT_FORMULA,
): E1rmPoint[] {
  const pts: E1rmPoint[] = [];
  (state.workouts || []).forEach((w) => {
    const entry = w.entries.find((e) => e.id === exId);
    if (!entry) return;
    const best = bestSetOf(entry, formula);
    if (best) pts.push({ t: w.start, d: w.d, y: best.est, w: best.w, r: best.r });
  });
  return pts;
}

// All-time best estimate for an exercise, with the set and date it came from — the source
// matters, because "142.5 kg est. from 100×10" is a very different claim from "from 140×1".
export function best1RM(
  state: { workouts?: WorkoutStub[] },
  exId: string,
  formula: string = DEFAULT_FORMULA,
): { est: number; w: number; r: number; d: string; t: number } | null {
  let best: { est: number; w: number; r: number; d: string; t: number } | null = null;
  e1rmSeries(state, exId, formula).forEach((p) => {
    if (!best || p.y > best.est) best = { est: p.y, w: p.w, r: p.r, d: p.d, t: p.t };
  });
  return best;
}

// Did this workout beat every estimate that came before it? Used for the finish summary,
// so it compares against history that does not yet contain `w`.
export function is1RMRecord(
  state: { workouts?: WorkoutStub[] },
  exId: string,
  entry: ScorableEntry,
  formula: string = DEFAULT_FORMULA,
): { est: number; w: number; r: number; prev: number } | null {
  const now = bestSetOf(entry, formula);
  if (!now) return null;
  const prev = best1RM(state, exId, formula);
  return !prev || now.est > prev.est ? { ...now, prev: prev ? prev.est : 0 } : null;
}
