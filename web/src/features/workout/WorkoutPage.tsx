import { useState } from "react";
import { useStore } from "@/app/store/useStore";
import type { SheetClose } from "@/shared/lib/types";
import type { FinishSummaryPayload } from "@/features/workout/workout-actions";
import { StartChooser } from "@/features/workout/StartChooser";
import { WorkoutSessionView } from "@/features/workout/WorkoutSessionView";
import { FinishSummarySheet } from "@/features/workout/WorkoutSheets";

export default function Workout() {
  const active = useStore((state) => state.appState.active);
  const [finishSummary, setFinishSummary] = useState<FinishSummaryPayload | null>(null);
  const closeSummary: SheetClose = () => {
    setFinishSummary(null);
    return Promise.resolve();
  };
  return (
    <>
      {active ? (
        <WorkoutSessionView activeWorkout={active} onComplete={setFinishSummary} />
      ) : (
        <StartChooser />
      )}
      {finishSummary && <FinishSummarySheet summary={finishSummary} close={closeSummary} />}
    </>
  );
}
