import type { IsoDate, Workout } from "@/shared/lib/types";

export type HistoryRange = "30" | "90" | "all";
export type HistoryRoutineFilter = string;

export interface HistoryFilters {
  query: string;
  routineId: HistoryRoutineFilter;
  range: HistoryRange;
}

export interface HistorySummary {
  sessions: number;
  volume: number;
  durationMs: number;
}

export interface HistoryMonthGroup {
  month: string;
  workouts: Workout[];
}

const DAY_MS = 86_400_000;
const MARKS_RE = /\p{Mark}+/gu;
const SEPARATORS_RE = /[^\p{Letter}\p{Number}]+/gu;

function normalizeHistorySearchText(value: string): string {
  return value
    .toLocaleLowerCase()
    .normalize("NFD")
    .replaceAll(MARKS_RE, "")
    .replaceAll(SEPARATORS_RE, " ")
    .trim()
    .replaceAll(/\s+/gu, " ");
}

function dateAtNoon(iso: IsoDate): Date {
  return new Date(`${iso}T12:00:00`);
}

function isoAtLocalDate(date: Date): IsoDate {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

/** The lower inclusive date for a range that includes today. */
export function historyRangeStart(today: IsoDate, range: HistoryRange): IsoDate | null {
  if (range === "all") return null;
  const start = dateAtNoon(today);
  start.setTime(start.getTime() - (Number(range) - 1) * DAY_MS);
  return isoAtLocalDate(start);
}

function workoutSearchText(workout: Workout, exerciseName?: (id: string) => string | undefined) {
  return normalizeHistorySearchText(
    [
      workout.name,
      workout.note,
      ...workout.entries.flatMap((entry) => [
        entry.n,
        entry.muscleSnapshot?.n,
        exerciseName?.(entry.id),
        entry.id,
      ]),
    ]
      .filter((value): value is string => Boolean(value))
      .join(" "),
  );
}

export function filterHistoryWorkouts(
  workouts: readonly Workout[],
  filters: HistoryFilters,
  today: IsoDate,
  exerciseName?: (id: string) => string | undefined,
): Workout[] {
  const query = normalizeHistorySearchText(filters.query);
  const rangeStart = historyRangeStart(today, filters.range);

  return workouts
    .filter((workout) => {
      if (rangeStart !== null && (workout.d < rangeStart || workout.d > today)) return false;
      if (filters.routineId === "freestyle" && workout.routineId !== null) return false;
      if (
        filters.routineId !== "all" &&
        filters.routineId !== "freestyle" &&
        workout.routineId !== filters.routineId
      )
        return false;
      return !query || workoutSearchText(workout, exerciseName).includes(query);
    })
    .toSorted((left, right) => right.d.localeCompare(left.d) || right.start - left.start);
}

export function summarizeHistoryWorkouts(workouts: readonly Workout[]): HistorySummary {
  return workouts.reduce(
    (summary, workout) => ({
      sessions: summary.sessions + 1,
      volume: summary.volume + Math.max(0, workout.vol || 0),
      durationMs: summary.durationMs + Math.max(0, (workout.end || workout.start) - workout.start),
    }),
    { sessions: 0, volume: 0, durationMs: 0 },
  );
}

export function groupHistoryWorkoutsByMonth(workouts: readonly Workout[]): HistoryMonthGroup[] {
  const groups = new Map<string, Workout[]>();
  for (const workout of workouts) {
    const month = workout.d.slice(0, 7);
    const current = groups.get(month);
    if (current) current.push(workout);
    else groups.set(month, [workout]);
  }
  return [...groups.entries()].map(([month, groupedWorkouts]) => ({
    month,
    workouts: groupedWorkouts,
  }));
}
