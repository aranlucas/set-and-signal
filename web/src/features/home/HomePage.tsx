import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Outlet, useNavigate } from "@tanstack/react-router";
import { useStore } from "@/app/store/useStore";
import {
  effectiveRoutine,
  effectiveRoutineId,
  streakWeeks,
  lastBW,
} from "@/domain/training/history";
import {
  exCount,
  fmtNum,
  fmtDate,
  formatDate,
  todayISO,
  isoOf,
  weekKey,
} from "@/shared/lib/format";
import { useMuscleLabels } from "@/shared/hooks/use-muscle-labels";
import { bwDeltaColor } from "@/features/account/account-actions";
import Icon from "@/shared/components/Icon";
import {
  WeekCalendar,
  WeekStatusMark,
  type WeekCalendarDayStatus,
} from "@/shared/components/WeekCalendar";
import { Button } from "@/shared/ui/button";
import { glyphOf } from "@/domain/exercises/glyphs";
import {
  estimateRoutineMinutes,
  latestProgress,
  recoveryForRoutine,
} from "@/features/home/home-insights";
import type { AppState, IsoDate, Routine, User } from "@/shared/lib/types";
import { cn } from "@/shared/lib/utils";
import BrandMark from "@/shared/components/BrandMark";
import { useMeasurementFields } from "@/shared/hooks/use-measurement-fields";
import { SpaceBetween } from "@/shared/components/SpaceBetween";
import { PageHeader, PageTitle } from "@/shared/components/layout";

// Home = what to do now + a quick glance. Deep charts & history live in Stats.
export default function Home() {
  const { t } = useTranslation();
  const nav = useNavigate();
  const state = useStore((store) => store.appState);
  const user = useStore((storeState) => storeState.user);
  const [weekOffset, setWeekOffset] = useState(0);

  const today = new Date();
  const routine = effectiveRoutine(state, todayISO());
  const todayOvr = state.dayPlan[todayISO()] !== undefined;
  const bodyWeight = lastBW(state);
  const previousBodyWeight = state.bodyweight.length > 1 ? state.bodyweight.at(-2) : null;
  const weightDelta = bodyWeight && previousBodyWeight ? bodyWeight.w - previousBodyWeight.w : null;

  const monday = new Date(today);
  monday.setDate(today.getDate() - ((today.getDay() + 6) % 7) + weekOffset * 7);
  const completedDays = new Set(state.workouts.map((workout) => workout.d));
  const dayStatuses: Record<string, WeekCalendarDayStatus> = {};
  for (let i = 0; i < 7; i++) {
    const date = new Date(monday);
    date.setDate(monday.getDate() + i);
    const iso = isoOf(date);
    const effectiveId = effectiveRoutineId(state, iso);
    const overrideExists = state.dayPlan[iso] !== undefined;
    const isCompleted = completedDays.has(iso);
    const status = isCompleted
      ? "completed"
      : overrideExists && effectiveId
        ? "rescheduled"
        : effectiveId
          ? "planned"
          : undefined;
    if (status) dayStatuses[iso] = status;
  }
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  const wkLabel =
    weekOffset === 0
      ? t("home.thisWeek", "This week")
      : `${formatDate(t, monday, { day: "numeric", month: "short" })} – ${formatDate(t, sunday, { day: "numeric", month: "short" })}`;

  const wThisWeek = state.workouts.filter(
    (workout) => weekKey(workout.d) === weekKey(todayISO()),
  ).length;
  const plannedPerWeek = Object.values(state.week).filter(Boolean).length;
  const routineMinutes = estimateRoutineMinutes(routine, state.restSec);
  const recovery = recoveryForRoutine(state.workouts, routine, todayISO());
  const progress = latestProgress(state);

  // today's session shown right under the week strip
  const onToday = () => {
    if (state.active) void nav({ to: "/workout" });
    else if (routine)
      void nav({
        to: "/home/pre-workout/$routineId",
        params: { routineId: routine.id },
        resetScroll: false,
      });
    else
      void nav({
        to: "/home/day/$date",
        params: { date: todayISO() },
        resetScroll: false,
      });
  };

  return (
    <div className="mx-auto w-full max-w-xl min-w-0 md:max-w-none">
      <HomeHeader user={user} onSettings={() => nav({ to: "/settings" })} />
      <SpaceBetween
        size="m"
        responsiveSize={{ lg: "l" }}
        className="lg:grid lg:grid-cols-2 lg:items-stretch"
      >
        <HomeSchedule
          state={state}
          user={user}
          today={today}
          routine={routine}
          monday={monday}
          wkLabel={wkLabel}
          dayStatuses={dayStatuses}
          todayOvr={todayOvr}
          onToday={onToday}
          onDaySelect={(date) =>
            void nav({ to: "/home/day/$date", params: { date }, resetScroll: false })
          }
          onAi={() => void nav({ to: "/home/ai", resetScroll: false })}
          onPreviousWeek={() => setWeekOffset((week) => week - 1)}
          onNextWeek={() => setWeekOffset((week) => week + 1)}
          routineMinutes={routineMinutes}
        />
        <SpaceBetween size="s" className="min-w-0">
          {state.routines.length === 0 && !state.active && (
            <HomeWelcome
              onStart={() => void nav({ to: "/home/get-started", resetScroll: false })}
              onBrowse={() => void nav({ to: "/home/curated", resetScroll: false })}
              onBuild={() => nav({ to: "/plan" })}
            />
          )}

          <HomeInsights
            state={state}
            routine={routine}
            monday={monday}
            recovery={recovery}
            progress={progress}
            bodyWeight={bodyWeight}
            weightDelta={weightDelta}
            onGoal={() => void nav({ to: "/home/goal", resetScroll: false })}
            onLog={() => void nav({ to: "/home/bodyweight", resetScroll: false })}
            onMeasures={() => void nav({ to: "/home/measures", resetScroll: false })}
            thisWeek={wThisWeek}
            plannedPerWeek={plannedPerWeek}
            onCalendar={() => void nav({ to: "/home/calendar", resetScroll: false })}
            onStats={() => nav({ to: "/stats" })}
          />
        </SpaceBetween>
      </SpaceBetween>
      <Outlet />
    </div>
  );
}

