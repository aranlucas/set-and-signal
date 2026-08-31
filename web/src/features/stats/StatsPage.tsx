import { useState } from "react";
import type { TFunction } from "i18next";
import { useTranslation } from "react-i18next";
import { useMuscleLabels } from "@/shared/hooks/use-muscle-labels";
import { useNavigate } from "@tanstack/react-router";
import { useStore } from "@/app/store/useStore";
import { EXIDX } from "@/domain/exercises/exercises";
import {
  lastBW,
  streakWeeks,
  setLabel,
  modeOf,
  effortOf,
  isWarmup,
} from "@/domain/training/history";
import { fmtNum, fmtDate, todayISO, weekKey } from "@/shared/lib/format";
import { BodyweightLogSheet, GoalSheet } from "@/features/account/AccountSheet";
import {
  Calendar,
  WorkoutDetail,
  WorkoutRow,
  type HistorySheetActions,
} from "@/features/history/HistorySheet";
import { DayOverride } from "@/features/plan/PlansSheet";
import LineChart from "@/shared/components/LineChart";
import Heatmap from "@/shared/components/Heatmap";
import Icon from "@/shared/components/Icon";
import BodyMap, { BodyMapLegend } from "@/shared/components/BodyMap";
import { loadOfWorkouts, rankOf } from "@/domain/exercises/muscles";
import type { MuscleSlug } from "@/domain/exercises/muscles";
import { e1rmSeries, best1RM } from "@/domain/training/onerm";
import {
  hasEffort,
  displayScale,
  scaleName,
  toScale,
  avgRir,
  effortSummary,
  effortWeeks,
  effortHistogram,
  isHardSet,
  HARD_RIR,
} from "@/domain/training/effort";
import { Button } from "@/shared/ui/button";
import { Segmented } from "@/shared/components/Segmented";
import { SelectRow } from "@/shared/components/SelectRow";
import { Grid } from "@/shared/components/Grid";
import { MetricCard } from "@/shared/components/MetricCard";
import type { AppState, ExConfig, IsoDate, LoggedSet, Workout } from "@/shared/lib/types";
import { Sheet, SheetContent, SheetTitle } from "@/shared/ui/sheet";

type StatsSheet =
  | { kind: "bodyweight" }
  | { kind: "goal" }
  | { kind: "calendar"; start?: IsoDate }
  | { kind: "calendar-day"; iso: IsoDate; workouts: Workout[] }
  | { kind: "workout"; workout: Workout }
  | { kind: "day-override"; iso: IsoDate };

type Translate = TFunction;

const sheetTitle = (active: StatsSheet, t: Translate): string => {
  switch (active.kind) {
    case "bodyweight":
      return t("weight.logBodyWeight", "Log body weight");
    case "goal":
      return t("weight.targetWeight", "Target weight");
    case "calendar":
      return t("calendar.workoutCalendar", "Workout calendar");
    case "calendar-day":
      return fmtDate(t, active.iso, true);
    case "workout":
      return active.workout.name;
    case "day-override":
      return fmtDate(t, active.iso, true);
  }
};

const weightDeltaColor = (
  delta: number | null | undefined,
  currentW: number,
  targetW: number | null,
) => {
  if (!delta) return "var(--muted-foreground)";
  if (!targetW) return "var(--foreground)";
  const up = targetW > currentW;
  return delta > 0 === up ? "var(--primary)" : "var(--destructive)";
};

// Cardio sets carry neither rating field; the raters only ever read these two keys.
const ratingOf = (set: LoggedSet): { rir?: number | null; rpe?: number | null } =>
  "rir" in set || "rpe" in set ? set : {};
// Cardio sets carry speed, timed sets sec, reps sets weight. Read the shape so
// mixed-mode history scores an absent field as zero instead of combining units.
const loggedMetric = (set: LoggedSet): number =>
  "speed" in set ? set.speed || 0 : "sec" in set ? set.sec || 0 : set.w || 0;

