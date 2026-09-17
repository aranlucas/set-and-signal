import { useState } from "react";
import { useTranslation } from "react-i18next";
import { effortOf } from "@/domain/training/history";
import { fmtNum } from "@/shared/lib/format";
import LineChart from "@/shared/components/LineChart";
import {
  displayScale,
  scaleName,
  toScale,
  effortSummary,
  effortWeeks,
  effortHistogram,
  HARD_RIR,
} from "@/domain/training/effort";
import { Segmented } from "@/shared/components/Segmented";
import type { AppState } from "@/shared/lib/types";

// How hard the training was — the half of the picture a volume chart cannot show. Everything
// is computed in RIR (lib/effort.js) and converted to whichever scale this profile reads.
// Every number carries how much of the training it speaks for: rating is optional and off by
// default, so a partly rated history is the normal case, and an average without its
// denominator would quietly speak for sets that were never rated.
export function EffortCard({ appState }: { appState: AppState }) {
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
