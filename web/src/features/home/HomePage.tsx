import { useState } from "react";
import { Outlet, useNavigate } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import {
  Activity,
  ArrowDownRight,
  ArrowRight,
  ArrowUpRight,
  CalendarDays,
  Check,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Dumbbell,
  Flame,
  Layers3,
  Play,
  Plus,
  Ruler,
  Scale,
  Sparkles,
  Target,
  Trophy,
} from "lucide-react";
import { useStore } from "@/app/store/useStore";
import { effectiveRoutine, lastBW, streakWeeks } from "@/domain/training/history";
import { exerciseMetadata } from "@/domain/exercises/exercise-metadata";
import { loadOfRoutine, rankOf } from "@/domain/exercises/muscles";
import { fmtDate, fmtDur, fmtNum, formatDate, isoOf, todayISO } from "@/shared/lib/format";
import { useMuscleLabels } from "@/shared/hooks/use-muscle-labels";
import { useExerciseMetadataLabels } from "@/shared/hooks/use-exercise-metadata-labels";
import { estimateRoutineMinutes, latestProgress } from "./home-insights";
import { Button } from "@/shared/ui/button";
import BodySignals from "./BodySignals";
import { NativeSelect, NativeSelectOption } from "@/shared/ui/native-select";
import { weeklySummary, volumeTrend } from "./training-summary";