function StatsHeaderAndActivity({
  appState,
  onSheet,
}: {
  appState: AppState;
  onSheet: (sheet: StatsSheet) => void;
}) {
  const { t } = useTranslation();
  const nav = useNavigate();
  const [now] = useState(() => Date.now());
  const recentBodyweight = appState.bodyweight.filter(
    (bodyweight) => (bodyweight.t || new Date(bodyweight.d).getTime()) > now - 30 * 86400000,
  );
  const bodyweightDelta =
    recentBodyweight.length > 1 ? recentBodyweight.at(-1)!.w - recentBodyweight[0]!.w : null;
  const monthWorkouts = appState.workouts.filter(
    (workout) => workout.d.slice(0, 7) === todayISO().slice(0, 7),
  ).length;
  return (
    <>
      <div className="mt-2 mb-4.5 flex items-end justify-between gap-3">
        <div>
          <h1 className="text-4xl leading-none font-bold tracking-tight">
            {t("navigation.stats", "Stats")}
          </h1>
          <div className="mt-1 text-base tracking-tight text-foreground/60">
            {t("stats.progressHistory", "Progress & history")}
          </div>
        </div>
        <button
          className="flex size-9 flex-none items-center justify-center rounded-full bg-card text-lg text-foreground transition duration-140 active:scale-95 active:bg-muted"
          onClick={() => nav({ to: "/history" })}
          aria-label={t("navigation.history", "History")}
        >
          <Icon name="history" />
        </button>
      </div>
      <Grid columns={{ default: 2, lg: 4 }} className="mb-3">
        <StatsTile
          icon="dumbbell"
          label={t("stats.workouts", "Workouts")}
          value={appState.workouts.length}
        />
        <StatsTile
          icon="calendar"
          label={t("stats.thisMonth", "This month")}
          value={monthWorkouts}
        />
        <StatsTile
          icon="flame"
          label={t("stats.weekStreak", "Week streak")}
          value={streakWeeks(appState)}
        />
        <StatsTile
          icon="scale"
          label={t("stats.weight30d", "Weight 30d")}
          value={
            bodyweightDelta === null
              ? "—"
              : (bodyweightDelta > 0 ? "+" : "") + fmtNum(bodyweightDelta) + " " + appState.unit
          }
          valueColor={
            bodyweightDelta === null
              ? "inherit"
              : weightDeltaColor(bodyweightDelta, lastBW(appState)?.w || 0, appState.targetW)
          }
        />
      </Grid>
      <div className="mb-3 rounded-lg bg-card p-4">
        <h2 className="m-0 mb-3 text-sm font-normal tracking-tight text-foreground/60">
          {t("stats.activityLast12Months", "Activity — last 12 months")}{" "}
          <span className="text-sm font-normal tracking-normal text-muted-foreground">
            · {t("stats.timeTrained", "by time trained")}
          </span>
        </h2>
        <Heatmap
          appState={appState}
          onDay={(iso) => {
            const workouts = appState.workouts.filter((workout) => workout.d === iso);
            if (workouts.length === 1) onSheet({ kind: "workout", workout: workouts[0] });
            else if (workouts.length > 0) onSheet({ kind: "calendar", start: iso });
          }}
        />
      </div>
    </>
  );
}