function HomeHeader({ user, onSettings }: { user: User | null; onSettings: () => void }) {
  const { t } = useTranslation();
  return (
    <PageHeader className="mb-4 lg:mt-0 lg:mb-6">
      <div>
        <PageTitle className="flex items-center gap-2.5">
          <BrandMark className="size-9 text-primary" />
          <span>{user ? t("home.hi", "Hi {{name}}", { name: user.name }) : "Set & Signal"}</span>
        </PageTitle>
      </div>
      <button
        className="flex size-9 flex-none items-center justify-center rounded-full border border-border bg-card text-lg text-foreground transition duration-140 active:scale-95 active:bg-muted"
        onClick={onSettings}
        aria-label={t("navigation.settings", "Settings")}
      >
        <Icon name="gear" />
      </button>
    </PageHeader>
  );
}

type HomeScheduleProps = {
  state: AppState;
  user: User | null;
  today: Date;
  routine: Routine | null;
  monday: Date;
  wkLabel: string;
  dayStatuses: Record<string, WeekCalendarDayStatus>;
  todayOvr: boolean;
  onToday: () => void;
  onDaySelect: (iso: IsoDate) => void;
  onAi: () => void;
  onPreviousWeek: () => void;
  onNextWeek: () => void;
  routineMinutes: number;
};

