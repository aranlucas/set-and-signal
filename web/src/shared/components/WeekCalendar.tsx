import type { TFunction } from "i18next";
import { useTranslation } from "react-i18next";

import { formatDate, isoOf } from "@/shared/lib/format";
import { cn } from "@/shared/lib/utils";
import Icon from "@/shared/components/Icon";

export type WeekCalendarDayStatus = "completed" | "rescheduled" | "planned";

export function WeekStatusMark({
  status,
  className,
}: {
  status: WeekCalendarDayStatus;
  className?: string;
}) {
  return (
    <span className={cn("flex h-3 w-4 items-center justify-center", className)} aria-hidden="true">
      {status === "completed" && <Icon name="check" className="text-xs text-system-blue" />}
      {status === "rescheduled" && <span className="size-2 rotate-45 bg-primary" />}
      {status === "planned" && <span className="h-0.5 w-3 bg-foreground/50" />}
    </span>
  );
}

interface WeekCalendarProps {
  weekStart: Date;
  dayStatuses: Readonly<Record<string, WeekCalendarDayStatus>>;
  onSelect: (date: Date) => void;
}

const formatAccessibleDate = (t: TFunction, date: Date): string =>
  formatDate(t, date, {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });

export function WeekCalendar({ weekStart, dayStatuses, onSelect }: WeekCalendarProps) {
  const { t } = useTranslation();
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekStart.getDate() + 6);
  const todayIso = isoOf(new Date());
  const days = Array.from({ length: 7 }, (_, index) => {
    const date = new Date(weekStart);
    date.setDate(weekStart.getDate() + index);
    return date;
  });

  return (
    <div>
      <fieldset
        className="grid grid-cols-7 border-0 border-t border-border p-0"
        aria-label={`${formatAccessibleDate(t, weekStart)} – ${formatAccessibleDate(t, weekEnd)}`}
      >
        {days.map((date) => {
          const iso = isoOf(date);
          const status = dayStatuses[iso];
          const isToday = iso === todayIso;
          const statusLabel =
            status === "completed"
              ? t("calendar.status.completed", "Done")
              : status === "rescheduled"
                ? t("calendar.status.rescheduled", "Rescheduled")
                : status === "planned"
                  ? t("calendar.status.planned", "Planned")
                  : undefined;
          const label = [
            formatAccessibleDate(t, date),
            isToday ? t("date.today", "Today") : undefined,
            statusLabel,
          ]
            .filter(Boolean)
            .join(", ");

          return (
            <button
              key={iso}
              type="button"
              className="flex h-16 min-w-0 flex-col items-center justify-center gap-0 rounded-md bg-transparent p-0 font-normal transition hover:bg-muted active:scale-95"
              onClick={() => onSelect(date)}
              aria-label={label}
              aria-current={isToday ? "date" : undefined}
            >
              <span className="text-xs font-medium tracking-wide text-foreground/60 uppercase">
                {formatDate(t, date, { weekday: "short" }).slice(0, 2)}
              </span>
              <span
                className={cn(
                  "my-1 flex size-8 items-center justify-center rounded-full text-lg tracking-tight",
                  isToday && "my-0 bg-primary font-semibold text-primary-foreground",
                )}
              >
                {date.getDate()}
              </span>
              {status ? <WeekStatusMark status={status} /> : <span className="h-3" />}
            </button>
          );
        })}
      </fieldset>
      <div className="mt-1 flex items-center justify-center gap-4 border-t border-border/40 pt-2 text-xs text-foreground/60">
        {(["completed", "planned", "rescheduled"] as const).map((status) => (
          <span key={status} className="flex items-center gap-1.5">
            <WeekStatusMark status={status} />
            {status === "completed"
              ? t("calendar.status.completed", "Done")
              : status === "planned"
                ? t("calendar.status.planned", "Planned")
                : t("calendar.status.rescheduled", "Rescheduled")}
          </span>
        ))}
      </div>
    </div>
  );
}
