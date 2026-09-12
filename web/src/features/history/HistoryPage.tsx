import { useNavigate } from "@tanstack/react-router";
import { useCallback, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useStore } from "@/app/store/useStore";
import { EXIDX } from "@/domain/exercises/exercises";
import { WorkoutDetail, WorkoutRow } from "@/features/history/HistorySheet";
import {
  filterHistoryWorkouts,
  groupHistoryWorkoutsByMonth,
  summarizeHistoryWorkouts,
  type HistoryFilters,
  type HistoryRange,
} from "@/features/history/history-filters";
import { fmtDur, fmtVol, formatDate, todayISO } from "@/shared/lib/format";
import type { Workout } from "@/shared/lib/types";
import { Sheet, SheetContent, SheetTitle } from "@/shared/ui/sheet";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import { NativeSelect, NativeSelectOption } from "@/shared/ui/native-select";
import { Label } from "@/shared/ui/label";
import { Segmented } from "@/shared/components/Segmented";
import Icon from "@/shared/components/Icon";

const DEFAULT_FILTERS: HistoryFilters = { query: "", routineId: "all", range: "all" };

function hasActiveFilters(filters: HistoryFilters): boolean {
  return filters.query.trim().length > 0 || filters.routineId !== "all" || filters.range !== "all";
}

export default function History() {
  const { t } = useTranslation();
  const nav = useNavigate();
  const state = useStore((store) => store.appState);
  const [filters, setFilters] = useState<HistoryFilters>(DEFAULT_FILTERS);
  const [workout, setWorkout] = useState<Workout | null>(null);
  const today = todayISO();

  const exerciseName = useCallback(
    (id: string): string | undefined =>
      EXIDX[id]?.n || state.customEx.find((exercise) => exercise.id === id)?.n,
    [state.customEx],
  );
  const matchingWorkouts = useMemo(
    () => filterHistoryWorkouts(state.workouts, filters, today, exerciseName),
    [state.workouts, filters, today, exerciseName],
  );
  const summary = useMemo(() => summarizeHistoryWorkouts(matchingWorkouts), [matchingWorkouts]);
  const monthGroups = useMemo(
    () => groupHistoryWorkoutsByMonth(matchingWorkouts),
    [matchingWorkouts],
  );
  const activeFilters = hasActiveFilters(filters);
  const closeSheet = () => {
    setWorkout(null);
    return Promise.resolve();
  };

  return (
    <>
      <div className="mt-2 mb-5 flex items-end justify-between gap-3">
        <div className="min-w-0 flex-1">
          <h1 className="text-4xl leading-none font-bold tracking-tight">
            {t("navigation.history", "History")}
          </h1>
          <p className="mt-1 text-base tracking-tight text-foreground/60">
            {state.workouts.length
              ? t("history.subtitle", "Your training, session by session")
              : t("history.emptySubtitle", "Every session you log will appear here")}
          </p>
        </div>
        <Button
          variant="plain"
          className="flex size-9 flex-none items-center justify-center rounded-full bg-card text-lg text-foreground transition duration-140 active:scale-95 active:bg-muted"
          onClick={() => void nav({ to: "/stats" })}
          aria-label={t("navigation.stats", "Stats")}
        >
          <Icon name="chevronLeft" />
        </Button>
      </div>

      {state.workouts.length > 0 && (
        <>
          <section className="mb-3 rounded-xl bg-card p-3 shadow-sm">
            <div className="relative">
              <Icon
                name="search"
                className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
              />
              <Label htmlFor="history-search" className="sr-only">
                {t("history.searchLabel", "Search history")}
              </Label>
              <Input
                id="history-search"
                value={filters.query}
                onChange={(event) =>
                  setFilters((current) => ({ ...current, query: event.target.value }))
                }
                placeholder={t(
                  "history.searchPlaceholder",
                  "Search workouts, exercises, or notes…",
                )}
                className="rounded-lg bg-muted py-2.5 pl-9 text-base"
              />
            </div>
            <div className="mt-3 flex flex-col gap-2.5 sm:flex-row sm:items-center">
              <Label className="flex min-w-0 flex-1 items-center gap-2 text-sm text-foreground/60">
                <span className="shrink-0">{t("history.routine", "Routine")}</span>
                <NativeSelect
                  aria-label={t("history.routine", "Routine")}
                  value={filters.routineId}
                  onChange={(event) =>
                    setFilters((current) => ({
                      ...current,
                      routineId: event.target.value,
                    }))
                  }
                  className="min-w-0 flex-1"
                >
                  <NativeSelectOption value="all">
                    {t("history.allRoutines", "All routines")}
                  </NativeSelectOption>
                  <NativeSelectOption value="freestyle">
                    {t("history.freestyle", "Freestyle")}
                  </NativeSelectOption>
                  {state.routines.map((routine) => (
                    <NativeSelectOption key={routine.id} value={routine.id}>
                      {routine.name}
                    </NativeSelectOption>
                  ))}
                </NativeSelect>
              </Label>
              <div className="min-w-0 flex-1">
                <span className="sr-only">{t("history.dateRange", "Date range")}</span>
                <Segmented
                  className="w-full"
                  value={filters.range}
                  onChange={(range: HistoryRange) =>
                    setFilters((current) => ({ ...current, range }))
                  }
                  options={[
                    { value: "30", label: t("history.last30Days", "30 days") },
                    { value: "90", label: t("history.last90Days", "90 days") },
                    { value: "all", label: t("history.allTime", "All time") },
                  ]}
                />
              </div>
              {activeFilters && (
                <Button
                  type="button"
                  variant="plain"
                  className="self-start rounded-md px-2 py-1 text-sm text-primary hover:bg-primary/10 sm:self-auto"
                  onClick={() => setFilters(DEFAULT_FILTERS)}
                >
                  {t("history.resetFilters", "Reset")}
                </Button>
              )}
            </div>
          </section>

          <section
            aria-label={t("history.summary", "History summary")}
            className="mb-5 grid grid-cols-3 gap-2"
          >
            <SummaryMetric
              icon="dumbbell"
              label={t("history.sessions", "Sessions")}
              value={String(summary.sessions)}
            />
            <SummaryMetric
              icon="chart"
              label={t("history.volume", "Volume")}
              value={fmtVol(summary.volume, state.unit)}
            />
            <SummaryMetric
              icon="timer"
              label={t("history.duration", "Duration")}
              value={fmtDur(summary.durationMs)}
            />
          </section>
        </>
      )}

      {monthGroups.length > 0 ? (
        <div className="flex flex-col gap-5">
          {monthGroups.map((group) => (
            <section key={group.month} aria-labelledby={`history-${group.month}`}>
              <div className="mb-2 flex items-center justify-between gap-3 px-1">
                <h2
                  id={`history-${group.month}`}
                  className="text-sm font-semibold tracking-wide text-foreground/60 uppercase"
                >
                  {formatDate(t, new Date(`${group.month}-01T12:00:00`), {
                    month: "long",
                    year: "numeric",
                  })}
                </h2>
                <span className="text-xs text-muted-foreground">
                  {t("history.monthSessionCount", "{{count}} sessions", {
                    count: group.workouts.length,
                  })}
                </span>
              </div>
              <div className="flex flex-col gap-2">
                {group.workouts.map((workoutRecord) => (
                  <WorkoutRow
                    key={workoutRecord.id}
                    workout={workoutRecord}
                    onClick={() => setWorkout(workoutRecord)}
                  />
                ))}
              </div>
            </section>
          ))}
        </div>
      ) : state.workouts.length === 0 ? (
        <EmptyHistory onStart={() => void nav({ to: "/workout" })} />
      ) : (
        <EmptyFilteredHistory onReset={() => setFilters(DEFAULT_FILTERS)} />
      )}

      <Sheet
        open={workout !== null}
        onOpenChange={(open) => {
          if (!open) setWorkout(null);
        }}
      >
        <SheetContent
          side="bottom"
          className="max-h-screen touch-pan-y overflow-y-auto overscroll-contain rounded-2xl bg-sheet p-2 px-4.5 pb-5 lg:inset-x-auto lg:left-1/2 lg:w-160 lg:-translate-x-1/2"
          showCloseButton={false}
        >
          <SheetTitle className="sr-only">
            {workout?.name || t("history.workoutDetails", "Workout details")}
          </SheetTitle>
          <div className="mx-auto mt-1.5 mb-3.5 h-1 w-9 rounded-full bg-foreground/20" />
          {workout && <WorkoutDetail workoutId={workout.id} close={closeSheet} />}
        </SheetContent>
      </Sheet>
    </>
  );
}