function HomeSchedule({
  state,
  user,
  today,
  routine,
  monday,
  wkLabel,
  dayStatuses,
  todayOvr,
  onToday,
  onDaySelect,
  onAi,
  onPreviousWeek,
  onNextWeek,
  routineMinutes,
}: HomeScheduleProps) {
  const { t } = useTranslation();
  return (
    <section className="overflow-hidden rounded-xl border border-border bg-card lg:flex lg:h-full lg:flex-col">
      <SpaceBetween size="xs">
        <div className="flex items-center justify-between gap-3 px-4 pt-3">
          <button
            className="flex size-8 flex-none items-center justify-center rounded-full text-base text-foreground transition duration-150 hover:bg-muted active:scale-95"
            onClick={onPreviousWeek}
            aria-label={t("home.previousWeek", "Previous week")}
          >
            <Icon name="chevronLeft" />
          </button>
          <div className="text-sm leading-snug font-medium text-foreground/60">{wkLabel}</div>
          <button
            className="flex size-8 flex-none items-center justify-center rounded-full text-base text-foreground transition duration-150 hover:bg-muted active:scale-95"
            onClick={onNextWeek}
            aria-label={t("home.nextWeek", "Next week")}
          >
            <Icon name="chevronRight" />
          </button>
        </div>
        <div className="px-2 pb-2">
          <WeekCalendar
            weekStart={monday}
            dayStatuses={dayStatuses}
            onSelect={(date) => onDaySelect(isoOf(date))}
          />
        </div>
      </SpaceBetween>

      <div className="border-t border-border/60 p-4 lg:flex lg:flex-1 lg:flex-col">
        <div>
          <div className="mb-1 text-xs font-medium tracking-wide text-foreground/60">
            {formatDate(t, today, {
              weekday: "long",
              day: "numeric",
              month: "long",
            })}
          </div>
          <div className="flex items-center justify-between gap-4">
            <h2 className="min-w-0 text-2xl leading-tight font-semibold tracking-tight capitalize sm:text-3xl">
              {state.active
                ? state.active.name
                : routine
                  ? routine.name
                  : t("home.recoveryDay", "Recovery day")}
            </h2>
            <span
              className={cn(
                "flex size-11 flex-none items-center justify-center rounded-lg bg-muted text-2xl text-primary",
                state.active && "bg-orange-500/15 text-active",
              )}
            >
              <Icon name={state.active ? "timer" : routine ? glyphOf(routine.emoji) : "moon"} />
            </span>
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-foreground/60">
            {state.active ? (
              <span className="flex items-center gap-1.5 text-active">
                <Icon name="timer" />
                {t("home.workoutProgress", "Workout in progress")}
              </span>
            ) : routine ? (
              <>
                <span className="flex items-center gap-1.5">
                  <Icon name="clock" />
                  {t("home.aboutMin", "About {{minutes}} min", { minutes: routineMinutes })}
                </span>
                <span className="flex items-center gap-1.5">
                  <Icon name="dumbbell" />
                  {exCount(t, routine.ex.length)}
                </span>
                {todayOvr && (
                  <span className="text-active sm:ml-auto">
                    {t("calendar.status.rescheduled", "Rescheduled")}
                  </span>
                )}
              </>
            ) : (
              <span>
                {t(
                  "home.recoverAddLightSessionFeel",
                  "Recover, or add a light session if you feel ready.",
                )}
              </span>
            )}
          </div>
        </div>

        <SpaceBetween
          direction="horizontal"
          size="xs"
          className="mt-4 flex-nowrap lg:mt-auto lg:pt-6"
        >
          <Button className="flex-1" onClick={onToday}>
            <Icon name={state.active ? "play" : routine ? "play" : "plus"} />
            {state.active
              ? t("home.resumeWorkout", "Resume workout")
              : routine
                ? t("workout.startWorkout", "Start workout")
                : t("home.planSession", "Plan a session")}
          </Button>
          {routine && !state.active && (
            <Button
              variant="secondary"
              className="w-auto px-4"
              onClick={() => onDaySelect(todayISO())}
              aria-label={t("home.adjustTodaySWorkout", "Adjust today's workout")}
            >
              <Icon name="settings" />
              <span className="hidden sm:inline">{t("home.adjust", "Adjust")}</span>
            </Button>
          )}
        </SpaceBetween>

        {routine && !state.active && user && (
          <button
            type="button"
            className="mt-3 flex w-full items-center justify-center gap-2 rounded-md py-1.5 text-sm font-medium text-primary transition-colors hover:bg-primary/10 active:bg-primary/15"
            onClick={onAi}
          >
            <Icon name="sparkles" />
            {t("home.personalizeSessionAi", "Personalize this session with AI")}
          </button>
        )}
      </div>
    </section>
  );
}

