import { useTranslation } from "react-i18next";
import { setLabel } from "@/domain/training/history";
import { fmtNum, fmtDate } from "@/shared/lib/format";
import LineChart from "@/shared/components/LineChart";
import Icon from "@/shared/components/Icon";
import { Button } from "@/shared/ui/button";
import { Segmented } from "@/shared/components/Segmented";
import { SelectRow } from "@/shared/components/SelectRow";
import type { AppState, EffortKind, ExConfig, LoggedSet } from "@/shared/lib/types";
import type { StatsSheet } from "@/features/stats/stats-types";

export type StatsRange = "30" | "90" | "365" | "0";
export type StatsMetric = "top" | "e1rm" | "effort";
export type ProgressPoint = { t: number; y: number; d: string };
export type ExercisePoint = ProgressPoint & { sets: LoggedSet[]; target: ExConfig | null };

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
  kind: EffortKind;
  hd: string;
  exUnit: string;
  exList: ExercisePoint[];
  exBest: number;
  e1Best: { est: number; w: number; r: number; d: string; t: number } | null;
  curCardio: boolean;
  curTimed: boolean;
  showEff: boolean;
  exerciseName: (id: string) => string;
  onSheet: (sheet: StatsSheet) => void;
};

export function ProgressCards({
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
