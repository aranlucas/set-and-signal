import { getRouteApi, Navigate, useNavigate } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { Sheet, SheetContent, SheetTitle } from "@/shared/ui/sheet";
import { PreWorkoutBodyweightSheet } from "@/features/account/AccountSheet";
import { beginWorkout } from "@/features/workout/workout-actions";
import { useStore } from "@/app/store/useStore";

const routeApi = getRouteApi("/home/pre-workout/$routineId");

export default function HomePreWorkoutBodyweightSheet() {
  const { routineId } = routeApi.useParams();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const routineExists = useStore((state) =>
    state.appState.routines.some((routine) => routine.id === routineId),
  );
  const close = () => navigate({ to: "/home", replace: true, resetScroll: false });

  if (!routineExists) return <Navigate to="/home" replace />;

  return (
    <Sheet
      open
      onOpenChange={(open) => {
        if (!open) void close();
      }}
    >
      <SheetContent side="bottom" variant="panel" showCloseButton={false}>
        <SheetTitle className="sr-only">{t("weight.quickCheck", "Quick check-in")}</SheetTitle>
        <div className="mx-auto mt-1.5 mb-3.5 h-1 w-9 rounded-full bg-foreground/20" />
        <PreWorkoutBodyweightSheet
          onDone={(bodyweight) => {
            beginWorkout(routineId, bodyweight, t("workout.type.freestyle", "Freestyle"));
            void navigate({ to: "/workout" });
          }}
          onChooseDifferentWorkout={() => navigate({ to: "/workout" })}
        />
      </SheetContent>
    </Sheet>
  );
}
