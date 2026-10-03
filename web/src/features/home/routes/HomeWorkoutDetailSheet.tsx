import { getRouteApi, useNavigate } from "@tanstack/react-router";
import { Sheet, SheetContent, SheetTitle } from "@/shared/ui/sheet";
import { WorkoutDetail } from "@/features/history/HistorySheet";
import { useStore } from "@/app/store/useStore";

const routeApi = getRouteApi("/home/workout/$workoutId");

export default function HomeWorkoutDetailSheet() {
  const { workoutId } = routeApi.useParams();
  const navigate = useNavigate();

  const workoutName = useStore(
    (state) => state.appState.workouts.find((workout) => workout.id === workoutId)?.name,
  );

  const close = () => navigate({ to: "/home", replace: true, resetScroll: false });

  return (
    <Sheet
      open
      onOpenChange={(open) => {
        if (!open) void close();
      }}
    >
      <SheetContent side="bottom" variant="panel" showCloseButton={false}>
        <SheetTitle className="sr-only">{workoutName || "Workout"}</SheetTitle>
        <div className="mx-auto mt-1.5 mb-3.5 h-1 w-9 rounded-full bg-foreground/20" />
        <WorkoutDetail workoutId={workoutId} close={close} />
      </SheetContent>
    </Sheet>
  );
}
