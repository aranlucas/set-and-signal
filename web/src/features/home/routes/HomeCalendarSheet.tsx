import { useNavigate } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { Sheet, SheetContent, SheetTitle } from "@/shared/ui/sheet";
import { Calendar } from "@/features/history/HistorySheet";

export default function HomeCalendarSheet() {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const close = () => navigate({ to: "/home", replace: true, resetScroll: false });

  return (
    <Sheet
      open
      onOpenChange={(open) => {
        if (!open) void close();
      }}
    >
      <SheetContent side="bottom" variant="panel" showCloseButton={false}>
        <SheetTitle className="sr-only">
          {t("calendar.workoutCalendar", "Workout calendar")}
        </SheetTitle>
        <div className="mx-auto mt-1.5 mb-3.5 h-1 w-9 rounded-full bg-foreground/20" />
        <Calendar
          close={close}
          onDayOverride={(date) =>
            void navigate({ to: "/home/day/$date", params: { date }, resetScroll: false })
          }
          onWorkoutDetail={(workout) =>
            void navigate({
              to: "/home/workout/$workoutId",
              params: { workoutId: workout.id },
              resetScroll: false,
            })
          }
          onCalendarDay={(date) =>
            void navigate({ to: "/home/calendar/$date", params: { date }, resetScroll: false })
          }
        />
      </SheetContent>
    </Sheet>
  );
}
