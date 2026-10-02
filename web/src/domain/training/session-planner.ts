import { modeOf } from "@/domain/training/history";
import { isBodyweightEq } from "@/domain/exercises/exercise-metadata";
import type { AppState, ExConfig, Routine, SessionPlan } from "@/shared/lib/types";

export const SESSION_EQUIPMENT = [
  "dumbbell",
  "band",
  "band anchor",
  "barbell",
  "bench",
  "squat rack",
  "pull-up bar",
  "dip bars",
  "cable",
  "chest press machine",
  "shoulder press machine",
  "row machine",
  "lat pulldown machine",
  "leg extension machine",
  "lying leg curl machine",
  "seated leg curl machine",
  "added weight",
  "leg press machine",
  "calf raise machine",
  "treadmill",
  "stationary bike",
  "elliptical machine",
  "outdoor route",
] as const;

type Movement =
  | "squat"
  | "hinge"
  | "chestPress"
  | "overheadPress"
  | "row"
  | "pulldown"
  | "curl"
  | "triceps"
  | "lateralRaise"
  | "kneeExtension"
  | "kneeFlexion"
  | "calves"
  | "core"
  | "legRaise"
  | "cardio";
export interface SessionMovement {
  id: string;
  movement: Movement;
  needs: readonly string[];
}

// Reviewed alternatives only. The catalogue's broad equipment tags miss benches,
// racks and bars, and a shared muscle does not imply a comparable movement.
// Order is deterministic; retaining an available original always takes priority.
export const SESSION_MOVEMENTS: readonly SessionMovement[] = [
  { id: "0043", movement: "squat", needs: ["barbell", "squat rack"] },
  { id: "1760", movement: "squat", needs: ["dumbbell"] },
  { id: "1004", movement: "squat", needs: ["band"] },
  { id: "1685", movement: "squat", needs: [] },
  { id: "0739", movement: "squat", needs: ["leg press machine"] },
  { id: "0085", movement: "hinge", needs: ["barbell"] },
  { id: "1023", movement: "hinge", needs: ["band"] },
  { id: "0032", movement: "hinge", needs: ["barbell"] },
  { id: "1459", movement: "hinge", needs: ["dumbbell"] },
  { id: "0025", movement: "chestPress", needs: ["barbell", "bench", "squat rack"] },
  { id: "0047", movement: "chestPress", needs: ["barbell", "bench", "squat rack"] },
  { id: "0577", movement: "chestPress", needs: ["chest press machine"] },
  { id: "0289", movement: "chestPress", needs: ["dumbbell", "bench"] },
  { id: "0662", movement: "chestPress", needs: [] },
  { id: "0251", movement: "chestPress", needs: ["dip bars"] },
  { id: "0426", movement: "overheadPress", needs: ["dumbbell"] },
  { id: "1456", movement: "overheadPress", needs: ["barbell"] },
  { id: "0603", movement: "overheadPress", needs: ["shoulder press machine"] },
  { id: "0997", movement: "overheadPress", needs: ["band"] },
  { id: "0405", movement: "overheadPress", needs: ["dumbbell", "bench"] },
  { id: "0027", movement: "row", needs: ["barbell"] },
  { id: "0293", movement: "row", needs: ["dumbbell"] },
  { id: "0988", movement: "row", needs: ["band", "band anchor"] },
  { id: "1350", movement: "row", needs: ["row machine"] },
  { id: "1323", movement: "row", needs: ["cable", "bench"] },
  { id: "2330", movement: "pulldown", needs: ["cable", "bench"] },
  { id: "0579", movement: "pulldown", needs: ["lat pulldown machine"] },
  { id: "1429", movement: "pulldown", needs: ["pull-up bar"] },
  { id: "0031", movement: "curl", needs: ["barbell"] },
  { id: "0294", movement: "curl", needs: ["dumbbell"] },
  { id: "0313", movement: "curl", needs: ["dumbbell"] },
  { id: "0968", movement: "curl", needs: ["band"] },
  { id: "0241", movement: "triceps", needs: ["cable"] },
  { id: "0430", movement: "triceps", needs: ["dumbbell"] },
  { id: "0178", movement: "lateralRaise", needs: ["cable"] },
  { id: "0334", movement: "lateralRaise", needs: ["dumbbell"] },
  { id: "0585", movement: "kneeExtension", needs: ["leg extension machine"] },
  { id: "0586", movement: "kneeFlexion", needs: ["lying leg curl machine"] },
  { id: "0599", movement: "kneeFlexion", needs: ["seated leg curl machine"] },
  { id: "0605", movement: "calves", needs: ["calf raise machine"] },
  { id: "0417", movement: "calves", needs: ["dumbbell"] },
  { id: "1373", movement: "calves", needs: [] },
  { id: "0472", movement: "legRaise", needs: ["pull-up bar"] },
  { id: "0274", movement: "core", needs: [] },
  { id: "3666", movement: "cardio", needs: ["treadmill"] },
  { id: "2138", movement: "cardio", needs: ["stationary bike"] },
  { id: "2141", movement: "cardio", needs: ["elliptical machine"] },
  { id: "0685", movement: "cardio", needs: ["outdoor route"] },
];