function HomeWelcome({
  onStart,
  onBrowse,
  onBuild,
}: {
  onStart: () => void;
  onBrowse: () => void;
  onBuild: () => void;
}) {
  const { t } = useTranslation();
  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <div className="mb-1.5 flex items-center gap-3">
        <span className="flex size-7 flex-none items-center justify-center rounded-sm bg-primary text-lg text-white">
          <Icon name="sparkles" />
        </span>
        <div className="text-2xl leading-tight font-semibold tracking-tight">
          {t("home.welcome", "Welcome!")}
        </div>
      </div>
      <div className="mb-3 text-sm leading-snug text-foreground/60">
        {t(
          "home.firstPlanSetupDescription",
          "Answer a few quick questions and get a first week with sensible starting weights.",
        )}
      </div>
      <SpaceBetween size="xs">
        <Button className="w-full" variant="default" onClick={onStart}>
          <Icon name="figureStrength" />
          {t("startingSetup.cta", "Set up my first plan")}
        </Button>
        <Button className="w-full" onClick={onBrowse}>
          <Icon name="sparkles" />
          {t("plans.curated.browse", "Browse curated plans")}
        </Button>
        <Button className="w-full" onClick={onBuild}>
          {t("home.buildMyOwnPlan", "Build my own plan")}
        </Button>
      </SpaceBetween>
    </div>
  );
}

type HomeInsightsProps = {
  state: AppState;
  routine: Routine | null;
  monday: Date;
  recovery: ReturnType<typeof recoveryForRoutine>;
  progress: ReturnType<typeof latestProgress>;
  bodyWeight: ReturnType<typeof lastBW>;
  weightDelta: number | null;
  onGoal: () => void;
  onLog: () => void;
  onMeasures: () => void;
  thisWeek: number;
  plannedPerWeek: number;
  onCalendar: () => void;
  onStats: () => void;
};

