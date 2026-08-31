// Which muscles an exercise trains, and how hard — the data behind every muscle map.
//
// The exercise dataset names muscles in free text and is not consistent about it:
// "shoulders", "deltoids" and "delts" are the same thing, so are "quads" and
// "quadriceps", "lats" and "latissimus dorsi", "core" and "abdominals". Nineteen
// primary and forty secondary spellings collapse onto the eighteen muscles the body
// map can actually draw, via ALIAS below. Anything genuinely undrawable (hands,
// ankles, "cardiovascular system") maps to null and is dropped rather than guessed at.
import { exerciseMetadata } from "@/domain/exercises/exercise-metadata";
import { isWarmup } from "@/domain/training/history";
import type { LoggedSet, MuscleSnapshot, WorkoutEntry } from "@/shared/lib/types";

// The muscles a map can shade, in head-to-toe order — also the order of any list
// built from them, so "what am I neglecting" reads top-down like a body.
export const MUSCLES = [
  "trapezius",
  "deltoids",
  "chest",
  "upper-back",
  "serratus",
  "biceps",
  "triceps",
  "forearm",
  "abs",
  "obliques",
  "lower-back",
  "gluteal",
  "quadriceps",
  "hamstring",
  "adductors",
  "hip-flexors",
  "calves",
  "tibialis",
] as const;

export type MuscleSlug = (typeof MUSCLES)[number];

// Drawn as the silhouette, never shaded: they carry no training load.
export const INERT = ["head", "hair", "neck", "hands", "feet", "knees", "ankles"];

// Every spelling that occurs in the dataset's `tg` and `sm` fields. null = not drawable.
const ALIAS: Record<string, MuscleSlug | null> = {
  // primaries
  abs: "abs",
  pectorals: "chest",
  biceps: "biceps",
  glutes: "gluteal",
  delts: "deltoids",
  triceps: "triceps",
  "upper back": "upper-back",
  lats: "upper-back",
  calves: "calves",
  quads: "quadriceps",
  forearms: "forearm",
  hamstrings: "hamstring",
  spine: "lower-back",
  traps: "trapezius",
  adductors: "adductors",
  "serratus anterior": "serratus",
  abductors: "gluteal",
  "levator scapulae": "trapezius",
  "cardiovascular system": null,
  // secondaries
  shoulders: "deltoids",
  deltoids: "deltoids",
  "rear deltoids": "deltoids",
  "rotator cuff": "deltoids",
  quadriceps: "quadriceps",
  core: "abs",
  abdominals: "abs",
  "lower abs": "abs",
  chest: "chest",
  "upper chest": "chest",
  "hip flexors": "hip-flexors",
  obliques: "obliques",
  "lower back": "lower-back",
  rhomboids: "upper-back",
  trapezius: "trapezius",
  back: "upper-back",
  "latissimus dorsi": "upper-back",
  brachialis: "biceps",
  soleus: "calves",
  shins: "tibialis",
  wrists: "forearm",
  "wrist flexors": "forearm",
  "wrist extensors": "forearm",
  "grip muscles": "forearm",
  groin: "adductors",
  "inner thighs": "adductors",
  ankles: null,
  feet: null,
  hands: null,
  "ankle stabilizers": null,
  sternocleidomastoid: null,
};

// Custom exercises carry only a body part, so they fall back to it. Weights inside a
// group sum to 1 — "upper legs" spreads over three muscles rather than counting triple.
const BY_BODYPART: Record<string, Partial<Record<MuscleSlug, number>>> = {
  chest: { chest: 1 },
  back: { "upper-back": 0.75, "lower-back": 0.25 },
  shoulders: { deltoids: 1 },
  "upper arms": { biceps: 0.5, triceps: 0.5 },
  "lower arms": { forearm: 1 },
  waist: { abs: 0.7, obliques: 0.3 },
  "upper legs": { quadriceps: 0.4, hamstring: 0.35, gluteal: 0.25 },
  "lower legs": { calves: 0.8, tibialis: 0.2 },
  neck: { trapezius: 1 },
  cardio: {},
};

const SECONDARY = 0.4; // a supporting muscle counts this much against a primary

/** Muscles one exercise trains: { slug: 0…1 }. */
export function musclesOf(
  ex:
    | {
        tg?: string;
        sm?: readonly string[];
        bp?: string;
        muscleWeights?: Partial<Record<string, number>>;
      }
    | null
    | undefined,
): Partial<Record<MuscleSlug, number>> {
  if (!ex) return {};
  if (ex.muscleWeights && typeof ex.muscleWeights === "object") {
    const snapshotLoad: Partial<Record<MuscleSlug, number>> = {};
    for (const slug of MUSCLES) {
      const weight = ex.muscleWeights[slug];
      if (typeof weight === "number" && Number.isFinite(weight) && weight > 0)
        snapshotLoad[slug] = weight;
    }
    if (Object.keys(snapshotLoad).length > 0) return snapshotLoad;
  }
  const muscleLoad: Partial<Record<MuscleSlug, number>> = {};
  const addMuscle = (name: unknown, weight: number): void => {
    const slug = ALIAS[(typeof name === "string" ? name : "").toLowerCase().trim()];
    if (slug) muscleLoad[slug] = Math.max(muscleLoad[slug] || 0, weight);
  };
  addMuscle(ex.tg, 1);
  (ex.sm || []).forEach((muscle) => addMuscle(muscle, SECONDARY));
  // Nothing recognised (custom exercises, or a target we don't draw) — use the body part.
  if (Object.keys(muscleLoad).length === 0)
    Object.assign(muscleLoad, BY_BODYPART[ex.bp || ""] || {});
  return muscleLoad;
}

