// Build, validate, and merge the small JSON file used to share a weekly plan.
// It contains only routines, their schedule, and referenced custom exercises; workouts,
// weigh-ins, settings, and other personal data never travel with it.

import { EXIDX, isBodyweightEq } from "@/domain/exercises/exercises.js";
import { modeOf } from "@/domain/training/history.js";
import { uid, todayISO } from "@/shared/lib/format.js";
import { translate } from "@/i18n/translate.js";
import { parsePayload, planBundle } from "@/shared/lib/schemas.js";
import type {
  AppState,
  ExConfig,
  Id,
  PlanBundle,
  PlanBundleCustom,
  PlanBundleRoutine,
  Weekday,
} from "@/shared/lib/types.js";

const PLAN_FMT = 1;
const WEEK_ORDER: Weekday[] = [1, 2, 3, 4, 5, 6, 0]; // Mon-first, matching the Plan screen
const WEEKDAY_BY_KEY: Readonly<Record<string, Weekday>> = {
  "0": 0,
  "1": 1,
  "2": 2,
  "3": 3,
  "4": 4,
  "5": 5,
  "6": 6,
};

/** What parsePlan hands back: a validated bundle plus the counts the confirm screen shows. */
export interface ParsedPlan {
  name: string;
  routines: PlanBundleRoutine[];
  week: Partial<Record<string, Id>>;
  customEx: PlanBundleCustom[];
  dropped: number;
  routineCount: number;
  exerciseCount: number;
  scheduledDays: number;
}

// Keep only the meaningful config fields, so the file stays small and readable.
function cleanEx(exercise: ExConfig): ExConfig {
  const cleanedConfig: ExConfig = { id: exercise.id, sets: exercise.sets };
  const mode = modeOf(exercise);
  if (mode === "cardio") {
    if (exercise.min != null) cleanedConfig.min = exercise.min;
    if (exercise.speed != null) cleanedConfig.speed = exercise.speed;
  } else if (mode === "time") {
    // Written out even though 'reps' is the fallback for a non-cardio id: a plan file that
    // dropped the mode would turn a 45-second plank into a 45-rep one at the other end.
    cleanedConfig.mode = "time";
    if (exercise.sec != null) cleanedConfig.sec = exercise.sec;
    if (exercise.weight) cleanedConfig.weight = exercise.weight;
  } else {
    if (exercise.reps != null) cleanedConfig.reps = exercise.reps;
    if (exercise.weight) cleanedConfig.weight = exercise.weight;
  }
  // How the exercise is logged travels too (issues #31/#32) — the bodyweight flag only when
  // it disagrees with the catalogue, since agreeing is what the other end already assumes.
  if (exercise.bodyweight != null && exercise.bodyweight !== isBodyweightEq(exercise.id))
    cleanedConfig.bodyweight = exercise.bodyweight;
  // Only on reps work — `side` counts reps, and a timed hold has none to split.
  if (exercise.side && mode !== "time" && mode !== "cardio") cleanedConfig.side = true;
  // Progression settings travel with the plan — a shared Greyskull routine that arrives
  // without its rule is just a list of weights.
  if (exercise.prog) cleanedConfig.prog = exercise.prog;
  if (exercise.inc != null && exercise.inc > 0) cleanedConfig.inc = exercise.inc;
  if (exercise.repsMin != null) cleanedConfig.repsMin = exercise.repsMin;
  if (exercise.repsMax != null) cleanedConfig.repsMax = exercise.repsMax;
  if (exercise.sg) cleanedConfig.sg = exercise.sg;
  return cleanedConfig;
}

/** Build the shareable bundle: every routine, the week schedule, referenced customs. */
export function buildPlanBundle(
  appState: Pick<AppState, "routines" | "customEx" | "week">,
  name?: string | null,
): PlanBundle {
  const routines: PlanBundleRoutine[] = (appState.routines || []).map((routine) =>
    Object.assign(
      {
        id: routine.id,
        name: routine.name,
        emoji: routine.emoji,
        ex: (routine.ex || []).map(cleanEx),
      },
      routine.prog ? { prog: routine.prog } : {},
    ),
  );
  const usedIds = new Set(routines.flatMap((r) => r.ex.map((e) => e.id)));
  const customEx: PlanBundleCustom[] = (appState.customEx || []).flatMap((c) =>
    usedIds.has(c.id)
      ? [Object.assign({ id: c.id, n: c.n, bp: c.bp }, c.desc ? { desc: c.desc } : {})]
      : [],
  );
  const week: Partial<Record<string, Id>> = {};
  WEEK_ORDER.forEach((d) => {
    if (appState.week?.[d]) week[d] = appState.week[d];
  });
  return {
    opengym_plan: PLAN_FMT,
    exported: todayISO(),
    name: name || "",
    week,
    routines,
    customEx,
  };
}