function SummaryMetric({
  icon,
  label,
  value,
}: {
  icon: "chart" | "dumbbell" | "timer";
  label: string;
  value: string;
}) {
  return (
    <div className="min-w-0 rounded-xl bg-card p-3 shadow-sm">
      <Icon name={icon} className="mb-2 size-4 text-primary" />
      <div className="truncate text-base font-semibold tracking-tight">{value}</div>
      <div className="mt-0.5 truncate text-xs text-foreground/60">{label}</div>
    </div>
  );
}

function EmptyHistory({ onStart }: { onStart: () => void }) {
  const { t } = useTranslation();
  return (
    <div className="rounded-2xl bg-card px-5 py-12 text-center shadow-sm">
      <div className="mx-auto mb-4 flex size-14 items-center justify-center rounded-2xl bg-primary/10 text-3xl text-primary">
        <Icon name="history" />
      </div>
      <h2 className="text-xl font-semibold tracking-tight">
        {t("history.noWorkoutsTitle", "Your training story starts here")}
      </h2>
      <p className="mx-auto mt-2 max-w-sm text-sm leading-relaxed text-foreground/60">
        {t(
          "history.noWorkoutsDescription",
          "Log your first workout and your progress will build up here.",
        )}
      </p>
      <Button className="mt-5" onClick={onStart}>
        <Icon name="dumbbell" />
        {t("history.startFirstWorkout", "Start your first workout")}
      </Button>
    </div>
  );
}

function EmptyFilteredHistory({ onReset }: { onReset: () => void }) {
  const { t } = useTranslation();
  return (
    <div className="rounded-2xl bg-card px-5 py-12 text-center shadow-sm">
      <div className="mx-auto mb-4 flex size-14 items-center justify-center rounded-2xl bg-muted text-3xl text-muted-foreground">
        <Icon name="search" />
      </div>
      <h2 className="text-xl font-semibold tracking-tight">
        {t("history.noMatchesTitle", "No sessions match those filters")}
      </h2>
      <p className="mx-auto mt-2 max-w-sm text-sm leading-relaxed text-foreground/60">
        {t("history.noMatchesDescription", "Try a broader date range or a different search.")}
      </p>
      <Button variant="outline" className="mt-5" onClick={onReset}>
        {t("history.clearFilters", "Clear filters")}
      </Button>
    </div>
  );
}
