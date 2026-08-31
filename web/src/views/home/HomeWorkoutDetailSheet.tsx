import { getRouteApi, useNavigate } from "@tanstack/react-router";
import { Sheet, SheetContent, SheetTitle } from "../../components/ui/sheet";
import { WorkoutDetail } from "../../sheets/history";
import { useStore } from "../../store/useStore";

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
      <SheetContent
        side="bottom"
        className="max-h-screen touch-pan-y overflow-y-auto overscroll-contain rounded-2xl bg-sheet p-2 px-4.5 pb-5 lg:inset-x-auto lg:left-1/2 lg:w-160 lg:-translate-x-1/2"
        showCloseButton={false}
      >
        <SheetTitle className="sr-only">{workoutName || "Workout"}</SheetTitle>
        <div className="mx-auto mt-1.5 mb-3.5 h-1 w-9 rounded-full bg-foreground/20" />
        <WorkoutDetail workoutId={workoutId} close={close} />
      </SheetContent>
    </Sheet>
  );
}