/**
 * Validate + normalise an imported file. Throws with a friendly message if it isn't one.
 *
 * Every exercise id has to resolve — either to the built-in library or to a custom
 * exercise carried in the same file. An id that resolves to neither (a hand-edited file,
 * an export from a build with a different exercise dataset) is dropped here: kept, it
 * would sit invisibly in the routine and only surface as a blank screen when the routine
 * is trained.
 */
export function parsePlan(raw: string | PlanBundle): ParsedPlan {
  let planData: PlanBundle;
  try {
    planData = parsePayload(planBundle, typeof raw === "string" ? JSON.parse(raw) : raw);
  } catch {
    throw new Error(translate("sharing.invalidPlanFile", "this isn’t a Set & Signal plan file"));
  }
  const customEx = planData.customEx;
  const known = new Set(customEx.map((c) => c.id));
  let dropped = 0;
  const routines = planData.routines.flatMap((r) =>
    r && Array.isArray(r.ex)
      ? [
          Object.assign(r, {
            ex: r.ex.filter((e) => {
              const ok = !!e && (known.has(e.id) || !!EXIDX[e.id]);
              if (!ok) dropped++;
              return ok;
            }),
          }),
        ]
      : [],
  );
  return {
    name: (planData.name || "").trim(),
    routines,
    week: planData.week || {},
    customEx,
    dropped,
    routineCount: routines.length,
    exerciseCount: routines.reduce((n, r) => n + r.ex.length, 0),
    scheduledDays: WEEK_ORDER.filter((weekday) => planData.week?.[weekday]).length,
  };
}

/**
 * Merge a parsed bundle into a draft state `s` (call inside store.update).
 *  - customs: reuse one you already have with the same name + body part, else add it fresh
 *  - routines: always added as NEW routines (fresh ids) — never overwrites yours
 *  - schedule: optional; when on, the shared week REPLACES yours (days the shared plan
 *    leaves empty become rest days — a half-overwritten week would silently mix two plans)
 */
export function mergePlan(
  appStateDraft: Pick<AppState, "customEx" | "routines" | "week">,
  bundle: Pick<PlanBundle, "customEx" | "routines" | "week">,
  { schedule }: { schedule?: boolean } = {},
): { routines: number } {
  appStateDraft.customEx = appStateDraft.customEx || [];
  const exerciseIdMap: Record<string, Id> = {};
  bundle.customEx.forEach((c) => {
    const existingExercise = appStateDraft.customEx.find(
      (x) => (x.n || "").toLowerCase() === (c.n || "").toLowerCase() && x.bp === c.bp,
    );
    if (existingExercise) {
      exerciseIdMap[c.id] = existingExercise.id;
      return;
    }
    const newExerciseId = uid();
    exerciseIdMap[c.id] = newExerciseId;
    appStateDraft.customEx.push({
      id: newExerciseId,
      n: c.n,
      bp: c.bp,
      ...(c.desc ? { desc: c.desc } : {}),
    });
  });
  const routineIdMap: Record<Id, Id> = {};
  bundle.routines.forEach((routine) => {
    const newRoutineId = uid();
    routineIdMap[routine.id] = newRoutineId;
    appStateDraft.routines.push({
      id: newRoutineId,
      name: routine.name || translate("sharing.sharedRoutine", "Shared routine"),
      // A bundle routine may carry no emoji; Routine types it required, but an absent glyph
      // is exactly what the original stored and every consumer renders nothing for it.
      emoji: routine.emoji || "",
      ...(routine.prog ? { prog: routine.prog } : {}),
      ex: (routine.ex || []).map((exercise) =>
        Object.assign(exercise, {
          id: exerciseIdMap[exercise.id] || exercise.id,
        }),
      ),
    });
  });
  if (schedule) {
    WEEK_ORDER.forEach((d) => {
      delete appStateDraft.week[d];
    });
    Object.entries(bundle.week || {}).forEach(([d, oldId]) => {
      // bundle weeks are plain JSON keyed by weekday digits
      const weekday = WEEKDAY_BY_KEY[d];
      if (weekday !== undefined && oldId && routineIdMap[oldId]) {
        appStateDraft.week[weekday] = routineIdMap[oldId];
      }
    });
  }
  return { routines: bundle.routines.length };
}