function HomeInsights({
  state,
  routine,
  monday,
  recovery,
  progress,
  bodyWeight,
  weightDelta,
  onGoal,
  onLog,
  onMeasures,
  thisWeek,
  plannedPerWeek,
  onCalendar,
  onStats,
}: HomeInsightsProps) {
  const { t } = useTranslation();
  const muscleLabels = useMuscleLabels();
  const measurementFields = useMeasurementFields();
  const measures = state.measures?.at(-1) ?? null;
  const previousMeasures = (state.measures || []).length > 1 ? state.measures.at(-2) : null;
  const plannedDays = Array.from({ length: 7 }, (_, index) => {
    const date = new Date(monday);
    date.setDate(monday.getDate() + index);
    const iso = isoOf(date);
    const plannedRoutine = effectiveRoutine(state, iso);
    if (!plannedRoutine) return null;
    const completed = state.workouts.some((workout) => workout.d === iso);
    return {
      iso,
      date,
      name: plannedRoutine.name,
      completed,
      status: completed
        ? ("completed" as const)
        : state.dayPlan[iso] !== undefined
          ? ("rescheduled" as const)
          : ("planned" as const),
    };
  }).filter((day): day is NonNullable<typeof day> => Boolean(day));
  const adherence = plannedPerWeek
    ? Math.min(100, Math.round((thisWeek / plannedPerWeek) * 100))
    : 0;

  return (
    <section className="overflow-hidden rounded-xl border border-border bg-card lg:flex-1">
      <div className="border-b border-border/60 bg-muted/30 p-4">
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold tracking-tight">
              {t("home.recoveryEstimate", "Recovery estimate")}
            </h2>
            <p className="mt-0.5 text-sm text-foreground/60">
              {routine
                ? t(
                    "home.basedEffectiveSetsLastSix",
                    "Based on effective sets from your last six days",
                  )
                : t(
                    "home.chooseTodaySWorkoutSee",
                    "Choose today's workout to see target muscle recovery",
                  )}
            </p>
          </div>
          <Icon name="info" className="mt-0.5 flex-none text-xl text-muted-foreground" />
        </div>
        <SpaceBetween size="s">
          {recovery.map((item) => (
            <div key={item.muscle} className="flex items-center gap-3">
              <span className="w-26 flex-none overflow-hidden text-sm font-medium text-ellipsis whitespace-nowrap">
                {muscleLabels[item.muscle]}
              </span>
              <span className="h-1.5 flex-1 overflow-hidden rounded-sm bg-muted">
                <span
                  className="block h-full rounded-sm bg-system-blue transition-all duration-200 ease-out"
                  style={{ width: `${item.recovery}%` }}
                />
              </span>
              <span className="w-10 flex-none text-right text-sm font-medium tabular-nums">
                {item.recovery}%
              </span>
            </div>
          ))}
        </SpaceBetween>
      </div>

      <button
        type="button"
        className="block w-full border-b border-border/60 bg-muted/30 p-4 text-left transition-colors hover:bg-muted/50 active:bg-muted"
        onClick={onCalendar}
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold tracking-tight">
              {t("home.thisWeek", "This week")}
            </h2>
            <p className="mt-1 text-2xl font-semibold tracking-tight tabular-nums">
              {plannedPerWeek
                ? t("home.ofSessions", "{{current}} of {{total}} sessions", {
                    current: thisWeek,
                    total: plannedPerWeek,
                  })
                : t("home.noSessionsPlanned", "No sessions planned")}
            </p>
          </div>
          <div className="text-right">
            <div className="text-lg font-semibold text-system-blue tabular-nums">
              {plannedPerWeek ? `${adherence}%` : t("navigation.plan", "Plan")}
            </div>
            <div className="mt-1 flex items-center justify-end gap-1 text-sm text-foreground/60">
              <Icon name="flame" className="text-system-blue" />
              {t("home.weekStreak", "{{count}} week streak", { count: streakWeeks(state) })}
            </div>
          </div>
        </div>
        {plannedDays.length > 0 && (
          <div
            className="mt-4 grid gap-2"
            style={{
              gridTemplateColumns: `repeat(${Math.min(plannedDays.length, 5)}, minmax(0, 1fr))`,
            }}
          >
            {plannedDays.slice(0, 5).map((day) => (
              <div
                key={day.iso}
                className={cn(
                  "flex min-w-0 flex-col items-center rounded-md bg-muted px-1.5 py-2 text-center",
                  day.status === "rescheduled" && "ring-1 ring-orange-500",
                )}
              >
                <span className="text-xs font-medium tracking-wide text-foreground/60 uppercase">
                  {formatDate(t, day.date, { weekday: "short" })}
                </span>
                <span className="mt-0.5 line-clamp-2 min-h-7 w-full text-xs leading-tight font-medium">
                  {day.name}
                </span>
                <WeekStatusMark status={day.status} className="mt-1" />
              </div>
            ))}
          </div>
        )}
      </button>

      {progress && (
        <button
          type="button"
          className="flex w-full items-center gap-3 border-b border-border/60 p-4 text-left transition-colors hover:bg-muted/50 active:bg-muted"
          onClick={onStats}
        >
          <div className="min-w-0">
            <div className="text-sm text-foreground/60">
              {t("home.recentProgress", "Recent progress")}
            </div>
            <div className="mt-0.5 overflow-hidden text-lg font-semibold tracking-tight text-ellipsis whitespace-nowrap capitalize">
              {progress.exerciseName}
            </div>
            <div className="mt-0.5 text-sm">
              <span
                className={cn(
                  "font-medium text-system-blue",
                  progress.delta !== null && progress.delta < 0 && "text-destructive",
                )}
              >
                {progress.delta !== null && progress.delta !== 0
                  ? `${progress.delta > 0 ? "+" : ""}${fmtNum(progress.delta)} ${state.unit}`
                  : t("home.latestEstimate", "Latest estimate")}
              </span>{" "}
              <span className="text-foreground/60">· {fmtDate(t, progress.date)}</span>
            </div>
          </div>
          <div className="ml-auto flex-none text-right">
            <div className="text-lg font-semibold tabular-nums">
              {fmtNum(progress.estimate)} {state.unit}
            </div>
            <div className="text-xs text-foreground/60">
              {t("home.estimated1rm", "estimated 1RM")}
            </div>
          </div>
          <Icon name="chevronRight" className="text-lg text-muted-foreground" />
        </button>
      )}

      <div className="flex flex-wrap items-center gap-3 p-4">
        <span className="flex size-10 flex-none items-center justify-center rounded-lg bg-muted text-xl text-system-blue">
          <Icon name="scale" />
        </span>
        <div className="min-w-32 flex-1">
          <div className="text-sm text-foreground/60">{t("weight.bodyWeight", "Body weight")}</div>
          {bodyWeight ? (
            <div className="mt-0.5 flex items-baseline gap-2">
              <span className="text-lg font-semibold tracking-tight">
                {fmtNum(bodyWeight.w)} {state.unit}
              </span>
              {!!weightDelta && (
                <span
                  className="text-sm font-medium"
                  style={{ color: bwDeltaColor(weightDelta, bodyWeight.w) }}
                >
                  {weightDelta > 0 ? "+" : ""}
                  {fmtNum(weightDelta)}
                </span>
              )}
              <span className="text-sm text-muted-foreground">{fmtDate(t, bodyWeight.d)}</span>
            </div>
          ) : (
            <div className="mt-0.5 text-sm text-foreground/60">
              {t("home.noWeighInsYet", "No weigh-ins yet")}
            </div>
          )}
        </div>
        <div className="grid w-full grid-cols-3 items-stretch gap-2 sm:flex sm:w-auto sm:gap-3">
          <Button
            size="sm"
            variant="secondary"
            className="px-2.5"
            onClick={onMeasures}
            aria-label={t("measurements.log", "Log measurements")}
          >
            <Icon name="person" />
          </Button>
          <Button size="sm" variant="secondary" onClick={onGoal}>
            <Icon name="target" />
            {state.targetW ? fmtNum(state.targetW) : t("common.goal", "Goal")}
          </Button>
          <Button size="sm" onClick={onLog}>
            <Icon name="plus" />
            {t("common.log", "Log")}
          </Button>
        </div>
      </div>
      {measures && (
        <button
          type="button"
          className="flex w-full flex-wrap items-center gap-x-3 gap-y-1.5 border-t border-border/60 px-4 py-3 text-left transition-colors hover:bg-muted/50 active:bg-muted"
          onClick={onMeasures}
        >
          <span className="inline-flex items-center gap-1 text-xs font-medium tracking-wider text-muted-foreground uppercase">
            <Icon name="person" className="text-sm" />
            {t("measurements.title", "Measurements")}
          </span>
          {measurementFields
            .filter(({ key }) => measures[key] != null)
            .map(({ key, label }) => {
              const current = measures[key]!;
              const previous = previousMeasures?.[key];
              const delta = previous != null ? current - previous : null;
              return (
                <span key={key} className="inline-flex items-center gap-1 text-sm tabular-nums">
                  <span className="text-muted-foreground">{label}</span>
                  <strong>{fmtNum(current)}</strong>
                  {delta != null && Math.abs(delta) >= 0.05 && (
                    <span
                      className={cn(
                        "text-xs font-medium",
                        delta > 0 ? "text-system-blue" : "text-sky-400",
                      )}
                    >
                      {delta > 0 ? "+" : "−"}
                      {fmtNum(Math.abs(delta))}
                    </span>
                  )}
                </span>
              );
            })}
        </button>
      )}
    </section>
  );
}