/** Persist the small, canonical part of a custom exercise that history needs after deletion. */
export function exerciseMuscleSnapshot(
  ex: { n?: string; bp?: string; tg?: string; sm?: readonly string[] } | null | undefined,
): MuscleSnapshot {
  if (!ex) return {};
  const snapshot: MuscleSnapshot = {};
  if (ex.n) snapshot.n = ex.n;
  if (ex.bp) snapshot.bp = ex.bp;
  const weights = musclesOf(ex);
  if (Object.keys(weights).length > 0) snapshot.muscleWeights = { ...weights };
  return snapshot;
}

/**
 * Training load per muscle, in "effective sets".
 * `items` is [{ id, sets }] — sets being a count, so a 4×8 bench press weighs four
 * times a single set. Volume in kg is deliberately not used: 100 kg of leg press
 * against 12 kg of lateral raise says nothing about which muscle worked harder.
 */
export function loadOf(
  items: ReadonlyArray<{
    id: string;
    sets: number;
    exercise?: Parameters<typeof musclesOf>[0] | null;
    muscleSnapshot?: MuscleSnapshot | null;
  }>,
): Partial<Record<MuscleSlug, number>> {
  const load: Partial<Record<MuscleSlug, number>> = {};
  items.forEach((item) => {
    const { id, sets } = item;
    if (!sets) return;
    const snapshot = item.muscleSnapshot;
    const snapshotHasWeights =
      !!snapshot?.muscleWeights && Object.keys(snapshot.muscleWeights).length > 0;
    const source = snapshotHasWeights
      ? snapshot
      : item.exercise || exerciseMetadata(id) || snapshot;
    const exerciseLoad = musclesOf(source);
    for (const slug of MUSCLES) {
      const contribution = exerciseLoad[slug] || 0;
      if (contribution > 0) load[slug] = (load[slug] || 0) + contribution * sets;
    }
  });
  return load;
}

/**
 * Load for finished workouts (only sets actually ticked off count). `pick` narrows that
 * further — the map can then answer "where did the *hard* sets go", which is a different
 * question from where the sets went: a muscle can lead on volume and still never be trained
 * near failure.
 */
export const loadOfWorkouts = (
  workouts:
    | ReadonlyArray<{
        entries?: ReadonlyArray<Pick<WorkoutEntry, "id" | "sets" | "muscleSnapshot">>;
      }>
    | null
    | undefined,
  pick?: (s: LoggedSet) => boolean,
) =>
  loadOf(
    (workouts || []).flatMap((workout) =>
      (workout.entries || []).map((entry) => ({
        id: entry.id,
        muscleSnapshot: entry.muscleSnapshot,
        sets: (entry.sets || []).filter((set) => set.done && !isWarmup(set) && (!pick || pick(set)))
          .length,
      })),
    ),
  );

/** Load a routine *would* produce, from its planned set counts. */
export const loadOfRoutine = (
  routine: { ex?: ReadonlyArray<{ id: string; sets: number }> } | null | undefined,
) => loadOf((routine?.ex || []).map((c) => ({ id: c.id, sets: c.sets || 1 })));

/**
 * Shade buckets 0–4 per muscle, relative to the hardest-worked muscle in the same
 * window. Relative rather than absolute on purpose: the map answers "is my training
 * balanced", which only means anything as a comparison within one period.
 */
export function levelsOf(load: Partial<Record<MuscleSlug, number>>): Record<MuscleSlug, number> {
  const max = Math.max(0, ...MUSCLES.map((m) => load[m] || 0));
  const lv: Record<MuscleSlug, number> = {
    abs: 0,
    adductors: 0,
    biceps: 0,
    calves: 0,
    chest: 0,
    deltoids: 0,
    forearm: 0,
    gluteal: 0,
    hamstring: 0,
    "hip-flexors": 0,
    "lower-back": 0,
    obliques: 0,
    quadriceps: 0,
    serratus: 0,
    tibialis: 0,
    trapezius: 0,
    triceps: 0,
    "upper-back": 0,
  };
  MUSCLES.forEach((m) => {
    const v = load[m] || 0;
    lv[m] = v ? (max <= 0 ? 0 : Math.max(1, Math.min(4, Math.ceil((v / max) * 4)))) : 0;
  });
  return lv;
}

/** Muscles sorted hardest-worked first; untrained ones last, in body order. */
export function rankOf(load: Partial<Record<MuscleSlug, number>>): {
  worked: MuscleSlug[];
  missed: MuscleSlug[];
} {
  const worked = MUSCLES.filter((muscle) => (load[muscle] || 0) > 0).toSorted(
    (left, right) => (load[right] || 0) - (load[left] || 0),
  );
  const missed = MUSCLES.filter((muscle) => (load[muscle] || 0) <= 0);
  return { worked, missed };
}