export function availableAlternatives(config: ExConfig, equipment: readonly string[]) {
  const source = SESSION_MOVEMENTS.find((candidate) => candidate.id === config.id);
  if (!source) return [];
  return SESSION_MOVEMENTS.filter(
    (candidate) =>
      candidate.movement === source.movement &&
      candidate.needs.every((need) => equipment.includes(need)) &&
      (modeOf(config) === (source.movement === "cardio" ? "cardio" : "reps") ||
        candidate.id === config.id) &&
      (candidate.id !== config.id ||
        !isBodyweightEq(config.id) ||
        !(config.weight && config.weight > 0) ||
        equipment.includes("added weight")),
  );
}

export interface SessionChoice {
  id?: string; // absent = automatic; empty = explicitly omitted
  sets?: number;
  amount?: number; // reps, seconds or minutes, depending on the original mode
}
export interface SessionConstraints {
  equipment: string[];
  budgetMin: number;
  restSec: number;
}
export interface SessionRow {
  key: string;
  original: ExConfig;
  planned: ExConfig | null;
  options: SessionMovement[];
  reason: "kept" | "swap" | "unknown" | "unavailable" | "rejected" | "duplicate" | "stale";
}

export function validSessionConstraints(constraints: SessionConstraints) {
  return (
    Number.isInteger(constraints.budgetMin) &&
    constraints.budgetMin >= 5 &&
    constraints.budgetMin <= 180 &&
    Number.isInteger(constraints.restSec) &&
    constraints.restSec >= 0 &&
    constraints.restSec <= 600 &&
    constraints.equipment.every((item) => SESSION_EQUIPMENT.some((equipment) => equipment === item))
  );
}

export function adaptSession(
  routine: Routine,
  constraints: SessionConstraints,
  choices: SessionChoice[] = [],
) {
  const occurrences = new Map<string, number>();
  const used = new Set<string>();
  return routine.ex.map((original, index): SessionRow => {
    const occurrence = (occurrences.get(original.id) ?? 0) + 1;
    occurrences.set(original.id, occurrence);
    const key = `${routine.id}:${original.id}:${occurrence}`;
    const options = availableAlternatives(original, constraints.equipment);
    const known = SESSION_MOVEMENTS.some((candidate) => candidate.id === original.id);
    const choice = choices[index];
    const selected =
      choice?.id ??
      options.find((candidate) => candidate.id === original.id && !used.has(candidate.id))?.id ??
      options.find((candidate) => !used.has(candidate.id))?.id;
    const candidate = options.find((option) => option.id === selected);
    const reason = !known
      ? "unknown"
      : !options.length
        ? "unavailable"
        : !candidate
          ? choice?.id === ""
            ? "rejected"
            : choice?.id
              ? "stale"
              : "duplicate"
          : candidate.id === original.id
            ? "kept"
            : "swap";
    if (!candidate) return { key, original, planned: null, options, reason };
    used.add(candidate.id);
    const mode = modeOf(original);
    const changed = candidate.id !== original.id;
    // Never transfer a load/speed or per-side convention across different exercises.
    const planned: ExConfig = changed
      ? {
          id: candidate.id,
          sets: original.sets,
          ...(mode === "time"
            ? { mode, sec: original.sec ?? 45 }
            : mode === "cardio"
              ? { min: original.min ?? 20, speed: 0 }
              : { reps: 10 }),
          weight: 0,
        }
      : { ...original };
    // Fixed session targets: no supersets or automatic progression can silently
    // add work/rest that the approximate budget did not account for.
    delete planned.sg;
    planned.prog = "off";
    if (choice?.sets !== undefined) planned.sets = choice.sets;
    if (choice?.amount !== undefined) {
      if (mode === "time") planned.sec = choice.amount;
      else if (mode === "cardio") planned.min = choice.amount;
      else planned.reps = choice.amount;
    }
    return { key, original: { ...original }, planned, options, reason };
  });
}

