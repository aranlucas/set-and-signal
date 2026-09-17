import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useMuscleLabels } from "@/shared/hooks/use-muscle-labels";
import { todayISO, weekKey } from "@/shared/lib/format";
import Icon from "@/shared/components/Icon";
import BodyMap, { BodyMapLegend } from "@/shared/components/BodyMap";
import { loadOfWorkouts, rankOf } from "@/domain/exercises/muscles";
import type { MuscleSlug } from "@/domain/exercises/muscles";
import { isHardSet } from "@/domain/training/effort";
import { Button } from "@/shared/ui/button";
import { Segmented } from "@/shared/components/Segmented";
import type { AppState, LoggedSet } from "@/shared/lib/types";
import { ratingOf } from "@/features/stats/stats-types";

// Which muscles the training in a window actually hit — and, the point of the card,
// which ones it keeps missing. Shading is relative within the window (lib/muscles.js).
export function MuscleBalance({ appState }: { appState: AppState }) {
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
