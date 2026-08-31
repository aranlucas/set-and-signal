import { useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import { useDateLabels } from "@/shared/hooks/use-date-labels";
import { fmtVol, isoOf, todayISO } from "@/shared/lib/format";
import type { AppState, IsoDate } from "@/shared/lib/types";
import { Button } from "@/shared/ui/button";

const activityCellClasses = [
  "bg-muted",
  "bg-primary/30",
  "bg-primary/50",
  "bg-primary/75",
  "bg-primary",
] as const;

function activityCellClass(level: number, isToday: boolean, isFuture: boolean) {
  return [
    "size-2.5 shrink-0 rounded-none border-0 p-0",
    activityCellClasses[level] ?? activityCellClasses[0],
    isToday && "ring-2 ring-primary",
    isFuture && "opacity-30",
  ]
    .filter(Boolean)
    .join(" ");
}

const legendCellClass = (level: number) =>
  `${activityCellClasses[level]} size-2.5 shrink-0 rounded-none`;

// GitHub-style activity heatmap, shaded by time trained per day.
export default function Heatmap({
  appState,
  onDay,
}: {
  appState: AppState;
  onDay: (date: IsoDate) => void;
}) {
  const { t } = useTranslation();
  const { monthsShort } = useDateLabels();
  const wrapRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (wrapRef.current) wrapRef.current.scrollLeft = wrapRef.current.scrollWidth;
  }, []);

  const activityByDate: Record<string, { workoutCount: number; volume: number; minutes: number }> =
    {};
  appState.workouts.forEach((workout) => {
    const activity = (activityByDate[workout.d] = activityByDate[workout.d] || {
      workoutCount: 0,
      volume: 0,
      minutes: 0,
    });
    activity.workoutCount++;
    activity.volume += workout.vol || 0;
    activity.minutes += Math.max(
      0,
      Math.round(((workout.end || workout.start) - workout.start) / 60000),
    );
  });
  const minutes: number[] = [];
  for (const activity of Object.values(activityByDate)) {
    if (activity.minutes > 0) minutes.push(activity.minutes);
  }
  const sortedMinutes = minutes.toSorted((a, b) => a - b);
  const percentile = (position: number) =>
    sortedMinutes.length > 0
      ? sortedMinutes[
          Math.min(sortedMinutes.length - 1, Math.floor(position * sortedMinutes.length))
        ]
      : 0;
  const lowThreshold = percentile(0.25);
  const mediumThreshold = percentile(0.5);
  const highThreshold = percentile(0.75);
  const levelForActivity = (activity?: { minutes: number }) => {
    if (activity === undefined) return 0;
    if (activity.minutes === 0) return 1;
    if (activity.minutes >= highThreshold) return 4;
    if (activity.minutes >= mediumThreshold) return 3;
    if (activity.minutes >= lowThreshold) return 2;
    return 1;
  };

  const today = new Date();
  today.setHours(12, 0, 0, 0);
  const end = new Date(today);
  end.setDate(today.getDate() - ((today.getDay() + 6) % 7));
  const start = new Date(end);
  start.setDate(end.getDate() - 52 * 7);

  const monthLabels: { key: string; label: string }[] = [];
  const weekColumns = [];
  let lastMonth = -1;
  for (let wk = 0; wk <= 52; wk++) {
    const columnStart = new Date(start);
    columnStart.setDate(start.getDate() + wk * 7);
    const monthIndex = columnStart.getMonth();
    const shouldShowMonth = monthIndex !== lastMonth && columnStart.getDate() <= 7 && wk < 51;
    monthLabels.push({
      key: isoOf(columnStart),
      label: shouldShowMonth ? monthsShort[monthIndex] : "",
    });
    if (columnStart.getDate() <= 7) lastMonth = monthIndex;
    const dayCells = [];
    for (let dayIndex = 0; dayIndex < 7; dayIndex++) {
      const date = new Date(columnStart);
      date.setDate(columnStart.getDate() + dayIndex);
      const dateKey = isoOf(date);
      const activity = activityByDate[dateKey];
      const cellClassName = activityCellClass(
        levelForActivity(activity),
        dateKey === todayISO(),
        date > today,
      );
      const cellTitle =
        dateKey +
        (activity
          ? ` · ${t("common.workoutCount", "{{count}} workout", {
              count: activity.workoutCount,
            })} · ${activity.minutes} min · ${fmtVol(activity.volume, appState.unit)}`
          : "");
      dayCells.push(
        activity ? (
          <Button
            variant="plain"
            key={dateKey}
            type="button"
            className={cellClassName}
            title={cellTitle}
            aria-label={cellTitle}
            onClick={() => onDay(dateKey)}
          />
        ) : (
          <div key={dateKey} className={cellClassName} title={cellTitle} aria-hidden="true" />
        ),
      );
    }
    weekColumns.push(
      <div key={isoOf(columnStart)} className="flex flex-col gap-1">
        {dayCells}
      </div>,
    );
  }

  return (
    <>
      <div
        className="scrollbar-none overflow-x-auto pb-0.5 [&::-webkit-scrollbar]:hidden"
        ref={wrapRef}
      >
        <div className="mb-1.5 ml-7.5 flex">
          {monthLabels.map(({ key, label }) => (
            <span
              key={key}
              className="w-3.5 flex-none overflow-visible text-xs whitespace-nowrap text-muted-foreground"
            >
              {label}
            </span>
          ))}
        </div>
        <div className="flex">
          <div className="flex w-7 flex-none flex-col gap-1">
            <span className="h-3 text-xs leading-3 text-foreground/60">
              {t("date.weekdayNarrow.monday", "Mon")}
            </span>
            <span className="h-3 text-xs leading-3 text-foreground/60" />
            <span className="h-3 text-xs leading-3 text-foreground/60">
              {t("date.weekdayNarrow.wednesday", "Wed")}
            </span>
            <span className="h-3 text-xs leading-3 text-foreground/60" />
            <span className="h-3 text-xs leading-3 text-foreground/60">
              {t("date.weekdayNarrow.friday", "Fri")}
            </span>
            <span className="h-3 text-xs leading-3 text-foreground/60" />
            <span className="h-3 text-xs leading-3 text-foreground/60" />
          </div>
          <div className="flex gap-1">{weekColumns}</div>
        </div>
      </div>
      <div className="mt-2.5 flex items-center justify-end gap-1 text-xs text-muted-foreground">
        {t("stats.lessTime", "Less time")}{" "}
        {[0, 1, 2, 3, 4].map((level) => (
          <div key={level} className={legendCellClass(level)} />
        ))}{" "}
        {t("stats.moreTime", "More time")}
      </div>
    </>
  );
}