export function validSessionConfig(config: ExConfig) {
  const mode = modeOf(config);
  const amount =
    mode === "cardio"
      ? (config.min ?? 20)
      : mode === "time"
        ? (config.sec ?? 45)
        : (config.reps ?? 10);
  const limit = mode === "cardio" ? 180 : mode === "time" ? 600 : 100;
  return (
    Number.isInteger(config.sets) &&
    config.sets >= 1 &&
    config.sets <= 12 &&
    Number.isInteger(amount) &&
    amount >= 1 &&
    amount <= limit
  );
}

/** Includes 5 min preparation, 1 min setup/exercise, work and between-set rest.
 * Rep tempo is assumed 3 sec/rep. This is a planning estimate, never a promise. */
export function estimateSessionMinutes(configs: readonly ExConfig[], restSec: number) {
  if (!configs.length) return 0;
  let seconds = 300;
  for (const config of configs) {
    const mode = modeOf(config);
    const work =
      mode === "cardio"
        ? (config.min ?? 20) * 60
        : mode === "time"
          ? (config.sec ?? 45)
          : (config.reps ?? 10) * 3;
    seconds += 60 + config.sets * work + Math.max(0, config.sets - 1) * restSec;
  }
  return Math.ceil(seconds / 60);
}

// The user explicitly requests this reduction. Trim the largest remaining set
// count first, then cardio duration, then omit from the end of the template.
export function fitSession(rows: SessionRow[], constraints: SessionConstraints): SessionChoice[] {
  const choices: SessionChoice[] = rows.map(({ planned }) =>
    planned
      ? {
          id: planned.id,
          sets: planned.sets,
          amount:
            modeOf(planned) === "cardio"
              ? (planned.min ?? 20)
              : modeOf(planned) === "time"
                ? (planned.sec ?? 45)
                : (planned.reps ?? 10),
        }
      : { id: "" },
  );
  const configs = rows.map(({ planned }) => (planned ? { ...planned } : null));
  const estimate = () =>
    estimateSessionMinutes(
      configs.flatMap((config) => (config ? [config] : [])),
      constraints.restSec,
    );
  // Bound iterations even for malformed imported templates.
  for (let step = 0; step < 500 && estimate() > constraints.budgetMin; step++) {
    const reducible = configs
      .map((config, index) => ({ config, index }))
      .filter((row) => row.config && row.config.sets > 1)
      .sort((a, b) => (b.config?.sets ?? 0) - (a.config?.sets ?? 0))[0];
    if (reducible?.config) {
      reducible.config.sets--;
      choices[reducible.index].sets = reducible.config.sets;
      continue;
    }
    const cardioIndex = configs.findIndex(
      (config) => config && modeOf(config) === "cardio" && (config.min ?? 20) > 1,
    );
    const cardio = configs[cardioIndex];
    if (cardio) {
      cardio.min = (cardio.min ?? 20) - 1;
      choices[cardioIndex].amount = cardio.min;
      continue;
    }
    const lastIndex = configs.findLastIndex((config) => config !== null);
    if (lastIndex < 0) break;
    configs[lastIndex] = null;
    choices[lastIndex] = { id: "" };
  }
  return choices;
}

export function createSessionRoutine(
  source: Routine,
  constraints: SessionConstraints,
  rows: SessionRow[],
  id: string,
  name: string,
): Routine {
  const ex = rows.flatMap(({ planned }) => (planned ? [{ ...planned }] : []));
  if (
    !name.trim() ||
    name.length > 60 ||
    !id ||
    id === source.id ||
    !validSessionConstraints(constraints) ||
    !ex.length ||
    ex.some((config) => !validSessionConfig(config)) ||
    new Set(ex.map((config) => config.id)).size !== ex.length ||
    estimateSessionMinutes(ex, constraints.restSec) > constraints.budgetMin ||
    ex.some(
      (config) =>
        !availableAlternatives(config, constraints.equipment).some(
          (option) => option.id === config.id,
        ),
    )
  ) {
    throw new Error("Review equipment, targets and time before saving.");
  }
  const sessionPlan: SessionPlan = {
    sourceId: source.id,
    sourceName: source.name,
    ...structuredClone(constraints),
    rows: rows.map(({ original, planned }) => structuredClone({ original, planned })),
  };
  return { id, name, emoji: source.emoji, prog: "off", ex, sessionPlan };
}

export function canUndoSessionCopy(state: AppState, copy: Routine) {
  return (
    JSON.stringify(state.routines.find((routine) => routine.id === copy.id)) ===
      JSON.stringify(copy) &&
    state.active?.routineId !== copy.id &&
    !state.workouts.some((workout) => workout.routineId === copy.id) &&
    !Object.values(state.week).some((sessions) =>
      sessions?.some((session) => session.routineId === copy.id),
    ) &&
    !Object.values(state.dayPlan).some(
      (day) => !day.rest && day.sessions.some((session) => session.routineId === copy.id),
    )
  );
}