export default function Home() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const state = useStore((store) => store.appState);
  const user = useStore((store) => store.user);
  const muscles = useMuscleLabels();
  const metadata = useExerciseMetadataLabels();
  const [weekOffset, setWeekOffset] = useState(0);
  const [chartWeeks, setChartWeeks] = useState(6);
  const today = todayISO();
  const routine = effectiveRoutine(state, today);
  const activeRoutine = state.active
    ? {
        id: state.active.routineId ?? state.active.id,
        name: state.active.name,
        emoji: "dumbbell",
        ex: state.active.entries.map((entry) => ({
          ...entry.target,
          sets: entry.sets.filter((set) => !("wu" in set && set.wu)).length,
        })),
      }
    : routine;
  const summary = weeklySummary(state.workouts, today);
  const trend = volumeTrend(state.workouts, today, chartWeeks);
  const maxVolume = Math.max(1, ...trend.map((week) => week.volume));
  const planned = Object.values(state.week).filter(Boolean).length;
  const streak = streakWeeks(state);
  const recent = state.workouts
    .toSorted((a, b) => b.d.localeCompare(a.d) || b.start - a.start)
    .slice(0, 3);
  const latest = latestProgress(state);
  const weight = lastBW(state);
  const targetMuscles = rankOf(loadOfRoutine(activeRoutine)).worked.slice(0, 3);
  const minutes = estimateRoutineMinutes(activeRoutine, state.restSec);
  const sets = activeRoutine?.ex.reduce((total, exercise) => total + exercise.sets, 0) ?? 0;
  const monday = new Date(today + "T12:00:00");
  monday.setDate(monday.getDate() - ((monday.getDay() + 6) % 7) + weekOffset * 7);
  const dates = Array.from({ length: 7 }, (_, index) => {
    const date = new Date(monday);
    date.setDate(date.getDate() + index);
    return date;
  });
  const start = () => {
    if (state.active) void navigate({ to: "/workout" });
    else if (routine)
      void navigate({
        to: "/home/pre-workout/$routineId",
        params: { routineId: routine.id },
        resetScroll: false,
      });
    else void navigate({ to: "/workout" });
  };
  const viewRoutine = () => {
    if (state.active) {
      void navigate({ to: "/workout" });
      return;
    }
    if (activeRoutine) void navigate({ to: "/plan/r/$id", params: { id: activeRoutine.id } });
  };
  return (
    <div className="training-dashboard">
      <div className="dashboard-heading">
        <div>
          <h1>{t("dashboard.headline", "A little stronger. Every session.")}</h1>
          <p>
            {user
              ? t(
                  "dashboard.welcomeName",
                  "Welcome back, {{name}}. Let's make your next session count.",
                  { name: user.name.split(" ")[0] },
                )
              : t(
                  "dashboard.subtitle",
                  "Consistency compounds. Keep showing up — the work adds up.",
                )}
          </p>
        </div>
        <Button onClick={start} className="dashboard-start">
          <Play size={16} fill="currentColor" />
          {state.active
            ? t("home.resumeWorkout", "Resume workout")
            : t("workout.startWorkout", "Start workout")}
        </Button>
      </div>
      <div className="dashboard-metrics">
        <Button
          variant="plain"
          type="button"
          className="dashboard-metric"
          onClick={() => void navigate({ to: "/home/calendar" })}
        >
          <span className="metric-symbol">
            <CalendarDays size={22} />
          </span>
          <span>
            <small>{t("dashboard.sessionsWeek", "Sessions this week")}</small>
            <strong>
              {summary.sessions}
              <em>{planned ? ` / ${planned}` : ""}</em>
            </strong>
            <span className="metric-note">
              {planned && summary.sessions >= planned
                ? t("dashboard.weekComplete", "Weekly plan complete")
                : t("dashboard.makeTime", "Make time for yourself")}
            </span>
          </span>
        </Button>
        <Button
          variant="plain"
          type="button"
          className="dashboard-metric"
          onClick={() => void navigate({ to: "/stats" })}
        >
          <span className="metric-symbol">
            <ChartIcon />
          </span>
          <span>
            <small>{t("dashboard.weeklyVolume", "Weekly volume")}</small>
            <strong>
              {fmtNum(summary.volume)} <em>{state.unit}</em>
            </strong>
            <span
              className={`metric-note ${summary.change !== null && summary.change >= 0 ? "positive" : ""}`}
            >
              {summary.change !== null ? (
                <>
                  {summary.change >= 0 ? <ArrowUpRight size={13} /> : <ArrowDownRight size={13} />}
                  {t("dashboard.weekChange", "{{change}}% vs last week", {
                    change: summary.change,
                  })}
                </>
              ) : (
                t("dashboard.completedSets", "From completed work sets")
              )}
            </span>
          </span>
        </Button>
        <Button
          variant="plain"
          type="button"
          className="dashboard-metric"
          onClick={() => void navigate({ to: "/history" })}
        >
          <span className="metric-symbol">
            <Flame size={22} />
          </span>
          <span>
            <small>{t("dashboard.trainingStreak", "Training streak")}</small>
            <strong>
              {streak} <em>{t("dashboard.weeks", "weeks")}</em>
            </strong>
            <span className="metric-note">
              {t("dashboard.oneSession", "One session at a time")}
            </span>
          </span>
        </Button>
        <Button
          variant="plain"
          type="button"
          className="dashboard-metric"
          onClick={() => void navigate({ to: "/stats" })}
        >
          <span className="metric-symbol">
            <Trophy size={22} />
          </span>
          <span>
            <small>{t("dashboard.personalRecords", "Personal records")}</small>
            <strong>{summary.records}</strong>
            <span className="metric-note">{t("dashboard.thisWeek", "Earned this week")}</span>
          </span>
        </Button>
      </div>
      <div className="dashboard-columns">
        <div className="dashboard-primary">
          <section className="workout-spotlight">
            <div className="spotlight-arcs" aria-hidden="true">
              <span />
              <span />
              <span />
            </div>
            <div className="spotlight-content">
              <p className="spotlight-label">
                <span className="spotlight-status" />
                {state.active
                  ? t("dashboard.sessionActive", "Session in progress")
                  : t("dashboard.todayWorkout", "Today's workout")}
              </p>
              <h2>
                {state.active?.name || routine?.name || t("home.recoveryDay", "Recovery day")}
              </h2>
              <p className="spotlight-muscles">
                {targetMuscles.length
                  ? targetMuscles.map((muscle) => muscles[muscle]).join(" / ")
                  : t("dashboard.recoveryMessage", "Take a breath. Come back stronger.")}
              </p>
              <div className="spotlight-details">
                {activeRoutine ? (
                  <>
                    <span>
                      <Dumbbell size={15} />
                      {t("dashboard.exerciseTotal", "{{total}} exercises", {
                        total: activeRoutine.ex.length,
                      })}
                    </span>
                    <span>
                      <Clock3 size={15} />
                      {t("dashboard.minutes", "{{minutes}} min", { minutes })}
                    </span>
                    <span>
                      <Layers3 size={15} />
                      {t("dashboard.setTotal", "{{total}} sets", { total: sets })}
                    </span>
                  </>
                ) : (
                  <span>
                    {t(
                      "dashboard.restChoice",
                      "Rest is part of the program. Or train on your terms.",
                    )}
                  </span>
                )}
              </div>
              <div className="spotlight-actions">
                <Button className="spotlight-start" onClick={start}>
                  <Play size={16} fill="currentColor" />
                  {state.active
                    ? t("home.resumeWorkout", "Resume workout")
                    : routine
                      ? t("dashboard.startSession", "Start session")
                      : t("dashboard.freestyleSession", "Start an empty workout")}
                </Button>
                {activeRoutine && (
                  <Button
                    variant="plain"
                    type="button"
                    className="spotlight-adjust"
                    onClick={viewRoutine}
                  >
                    {state.active
                      ? t("dashboard.openSession", "Open session")
                      : t("dashboard.viewRoutine", "View routine")}
                    <ArrowRight size={15} />
                  </Button>
                )}
              </div>
            </div>
          </section>
          {!state.routines.length && (
            <section className="dashboard-panel welcome-panel">
              <Sparkles size={24} />
              <div>
                <h2>{t("dashboard.firstProgram", "Your next chapter starts here.")}</h2>
                <p>
                  {t(
                    "dashboard.firstProgramDetail",
                    "Build a routine from scratch, or find a program that fits your goals.",
                  )}
                </p>
                <div className="mt-4 flex flex-wrap gap-2">
                  <Button size="sm" onClick={() => void navigate({ to: "/home/get-started" })}>
                    {t("startingSetup.cta", "Set up my first plan")}
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => void navigate({ to: "/home/curated" })}
                  >
                    {t("plans.curated.browse", "Browse curated plans")}
                  </Button>
                </div>
              </div>
            </section>
          )}
          <section className="dashboard-panel">
            <div className="panel-heading">
              <h2>{t("dashboard.trainingWeek", "Your training week")}</h2>
              <div className="week-navigation">
                <Button
                  variant="plain"
                  type="button"
                  onClick={() => setWeekOffset(0)}
                  className="week-current"
                >
                  {weekOffset === 0
                    ? t("home.thisWeek", "This week")
                    : formatDate(t, monday, { day: "numeric", month: "short" })}
                </Button>
                <Button
                  variant="plain"
                  type="button"
                  aria-label={t("home.previousWeek", "Previous week")}
                  onClick={() => setWeekOffset((offset) => offset - 1)}
                >
                  <ChevronLeft size={17} />
                </Button>
                <Button
                  variant="plain"
                  type="button"
                  aria-label={t("home.nextWeek", "Next week")}
                  onClick={() => setWeekOffset((offset) => offset + 1)}
                >
                  <ChevronRight size={17} />
                </Button>
              </div>
            </div>
            <div className="training-week">
              {dates.map((date) => {
                const iso = isoOf(date);
                const scheduled = effectiveRoutine(state, iso);
                const completed = state.workouts.some((workout) => workout.d === iso);
                return (
                  <Button
                    variant="plain"
                    type="button"
                    key={iso}
                    className={`training-day ${iso === today ? "is-today" : ""}`}
                    onClick={() =>
                      void navigate({
                        to: "/home/day/$date",
                        params: { date: iso },
                        resetScroll: false,
                      })
                    }
                    aria-label={`${formatDate(t, date, { weekday: "long", day: "numeric", month: "long" })}, ${completed ? t("calendar.status.completed", "Done") : scheduled?.name || t("home.recoveryDay", "Recovery day")}`}
                    aria-current={iso === today ? "date" : undefined}
                  >
                    <span>{formatDate(t, date, { weekday: "short" })}</span>
                    <strong>{date.getDate()}</strong>
                    <span
                      className={`day-status ${completed ? "is-completed" : scheduled ? "is-planned" : ""}`}
                    >
                      {completed ? (
                        <Check size={12} strokeWidth={3} />
                      ) : scheduled ? (
                        <Dumbbell size={13} />
                      ) : (
                        <span />
                      )}
                    </span>
                  </Button>
                );
              })}
            </div>
            {activeRoutine && (
              <>
                <div className="panel-heading exercise-preview-heading">
                  <h2>{t("dashboard.sessionExercises", "In your session")}</h2>
                  <span>
                    {t("dashboard.exerciseTotal", "{{total}} exercises", {
                      total: activeRoutine.ex.length,
                    })}
                  </span>
                </div>
                <div>
                  {activeRoutine.ex.slice(0, 3).map((exercise) => {
                    const data = exerciseMetadata(exercise.id);
                    return (
                      <Button
                        variant="plain"
                        type="button"
                        className="exercise-preview-row"
                        key={exercise.id}
                        onClick={viewRoutine}
                      >
                        <span className="exercise-preview-icon">
                          <Dumbbell size={23} />
                        </span>
                        <span className="exercise-preview-name">
                          <strong>{data?.n || exercise.id}</strong>
                          <small>{data?.bp ? metadata.bodyPart(data.bp) : ""}</small>
                        </span>
                        <span className="exercise-preview-sets">
                          {exercise.sets} ×{" "}
                          {exercise.mode === "time"
                            ? `${exercise.sec ?? 30}s`
                            : exercise.min
                              ? `${exercise.min}m`
                              : (exercise.reps ?? 8)}
                        </span>
                        <ChevronRight size={15} />
                      </Button>
                    );
                  })}
                </div>
                <Button
                  variant="plain"
                  type="button"
                  className="panel-link preview-link"
                  onClick={viewRoutine}
                >
                  {t("dashboard.viewFullWorkout", "View full workout")}
                  <ArrowRight size={14} />
                </Button>
              </>
            )}
            {!activeRoutine && (
              <div className="week-empty">
                <CalendarDays size={22} />
                <p>{t("dashboard.planDay", "Select a day to plan your next session.")}</p>
                <Button
                  variant="plain"
                  type="button"
                  className="panel-link"
                  onClick={() => void navigate({ to: "/plan" })}
                >
                  {t("dashboard.editSchedule", "Edit weekly schedule")}
                  <ArrowRight size={14} />
                </Button>
              </div>
            )}
          </section>
        </div>
        <div className="dashboard-secondary">
          <section className="dashboard-panel volume-panel">
            <div className="panel-heading">
              <div>
                <h2>{t("dashboard.trainingVolume", "Training volume")}</h2>
                <p>{t("dashboard.volumeDescription", "The work you've put in, week by week.")}</p>
              </div>
              <NativeSelect
                aria-label={t("dashboard.chartRange", "Chart time range")}
                value={chartWeeks}
                onChange={(event) => setChartWeeks(Number(event.target.value))}
              >
                <NativeSelectOption value={6}>
                  {t("dashboard.sixWeeks", "6 weeks")}
                </NativeSelectOption>
                <NativeSelectOption value={12}>
                  {t("dashboard.twelveWeeks", "12 weeks")}
                </NativeSelectOption>
              </NativeSelect>
            </div>
            <figure
              className="volume-chart"
              aria-label={t("dashboard.volumeChart", "Weekly training volume in {{unit}}", {
                unit: state.unit,
              })}
            >
              <div className="volume-chart-scale">
                <span>
                  {fmtNum(maxVolume)} {state.unit}
                </span>
                <span>{fmtNum(maxVolume / 2)}</span>
                <span>0</span>
              </div>
              <div className="volume-bars">
                {trend.map((week, index) => (
                  <div
                    className="volume-bar-column"
                    key={week.date}
                    title={`${fmtDate(t, week.date)}: ${fmtNum(week.volume)} ${state.unit}`}
                  >
                    <span className="bar-value">
                      {week.volume >= 1000
                        ? `${Math.round(week.volume / 100) / 10}k`
                        : fmtNum(week.volume)}
                    </span>
                    <div
                      className={`volume-bar ${index === trend.length - 1 ? "is-current" : ""}`}
                      style={{ height: `${Math.max(1, (week.volume / maxVolume) * 132)}px` }}
                    />
                    <span className="bar-date">
                      {formatDate(t, new Date(week.date + "T12:00:00"), {
                        day: "numeric",
                        month: "short",
                      })}
                    </span>
                  </div>
                ))}
              </div>
            </figure>
            {summary.sessions === 0 && (
              <p className="chart-empty-note">
                {t(
                  "dashboard.chartEmpty",
                  "Log your first workout this week to start building momentum.",
                )}
              </p>
            )}
          </section>
          <section className="dashboard-panel activity-panel">
            <div className="panel-heading">
              <h2>{t("dashboard.recentActivity", "Recent activity")}</h2>
              <Button
                variant="plain"
                type="button"
                className="panel-link"
                onClick={() => void navigate({ to: "/history" })}
              >
                {t("dashboard.viewAll", "View all")}
                <ArrowRight size={14} />
              </Button>
            </div>
            {recent.length ? (
              <div>
                {recent.map((workout) => (
                  <Button
                    variant="plain"
                    type="button"
                    className="recent-workout"
                    key={workout.id}
                    onClick={() =>
                      void navigate({
                        to: "/home/workout/$workoutId",
                        params: { workoutId: workout.id },
                        resetScroll: false,
                      })
                    }
                  >
                    <span className="activity-check">
                      <Check size={16} strokeWidth={2.5} />
                    </span>
                    <span>
                      <strong>{workout.name}</strong>
                      <small>
                        {fmtNum(workout.vol)} {state.unit}
                        {workout.end > workout.start
                          ? ` · ${fmtDur(workout.end - workout.start)}`
                          : ""}
                      </small>
                    </span>
                    <span className="activity-date">
                      {fmtDate(t, workout.d)}
                      <ChevronRight size={14} />
                    </span>
                  </Button>
                ))}
              </div>
            ) : (
              <div className="empty-activity">
                <Dumbbell size={28} />
                <p>{t("dashboard.historyEmpty", "Your story starts with your first set.")}</p>
                <Button variant="plain" type="button" className="panel-link" onClick={start}>
                  {t("workout.startWorkout", "Start workout")}
                  <ArrowRight size={14} />
                </Button>
              </div>
            )}
            <div className="consistency-note">
              <Activity size={24} />
              <p>
                <strong>
                  {summary.sessions
                    ? t(
                        "dashboard.sessionsLogged",
                        "Sessions logged this week: {{total}}. Keep your rhythm.",
                        { total: summary.sessions },
                      )
                    : t("dashboard.freshStart", "A fresh week. A new opportunity.")}
                </strong>
                <span>{t("dashboard.smallSteps", "Small steps. Real progress.")}</span>
              </p>
            </div>
          </section>
          {latest && (
            <Button
              variant="plain"
              type="button"
              className="progress-highlight"
              onClick={() => void navigate({ to: "/stats" })}
            >
              <span className="progress-trophy">
                <Trophy size={21} />
              </span>
              <span>
                <small>{t("dashboard.latestStrength", "Latest strength signal")}</small>
                <strong>{latest.exerciseName}</strong>
                <span>
                  {fmtNum(latest.estimate)} {state.unit} {t("stats.est1rm", "estimated 1RM")}
                </span>
              </span>
              <ArrowUpRight size={20} />
            </Button>
          )}
        </div>
      </div>
      <section className="quick-actions">
        <h2>{t("dashboard.quickActions", "Quick actions")}</h2>
        <Button
          variant="plain"
          type="button"
          onClick={() => void navigate({ to: "/home/bodyweight", resetScroll: false })}
        >
          <Scale size={21} />
          <span>
            {t("dashboard.logWeight", "Log body weight")}
            <small>
              {weight
                ? `${fmtNum(weight.w)} ${state.unit}`
                : t("dashboard.trackTrend", "Track your trend")}
            </small>
          </span>
          <Plus size={15} />
        </Button>
        <Button
          variant="plain"
          type="button"
          onClick={() => void navigate({ to: "/home/measures", resetScroll: false })}
        >
          <Ruler size={21} />
          <span>
            {t("dashboard.measurements", "Body measurements")}
            <small>{t("dashboard.beyondScale", "Beyond the scale")}</small>
          </span>
        </Button>
        <Button variant="plain" type="button" onClick={() => void navigate({ to: "/tools" })}>
          <Layers3 size={21} />
          <span>
            {t("dashboard.calculatePlates", "Calculate plates")}
            <small>{t("dashboard.loadWithConfidence", "Load with confidence")}</small>
          </span>
        </Button>
        <Button
          variant="plain"
          type="button"
          onClick={() => void navigate({ to: "/home/curated", resetScroll: false })}
        >
          <Target size={21} />
          <span>
            {t("dashboard.browsePrograms", "Browse programs")}
            <small>{t("dashboard.findYourPlan", "Find your next plan")}</small>
          </span>
        </Button>
      </section>
      <BodySignals />
      {user && (
        <Button
          variant="plain"
          type="button"
          className="ai-dashboard-link"
          onClick={() => void navigate({ to: "/home/ai", resetScroll: false })}
        >
          <Sparkles size={18} />
          {t("home.personalizeSessionAi", "Personalize this session with AI")}
          <ArrowRight size={16} />
        </Button>
      )}
      <Outlet />
    </div>
  );
}

function ChartIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" width="22" height="22" aria-hidden="true">
      <rect x="3" y="14" width="4" height="7" rx="1" />
      <rect x="10" y="8" width="4" height="13" rx="1" />
      <rect x="17" y="3" width="4" height="18" rx="1" />
    </svg>
  );
}