function StatsTile({
  icon,
  label,
  value,
  valueColor,
}: {
  icon: "dumbbell" | "calendar" | "flame" | "scale";
  label: string;
  value: string | number;
  valueColor?: string;
}) {
  return (
    <MetricCard>
      <div className="flex items-center gap-1.5 text-sm text-foreground/60">
        <Icon name={icon} />
        {label}
      </div>
      <div
        className="mt-1 text-3xl leading-tight font-semibold tracking-tight"
        style={{ color: valueColor }}
      >
        {value}
      </div>
    </MetricCard>
  );
}
// Which muscles the training in a window actually hit — and, the point of the card,
// which ones it keeps missing. Shading is relative within the window (lib/muscles.js).
function MuscleBalance({ appState }: { appState: AppState }) {
  const { t } = useTranslation();
  const muscleLabels = useMuscleLabels();
  const [windowDays, setWindowDays] = useState<"7" | "30" | "90" | "0">("7");
  const windowDayCount = Number(windowDays);
  const [hard, setHard] = useState(false);
  const [sel, setSel] = useState<MuscleSlug | null>(null);
  const [now] = useState(() => Date.now());
  const inWin = appState.workouts.filter((w) =>
    windowDayCount === 0
      ? true
      : windowDayCount === 7
        ? weekKey(w.d) === weekKey(todayISO())
        : (w.start || new Date(w.d).getTime()) > now - windowDayCount * 86400000,
  );
  // Counting only the sets taken near failure turns the map from "where did the volume go"
  // into "where did the stimulus go" — a muscle can lead on sets and still never be trained
  // hard. Offered only when the window holds ratings at all, since with none the hard map
  // would just be empty and read as "you trained nothing".
  const rated = inWin.some((w) =>
    w.entries.some((e) => e.sets.some((s) => s.done && isHardSet(ratingOf(s)))),
  );
  const on = hard && rated;
  const load = loadOfWorkouts(inWin, on ? (s: LoggedSet) => isHardSet(ratingOf(s)) : undefined);
  const { worked, missed } = rankOf(load);
  const top = worked.slice(0, 4);
  const max = (worked.length > 0 ? load[worked[0]] : 0) ?? 0;
  const sets = (m: MuscleSlug) => Math.round((load[m] || 0) * 10) / 10;
  return (
    <div className="mb-3 rounded-lg bg-card p-4">
      <div className="mb-2 flex items-center justify-between gap-3">
        <h2 className="m-0 mb-3 text-sm font-normal tracking-tight text-foreground/60">
          {t("muscleMap.muscleBalance", "Muscle balance")}{" "}
          <span className="text-sm font-normal tracking-normal text-muted-foreground">
            ·{" "}
            {on
              ? t("stats.effort.hardSets", "by hard sets")
              : t("muscleMap.setsWorked", "by sets worked")}
          </span>
        </h2>
        {rated && (
          <Button
            size="sm"
            onClick={() => {
              setHard((h) => !h);
              setSel(null);
            }}
          >
            <Icon name="flame" />
            {on ? t("stats.effort.hard", "Hard") : t("common.all", "All")}
          </Button>
        )}
      </div>
      {/* Segmented is string-keyed; the day windows ride through String()/Number() */}
      <Segmented<"7" | "30" | "90" | "0">
        className="mb-2.5"
        value={windowDays}
        onChange={(nextWindowDays) => {
          setWindowDays(nextWindowDays);
          setSel(null);
        }}
        options={[
          { value: "7", label: t("muscleMap.week", "Week") },
          { value: "30", label: "30d" },
          { value: "90", label: "90d" },
          { value: "0", label: t("common.all", "All") },
        ]}
      />
      {inWin.length > 0 ? (
        <>
          <BodyMap
            load={load}
            body={appState.body}
            selected={sel}
            onMuscle={(muscle) =>
              setSel((selectedMuscle) => (selectedMuscle === muscle ? null : muscle))
            }
          />
          <BodyMapLegend />
          {sel && (
            <div className="mt-1 flex items-center gap-2.5 border-t border-border/60 py-1.5 pt-2.5">
              <span className="min-w-0 flex-1 overflow-hidden text-sm text-ellipsis whitespace-nowrap">
                <b>{muscleLabels[sel]}</b>
              </span>
              <span className="min-w-13 flex-none text-right text-xs text-foreground/60">
                {sets(sel)
                  ? t("workout.completion.sets", "{{count}} sets", { count: sets(sel) })
                  : on
                    ? t("stats.effort.noHardSets", "no hard sets")
                    : t("muscleMap.notTrained", "not trained")}
              </span>
            </div>
          )}
          {!sel &&
            top.map((m) => (
              <div key={m} className="flex items-center gap-2.5 py-1.5">
                <span className="min-w-0 flex-1 overflow-hidden text-sm text-ellipsis whitespace-nowrap">
                  {muscleLabels[m]}
                </span>
                <span className="h-1 w-18.5 flex-none overflow-hidden rounded-none bg-muted">
                  <i
                    className={`block h-full rounded-none ${on ? "bg-yellow-400" : "bg-primary"}`}
                    style={{
                      width: Math.round(((load[m] || 0) / max) * 100) + "%",
                    }}
                  />
                </span>
                <span className="min-w-13 flex-none text-right text-xs text-foreground/60">
                  {t("workout.completion.sets", "{{count}} sets", { count: sets(m) })}
                </span>
              </div>
            ))}
          {missed.length > 0 && (
            <>
              <h2 className="mt-3 mb-2 px-1 text-sm font-normal tracking-tight text-foreground/60">
                {on
                  ? t("stats.effort.noHardSetsPeriod", "No hard sets in this period")
                  : t("muscleMap.notTrainedPeriod", "Not trained in this period")}
              </h2>
              <div className="mt-1 flex flex-wrap gap-1.5">
                {missed.map((m) => (
                  <span
                    key={m}
                    className="rounded-full bg-orange-500/15 px-2.5 py-1 text-xs text-active"
                  >
                    {muscleLabels[m]}
                  </span>
                ))}
              </div>
            </>
          )}
          {missed.length === 0 && worked.length > 0 && (
            <div className="mt-2.5 text-sm leading-snug text-foreground/60">
              {on
                ? t(
                    "stats.effort.everyMuscleGroupGotLeast",
                    "Every muscle group got at least one hard set in this period.",
                  )
                : t(
                    "muscleMap.everyMuscleGroupGotSome",
                    "Every muscle group got some work in this period.",
                  )}
            </div>
          )}
        </>
      ) : (
        <div className="text-sm leading-snug text-foreground/60">
          {t("muscleMap.noWorkoutsPeriodYet", "No workouts in this period yet.")}
        </div>
      )}
    </div>
  );
}

