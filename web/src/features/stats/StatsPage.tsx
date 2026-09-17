import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "@tanstack/react-router";
import { useStore } from "@/app/store/useStore";
import { EXIDX } from "@/domain/exercises/exercises";
import { modeOf, isWarmup } from "@/domain/training/history";
import { e1rmSeries, best1RM } from "@/domain/training/onerm";
import { hasEffort, displayScale, scaleName, toScale, avgRir } from "@/domain/training/effort";
import { fmtNum } from "@/shared/lib/format";
import { BodyweightLogSheet, GoalSheet } from "@/features/account/AccountSheet";
import {
  Calendar,
  WorkoutDetail,
  WorkoutRow,
  type HistorySheetActions,
} from "@/features/history/HistorySheet";
import { DayOverride } from "@/features/plan/PlansSheet";
import { CalendarDaySheet } from "@/features/stats/CalendarDaySheet";
import { EffortCard } from "@/features/stats/EffortCard";
import { MuscleBalance } from "@/features/stats/MuscleBalance";
import {
  ProgressCards,
  type ExercisePoint,
  type StatsMetric,
  type StatsRange,
} from "@/features/stats/ProgressCards";
import { StatsHeaderAndActivity } from "@/features/stats/StatsHeaderAndActivity";
import { loggedMetric, ratingOf, sheetTitle, type StatsSheet } from "@/features/stats/stats-types";
import Icon from "@/shared/components/Icon";
import { Grid } from "@/shared/components/Grid";
import { Button } from "@/shared/ui/button";
import { Sheet, SheetContent, SheetTitle } from "@/shared/ui/sheet";

