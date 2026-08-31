import { getRouteApi, useNavigate } from "@tanstack/react-router";
import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { Sheet, SheetContent, SheetTitle } from "@/shared/ui/sheet";
import { fmtDate } from "@/shared/lib/format";
import { WorkoutRow } from "@/features/history/HistorySheet";
import { useStore } from "@/app/store/useStore";

const routeApi = getRouteApi("/home/calendar/$date");

export default function HomeCalendarDaySheet() {
  const { date } = routeApi.useParams();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const allWorkouts = useStore((state) => state.appState.workouts);
  const workouts = useMemo(
    () => allWorkouts.filter((workout) => workout.d === date),
    [allWorkouts, date],
  );
  const close = () => navigate({ to: "/home", replace: true, resetScroll: false });

  return (
    <Sheet
      open
      onOpenChange={(open) => {
        if (!open) void close();
      }}
    >
      <SheetContent
        side="bottom"
        className="max-h-screen touch-pan-y overflow-y-auto overscroll-contain rounded-2xl bg-sheet p-2 px-4.5 pb-5 lg:inset-x-auto lg:left-1/2 lg:w-160 lg:-translate-x-1/2"
        showCloseButton={false}
      >
        <SheetTitle className="sr-only">{fmtDate(t, date, true)}</SheetTitle>
        <div className="mx-auto mt-1.5 mb-3.5 h-1 w-9 rounded-full bg-foreground/20" />
        <h3>{fmtDate(t, date, true)}</h3>
        <div className="flex flex-col gap-2">
          {workouts.map((workout) => (
            <WorkoutRow
              key={workout.id}
              workout={workout}
              onClick={() =>
                void navigate({
                  to: "/home/workout/$workoutId",
                  params: { workoutId: workout.id },
                  resetScroll: false,
                })
              }
            />
          ))}
        </div>
      </SheetContent>
    </Sheet>
  );
}
