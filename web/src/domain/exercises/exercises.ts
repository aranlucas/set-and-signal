import { EXDB } from "@/generated/exercises-data.js";
import {
  EXIDX,
  registerCustom,
  registerExerciseCatalog,
} from "@/domain/exercises/exercise-registry.js";
import { translate } from "@/i18n/translate.js";
import type { CatalogExercise, CustomEx, Exercise } from "@/shared/lib/types.js";

const SEARCH_MARKS_RE = /\p{Mark}+/gu;
const SEARCH_SEPARATORS_RE = /[^\p{Letter}\p{Number}]+/gu;
const SEARCH_WHITESPACE_RE = /\s+/gu;

type SearchableExercise = {
  n: string;
  bp?: string;
  eq?: string;
  tg?: string;
  mg?: string;
  sm?: readonly string[];
  desc?: string;
};

export type ExerciseSearchFilters = {
  bodyPart?: string;
  equipment?: string;
};

registerExerciseCatalog(EXDB);

export { EXDB, EXIDX, registerCustom };
export const BODYPARTS: string[] = [...new Set(EXDB.map((e) => e.bp))].sort();

// Equipment options present in a given list of exercises, most common first (issue #6).
// Deriving them from the *already filtered* list keeps the chip row short and means
// every body-part × equipment combination on screen has results behind it.
export function equipmentOf(list: ReadonlyArray<{ eq?: string }>): string[] {
  const equipmentCounts: Record<string, number> = {};
  list.forEach((exercise) => {
    if (exercise.eq) equipmentCounts[exercise.eq] = (equipmentCounts[exercise.eq] || 0) + 1;
  });
  return Object.keys(equipmentCounts).sort(
    (left, right) => equipmentCounts[right] - equipmentCounts[left] || (left < right ? -1 : 1),
  );
}

// Full searchable catalogue — customs first so your own exercises are easy to find.
export const allExercises = (appState: { customEx?: CustomEx[] }): Array<CustomEx | Exercise> => [
  ...(appState.customEx || []),
  ...EXDB,
];

export function normalizeSearchText(value: string): string {
  return value
    .toLocaleLowerCase()
    .normalize("NFD")
    .replace(SEARCH_MARKS_RE, "")
    .replaceAll("&", " and ")
    .replace(SEARCH_SEPARATORS_RE, " ")
    .trim()
    .replace(SEARCH_WHITESPACE_RE, " ");
}

export function searchExercises<T extends SearchableExercise>(
  exercises: readonly T[],
  query = "",
  filters: ExerciseSearchFilters = {},
): T[] {
  const normalizedQuery = normalizeSearchText(query);
  const tokens = normalizedQuery.split(" ").filter(Boolean);

  return exercises
    .flatMap((exercise, index) => {
      if (filters.bodyPart && exercise.bp !== filters.bodyPart) return [];
      if (filters.equipment && exercise.eq !== filters.equipment) return [];
      if (tokens.length === 0) return [{ exercise, index, score: 0 }];

      const normalizedName = normalizeSearchText(exercise.n);
      const searchableText = normalizeSearchText(
        [
          exercise.n,
          exercise.bp,
          exercise.eq,
          exercise.tg,
          exercise.mg,
          ...(exercise.sm || []),
          exercise.desc,
        ]
          .filter((value): value is string => typeof value === "string" && value.length > 0)
          .join(" "),
      );
      if (!tokens.every((token) => searchableText.includes(token))) return [];

      const score =
        normalizedName === normalizedQuery
          ? 0
          : normalizedName.includes(normalizedQuery)
            ? 1
            : tokens.every((token) => normalizedName.includes(token))
              ? 2
              : 3;
      return [{ exercise, index, score }];
    })
    .sort((left, right) => left.score - right.score || left.index - right.index)
    .map(({ exercise }) => exercise);
}

// Exercise media stays outside the public source snapshot because the upstream visual assets
// have separate attribution/redistribution terms. The default is a pinned, cacheable CDN copy;
// deployments can override both bases at build time with an approved media host.
const MEDIA_COMMIT = "7455efae41b330c265e7cd4b78dfa848e7ce5ebd";
const MEDIA_CDN = `https://cdn.jsdelivr.net/gh/hasaneyldrm/exercises-dataset@${MEDIA_COMMIT}`;
const IMG_BASE =
  typeof import.meta.env.VITE_IMG_BASE === "string"
    ? import.meta.env.VITE_IMG_BASE
    : `${MEDIA_CDN}/images/`;
const GIF_BASE =
  typeof import.meta.env.VITE_GIF_BASE === "string"
    ? import.meta.env.VITE_GIF_BASE
    : `${MEDIA_CDN}/videos/`;
export const imgSrc = (ex: Exercise) => IMG_BASE + ex.img;
export const gifSrc = (ex: Exercise) => GIF_BASE + ex.gif;

// Cardio exercises log time + speed instead of weight × reps.
export const isCardio = (idOrEx: string | { bp?: string } | null | undefined) =>
  (typeof idOrEx === "string" ? EXIDX[idOrEx] : idOrEx)?.bp === "cardio";

// Exercises the dataset already knows carry no external load (issue #32) — a quarter of the
// catalogue. This seeds the `bw` flag on a fresh config so a push-up never asks for a weight
// nobody was going to enter. It is only the default: the flag lives on the config, so a dip
// done with a belt can turn it off and a custom exercise can turn it on.
export const isBodyweightEq = (idOrEx: string | { eq?: string } | null | undefined) =>
  (typeof idOrEx === "string" ? EXIDX[idOrEx] : idOrEx)?.eq === "body weight";

const BARBELL_EQUIPMENT = new Set(["barbell", "olympic barbell", "ez barbell", "trap bar"]);

export const isBarbellEq = (idOrEx: string | { eq?: string } | null | undefined) => {
  const equipment = (typeof idOrEx === "string" ? EXIDX[idOrEx] : idOrEx)?.eq;
  return !!equipment && BARBELL_EQUIPMENT.has(equipment);
};

// An id that resolves to nothing — a plan file built against a different exercise dataset,
// a custom exercise deleted on another device before the sync arrived — still has to
// render. A placeholder keeps it visible (and removable) instead of taking the whole view
// down on the first `ex.n`.
export const exOr = (id: string): CatalogExercise => {
  const found = EXIDX[id];
  if (found && "img" in found) return found;
  if (found)
    return {
      id: found.id,
      n: found.n,
      bp: found.bp,
      eq: found.eq || "custom",
      tg: found.tg || found.bp,
      mg: "",
      sm: [],
      st: [],
      img: "",
      gif: "",
    };
  return {
    id,
    n: translate("sharing.unknownExercise", "Unknown exercise"),
    bp: "",
    tg: "",
    eq: "",
    mg: "",
    sm: [],
    st: [],
    img: "",
    gif: "",
    missing: true,
  };
};