// Stats = the analytics hub: all charts, progress and history live here.
export default function Stats() {
  const { t } = useTranslation();
  const nav = useNavigate();
  const appState = useStore((state) => state.appState);
  const [activeSheet, setActiveSheet] = useState<StatsSheet | null>(null);
  const closeSheet = () => {
    setActiveSheet(null);
    return Promise.resolve();
  };
  const historySheetActions: HistorySheetActions = {
    onDayOverride: (iso) => setActiveSheet({ kind: "day-override", iso }),
    onWorkoutDetail: (workout) => setActiveSheet({ kind: "workout", workout }),
    onCalendarDay: (iso, workouts) => setActiveSheet({ kind: "calendar-day", iso, workouts }),
  };
  const [rangeDays, setRangeDays] = useState<StatsRange>("90");
  const rangeDayCount = Number(rangeDays);
  const [exId, setExId] = useState<string | null>(null);
  const [exMetric, setExMetric] = useState<StatsMetric>("top");
  const [now] = useState(() => Date.now());
  const anyEffort = hasEffort(appState);
  const kind = displayScale(appState);
  const hd = scaleName(kind);
  // Same collapse as EffortCard: every rir reaching toScale here is known-rated.
  const scaled = (rir: number) => {
    const v = toScale(kind, rir);
    return v == null ? 0 : v;
  };
  const bwPts = appState.bodyweight.flatMap((bodyweight) => {
    const timestamp = bodyweight.t || new Date(bodyweight.d).getTime();
    return rangeDayCount === 0 || timestamp > now - rangeDayCount * 86400000
      ? [{ t: timestamp, y: bodyweight.w, d: bodyweight.d }]
      : [];
  });
  // Deleted custom exercises still have a useful history name in their snapshot. Keep them in
  // the picker instead of reducing a real progression curve to an opaque id after deletion.
  const historicalNames = new Map<string, string>();
  appState.workouts.forEach((workout) =>
    workout.entries.forEach((entry) => {
      const name = entry.muscleSnapshot?.n || entry.n;
      if (name && !historicalNames.has(entry.id)) historicalNames.set(entry.id, name);
    }),
  );
  const exerciseName = (id: string) => EXIDX[id]?.n || historicalNames.get(id) || id;
  const exHist = [...new Set(appState.workouts.flatMap((w) => w.entries.map((e) => e.id)))]
    .filter((id) => EXIDX[id] || historicalNames.has(id))
    .sort((a, b) => exerciseName(a).localeCompare(exerciseName(b)) || a.localeCompare(b));
  const curEx = exId && exHist.includes(exId) ? exId : exHist[0] || null;
  // How this exercise was logged most recently decides what the curve means: top weight,
  // longest hold or top speed. Sets logged in another mode lack the field and score 0, so a
  // switched exercise drops its old points instead of mixing seconds into a weight chart.
  const curMode = curEx
    ? (() => {
        for (let i = appState.workouts.length - 1; i >= 0; i--) {
          const en = appState.workouts[i].entries.find((e) => e.id === curEx);
          if (en) return modeOf({ ...en.target, id: curEx });
        }
        return modeOf({ id: curEx });
      })()
    : "reps";
  const curCardio = curMode === "cardio";
  const curTimed = curMode === "time";
  const exUnit = curCardio ? "km/h" : curTimed ? "s" : appState.unit;
  const exPts: ExercisePoint[] = [];
  let exList = exPts;
  let exBest = 0;
  if (curEx) {
    appState.workouts.forEach((w) => {
      const en = w.entries.find((e) => e.id === curEx);
      if (en) {
        const doneSets = en.sets.filter((s) => s.done && !isWarmup(s));
        const mx = Math.max(
          0,
          ...doneSets.map(loggedMetric),
          curCardio || curTimed ? 0 : en.topW || 0,
        );
        if (mx > 0) {
          exPts.push({
            t: w.start,
            y: mx,
            d: w.d,
            sets: doneSets,
            target: en.target ?? null,
          });
          if (mx > exBest) exBest = mx;
        }
      }
    });
    exList = exPts.slice(-5).reverse();
  }
  // Estimated 1RM (issue #18) — only reps-mode training produces one, so cardio and timed
  // work simply have no points and the toggle stays hidden.
  const e1Pts = curEx ? e1rmSeries(appState, curEx) : [];
  const e1Best = curEx ? best1RM(appState, curEx) : null;
  const showE1 = e1Pts.length > 0;
  // Effort on this exercise, per session. It rides on the top-set curve as well as having a
  // curve of its own, because the two only mean something together: the same weight moved
  // with more left in the tank is progress a weight-only chart draws as a flat line.
  const exRir = exPts.map((p) => avgRir(p.sets.map(ratingOf)));
  const showEff = exRir.filter((v) => v != null).length >= 3;
  const effPts = exPts
    .map((p, i) => {
      const r = exRir[i];
      return r == null ? null : { t: p.t, y: scaled(r), d: p.d };
    })
    .filter((p): p is NonNullable<typeof p> => p != null);
  const onE1 = showE1 && exMetric === "e1rm";
  const onEff = showEff && exMetric === "effort";
  const topPts = exPts.map((p, i) => {
    const r = exRir[i];
    return {
      t: p.t,
      y: p.y,
      d: p.d,
      // 0 RIR (nothing left) is a full dot, 4+ a faint one; unrated sessions keep the plain line.
      m: r == null ? null : 1 - Math.min(4, Math.max(0, r)) / 4,
      note: r == null ? undefined : hd + " " + fmtNum(scaled(r)),
    };
  });
  const exOpts: { value: StatsMetric; label: string }[] = [
    { value: "top", label: t("progression.topSet", "Top set") },
  ];
  if (showE1) exOpts.push({ value: "e1rm", label: t("progression.est1rm", "Est. 1RM") });
  if (showEff) exOpts.push({ value: "effort", label: t("stats.effort.effort", "Effort") });

  return (
    <>
      <StatsHeaderAndActivity appState={appState} onSheet={setActiveSheet} />

      {appState.workouts.length > 0 && <MuscleBalance appState={appState} />}
      {anyEffort && <EffortCard appState={appState} />}
      <ProgressCards
        appState={appState}
        rangeDays={rangeDays}
        setRangeDays={setRangeDays}
        bwPts={bwPts}
        exHist={exHist}
        curEx={curEx}
        setExId={setExId}
        exOpts={exOpts}
        setExMetric={setExMetric}
        onE1={onE1}
        onEff={onEff}
        effPts={effPts}
        topPts={topPts}
        e1Pts={e1Pts}
        kind={kind}
        hd={hd}
        exUnit={exUnit}
        exList={exList}
        exBest={exBest}
        e1Best={e1Best}
        curCardio={curCardio}
        curTimed={curTimed}
        showEff={showEff}
        exerciseName={exerciseName}
        onSheet={setActiveSheet}
      />

      {appState.workouts.length > 0 && (
        <>
          <div className="mb-2.5 flex items-center justify-between gap-3">
            <h2 className="m-0 px-1 text-sm font-normal tracking-tight text-foreground/60">
              {t("stats.recentWorkouts", "Recent workouts")}
            </h2>
            <Button size="sm" variant="ghost" onClick={() => void nav({ to: "/history" })}>
              {t("common.all", "All")} {appState.workouts.length}
              <Icon name="chevronRight" />
            </Button>
          </div>
          <Grid columns={{ default: 1, lg: 2 }} gap="xs">
            {[...appState.workouts]
              .reverse()
              .slice(0, 6)
              .map((w) => (
                <WorkoutRow
                  key={w.id}
                  workout={w}
                  onClick={() => setActiveSheet({ kind: "workout", workout: w })}
                />
              ))}
          </Grid>
        </>
      )}
      <Sheet
        open={activeSheet !== null}
        onOpenChange={(open) => {
          if (!open) setActiveSheet(null);
        }}
      >
        <SheetContent
          side="bottom"
          className="max-h-screen touch-pan-y overflow-y-auto overscroll-contain rounded-2xl bg-sheet p-2 px-4.5 pb-5 lg:inset-x-auto lg:left-1/2 lg:w-160 lg:-translate-x-1/2"
          showCloseButton={false}
        >
          {activeSheet && <SheetTitle className="sr-only">{sheetTitle(activeSheet, t)}</SheetTitle>}
          <div className="mx-auto mt-1.5 mb-3.5 h-1 w-9 rounded-full bg-foreground/20" />
          {activeSheet?.kind === "bodyweight" && <BodyweightLogSheet close={closeSheet} />}
          {activeSheet?.kind === "goal" && <GoalSheet close={closeSheet} />}
          {activeSheet?.kind === "calendar" && (
            <Calendar close={closeSheet} start={activeSheet.start} {...historySheetActions} />
          )}
          {activeSheet?.kind === "calendar-day" && (
            <CalendarDaySheet
              close={closeSheet}
              iso={activeSheet.iso}
              workouts={activeSheet.workouts}
              onWorkoutDetail={historySheetActions.onWorkoutDetail}
            />
          )}
          {activeSheet?.kind === "workout" && (
            <WorkoutDetail workoutId={activeSheet.workout.id} close={closeSheet} />
          )}
          {activeSheet?.kind === "day-override" && (
            <DayOverride iso={activeSheet.iso} close={closeSheet} />
          )}
        </SheetContent>
      </Sheet>
    </>
  );
}
