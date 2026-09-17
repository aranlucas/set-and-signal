import { useTranslation } from "react-i18next";
import { fmtDate } from "@/shared/lib/format";
import { WorkoutRow } from "@/features/history/HistorySheet";
import type { IsoDate, Workout } from "@/shared/lib/types";

export function CalendarDaySheet({
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
            onClick={() => {
              void close().then(() => onWorkoutDetail?.(workout));
            }}
          />
        ))}
      </div>
    </>
  );
}