// How hard the training was — the half of the picture a volume chart cannot show. Everything
// is computed in RIR (lib/effort.js) and converted to whichever scale this profile reads.
// Every number carries how much of the training it speaks for: rating is optional and off by
// default, so a partly rated history is the normal case, and an average without its
// denominator would quietly speak for sets that were never rated.
function EffortCard({ appState }: { appState: AppState }) {
  const { t } = useTranslation();
  const [windowDays, setWindowDays] = useState<"30" | "90" | "365" | "0">("90");
  const windowDayCount = Number(windowDays);
  const kind = displayScale(appState);
  const hd = scaleName(kind);
  // Every rir this card hands toScale is already known-rated, so the null arm of
  // toScale never fires; collapse it once here instead of at each call site.
  const scaled = (rir: number) => {
    const v = toScale(kind, rir);
    return v == null ? 0 : v;
  };
  const weeks = effortWeeks(appState, windowDayCount);
  const hist = effortHistogram(appState, windowDayCount);
  const sum = effortSummary(appState, windowDayCount);
  const maxBin = Math.max(1, ...hist.map((b) => b.n));
  // The week's set count rides along in the tooltip, because the pair is the reading:
  // volume up with effort up is fatigue piling up, volume up with effort flat is adaptation.
  const pts = weeks.map((w) => ({
    t: w.t,
    y: scaled(w.rir),
    note: t("workout.completion.sets", "{{count}} sets", { count: w.sets }),
  }));
  // Bins run hardest-first in both scales: RIR 0 and RPE 10 are the same set.
  const binLabel = (b: (typeof hist)[number]) =>
    kind === "rpe" ? (b.tail ? "≤ 6" : String(10 - b.rir)) : b.tail ? b.rir + "+" : String(b.rir);

  return (
    <div className="mb-3 rounded-lg bg-card p-4">
      <h2 className="m-0 mb-3 text-sm font-normal tracking-tight text-foreground/60">
        {t("stats.effort.effort", "Effort")}{" "}
        <span className="text-sm font-normal tracking-normal text-muted-foreground">
          · {t("stats.effort.howCloseFailure", "how close to failure")}
        </span>
      </h2>
      <Segmented<"30" | "90" | "365" | "0">
        className="mb-2.5"
        value={windowDays}
        onChange={setWindowDays}
        options={[
          { value: "30", label: "30d" },
          { value: "90", label: "90d" },
          { value: "365", label: "1Y" },
          { value: "0", label: t("common.all", "All") },
        ]}
      />
      {sum.rated === 0 ? (
        <div className="text-sm leading-snug text-foreground/60">
          {t("stats.effort.noRatedSetsPeriod", "No rated sets in this period.")}
        </div>
      ) : (
        <>
          <div className="flex items-end justify-between gap-3">
            <div>
              <div className="text-3xl leading-tight font-semibold tracking-tight">
                {sum.avg == null ? "—" : fmtNum(scaled(sum.avg)) + " " + hd}
              </div>
              <div className="text-sm leading-snug text-muted-foreground">
                {t("stats.effort.averageEffort", "average effort")}
              </div>
            </div>
            <div className="text-right">
              <div className="text-3xl leading-tight font-semibold tracking-tight text-warning">
                {sum.hardPct == null ? "—" : Math.round(sum.hardPct * 100) + "%"}
              </div>
              <div className="text-sm leading-snug text-muted-foreground">
                {t("stats.effort.atOrHarder", "at {{scale}} {{rating}} or harder", {
                  scale: hd,
                  rating: fmtNum(scaled(HARD_RIR)),
                })}
              </div>
            </div>
          </div>
          <div className="mt-2 text-sm leading-snug text-muted-foreground">
            {t("stats.effort.finishedSetsRated", "{{rated}} of {{total}} finished sets rated", {
              rated: sum.rated,
              total: sum.done,
            })}
          </div>
          {effortOf(appState) === "none" && (
            <div className="mt-1 text-sm leading-snug text-warning">
              {t(
                "stats.effort.effortPerSetSwitchedOff",
                "Effort per set is switched off — turn it on in Settings to keep rating.",
              )}
            </div>
          )}
          {pts.length > 1 && (
            <>
              <h2 className="mt-3 mb-2 px-1 text-sm font-normal tracking-tight text-foreground/60">
                {t("stats.effort.weekWeek", "Week by week")}
              </h2>
              <div className="w-full overflow-hidden [&_svg]:block [&_svg]:h-auto [&_svg]:w-full">
                <LineChart
                  points={pts}
                  height={140}
                  unit={hd}
                  color="var(--warning)"
                  invert={kind === "rir"}
                />
              </div>
            </>
          )}
          <h2 className="mt-3 mb-2 px-1 text-sm font-normal tracking-tight text-foreground/60">
            {t("stats.effort.whereSetsLand", "Where the sets land")}
          </h2>
          {hist.map((b) => (
            <div key={b.rir} className="flex items-center gap-2.5 py-1.5">
              <span className="min-w-0 flex-1 overflow-hidden text-sm text-ellipsis whitespace-nowrap">
                {hd} {binLabel(b)}
              </span>
              <span className="h-1 w-18.5 flex-none overflow-hidden rounded-none bg-muted">
                <i
                  className={`block h-full rounded-none ${b.rir <= HARD_RIR ? "bg-yellow-400" : "bg-foreground/30"}`}
                  style={{ width: Math.round((b.n / maxBin) * 100) + "%" }}
                />
              </span>
              <span className="min-w-13 flex-none text-right text-xs text-foreground/60">
                {b.n ? b.n + " · " + Math.round(b.pct * 100) + "%" : "—"}
              </span>
            </div>
          ))}
          <div className="mt-2 text-sm leading-snug text-muted-foreground">
            {t(
              "stats.effort.mostWorkingSetsBelongClose",
              "Most working sets belong close to failure without living there — half at the floor and half at the top average out to a healthy-looking middle.",
            )}
          </div>
        </>
      )}
    </div>
  );
}

type StatsRange = "30" | "90" | "365" | "0";
type StatsMetric = "top" | "e1rm" | "effort";
type ProgressPoint = { t: number; y: number; d: string };
type ExercisePoint = ProgressPoint & { sets: LoggedSet[]; target: ExConfig | null };

type ProgressCardsProps = {
  appState: AppState;
  rangeDays: StatsRange;
  setRangeDays: (value: StatsRange) => void;
  bwPts: ProgressPoint[];
  exHist: string[];
  curEx: string | null;
  setExId: (value: string) => void;
  exOpts: { value: StatsMetric; label: string }[];
  setExMetric: (value: StatsMetric) => void;
  onE1: boolean;
  onEff: boolean;
  effPts: ProgressPoint[];
  topPts: (ProgressPoint & { m: number | null; note?: string })[];
  e1Pts: ProgressPoint[];
  kind: ReturnType<typeof displayScale>;
  hd: string;
  exUnit: string;
  exList: ExercisePoint[];
  exBest: number;
  e1Best: ReturnType<typeof best1RM>;
  curCardio: boolean;
  curTimed: boolean;
  showEff: boolean;
  exerciseName: (id: string) => string;
  onSheet: (sheet: StatsSheet) => void;
};

function ProgressCards({
  appState,
  rangeDays,
  setRangeDays,
  bwPts,
  exHist,
  curEx,
  setExId,
  exOpts,
  setExMetric,
  onE1,
  onEff,
  effPts,
  topPts,
  e1Pts,
  kind,
  hd,
  exUnit,
  exList,
  exBest,
  e1Best,
  curCardio,
  curTimed,
  showEff,
  exerciseName,
  onSheet,
}: ProgressCardsProps) {
  const { t } = useTranslation();
  return (
    <div className="block lg:grid lg:grid-cols-2 lg:items-start lg:gap-3.5 [&>*]:min-w-0">
      <div className="mb-3 rounded-lg bg-card p-4">
        <div className="mb-2 flex items-center justify-between gap-3">
          <h2 className="m-0 mb-3 text-sm font-normal tracking-tight text-foreground/60">
            {t("weight.bodyWeight", "Body weight")}
          </h2>
          <div className="flex items-center gap-2">
            <Button size="sm" onClick={() => onSheet({ kind: "goal" })}>
              <Icon name="target" />
              {appState.targetW ? fmtNum(appState.targetW) : t("common.goal", "Goal")}
            </Button>
            <Button size="sm" onClick={() => onSheet({ kind: "bodyweight" })}>
              <Icon name="plus" />
              {t("common.log", "Log")}
            </Button>
          </div>
        </div>
        <Segmented<StatsRange>
          className="mb-2.5"
          value={rangeDays}
          onChange={setRangeDays}
          options={[
            { value: "30", label: "1M" },
            { value: "90", label: "3M" },
            { value: "365", label: "1Y" },
            { value: "0", label: t("common.all", "All") },
          ]}
        />
        <div className="w-full overflow-hidden [&_svg]:block [&_svg]:h-auto [&_svg]:w-full">
          <LineChart points={bwPts} height={160} unit={appState.unit} goal={appState.targetW} />
        </div>
      </div>
      <div className="mb-3 rounded-lg bg-card p-4">
        <h2 className="m-0 mb-3 text-sm font-normal tracking-tight text-foreground/60">
          {t("stats.exerciseProgress", "Exercise progress")}
        </h2>
        {exHist.length > 0 && curEx ? (
          <>
            <div className="mb-2.5 overflow-hidden rounded-lg bg-card">
              <SelectRow
                title={t("exercise.label", "Exercise")}
                sheetTitle={t("stats.exerciseProgress", "Exercise progress")}
                value={curEx}
                onChange={setExId}
                options={exHist.map((id) => ({ value: id, label: exerciseName(id) }))}
              />
            </div>
            {exOpts.length > 1 && (
              <Segmented<StatsMetric>
                className="mb-2.5"
                value={onEff ? "effort" : onE1 ? "e1rm" : "top"}
                onChange={setExMetric}
                options={exOpts}
              />
            )}
            <div className="w-full overflow-hidden [&_svg]:block [&_svg]:h-auto [&_svg]:w-full">
              {onEff ? (
                <LineChart
                  points={effPts}
                  height={150}
                  unit={hd}
                  color="var(--warning)"
                  invert={kind === "rir"}
                />
              ) : (
                <LineChart
                  points={onE1 ? e1Pts : topPts}
                  height={150}
                  unit={exUnit}
                  color="var(--system-blue)"
                />
              )}
            </div>
            <div className="mt-2">
              {exList.map((point) => (
                <div
                  key={point.d}
                  className="flex items-center justify-between gap-3 border-b border-border/60 py-1.5 text-sm leading-snug"
                >
                  <span className="text-foreground/60">{fmtDate(t, point.d, true)}</span>
                  <span>
                    {point.sets.map((set) => setLabel(curEx, set, point.target)).join("  ")}
                  </span>
                </div>
              ))}
            </div>
            <div className="mt-2 text-sm leading-snug text-muted-foreground">
              {onEff
                ? t("stats.effort.averageEffortPerWorkout", "Average effort per workout")
                : onE1
                  ? t("progression.estimated1rmPerWorkout", "Estimated 1RM per workout")
                  : curCardio
                    ? t("stats.topSpeedPerWorkout", "Top speed per workout")
                    : curTimed
                      ? t("progression.longestHoldPerWorkout", "Longest hold per workout")
                      : t("stats.bestSetWeightPerWorkout", "Best set weight per workout")}
              {!onEff && (
                <>
                  {" "}
                  · {t("exercise.best", "Best:")}{" "}
                  <b className="text-primary">
                    {fmtNum(onE1 && e1Best ? e1Best.est : exBest)} {onE1 ? appState.unit : exUnit}
                  </b>
                </>
              )}
            </div>
            {onE1 && e1Best && (
              <div className="mt-1 text-sm leading-snug text-muted-foreground">
                {t(
                  "progression.bestEstimateEstimateNotTested",
                  "Best estimate from {{set}} on {{date}} — an estimate, not a tested max.",
                  {
                    set: fmtNum(e1Best.w) + " " + appState.unit + " × " + e1Best.r,
                    date: fmtDate(t, e1Best.d, true),
                  },
                )}
              </div>
            )}
            {!onEff && !onE1 && showEff && (
              <div className="mt-1 text-sm leading-snug text-muted-foreground">
                {t(
                  "stats.effort.fullerDotMeansLessLeft",
                  "A fuller dot means less left in the tank — the same weight at a lower {{rating}} is progress the line alone does not show.",
                  { rating: hd },
                )}
              </div>
            )}
          </>
        ) : (
          <div className="text-sm leading-snug text-foreground/60">
            {t(
              "stats.finishFirstWorkoutSeeProgress",
              "Finish your first workout to see progress curves here.",
            )}
          </div>
        )}
      </div>
    </div>
  );
}

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
  const [rangeDays, setRangeDays] = useState<"30" | "90" | "365" | "0">("90");
  const rangeDayCount = Number(rangeDays);
  const [exId, setExId] = useState<string | null>(null);
  const [exMetric, setExMetric] = useState<"top" | "e1rm" | "effort">("top");
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
  const exPts: {
    t: number;
    y: number;
    d: string;
    sets: LoggedSet[];
    target: ExConfig | null;
  }[] = [];
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
  const exOpts: { value: "top" | "e1rm" | "effort"; label: string }[] = [
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
            <Button size="sm" variant="ghost" onClick={() => nav({ to: "/history" })}>
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

function CalendarDaySheet({
  iso,
  workouts,
  close,
  onWorkoutDetail,
}: {
  iso: IsoDate;
  workouts: Workout[];
  close: () => Promise<void>;
  onWorkoutDetail?: (workout: Workout) => void;
}) {
  const { t } = useTranslation();
  return (
    <>
      <h3>{fmtDate(t, iso, true)}</h3>
      <div className="flex flex-col gap-2">
        {workouts.map((workout) => (
          <WorkoutRow
            key={workout.id}
            workout={workout}
            onClick={async () => {
              await close();
              onWorkoutDetail?.(workout);
            }}
          />
        ))}
      </div>
    </>
  );
}
