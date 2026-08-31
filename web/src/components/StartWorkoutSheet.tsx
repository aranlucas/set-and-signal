import { useTranslation } from "react-i18next";
import { useNavigate } from "@tanstack/react-router";
import { PreWorkoutBodyweightSheet } from "../sheets/account";
import { beginWorkout } from "../sheets/workout-actions";
import { Sheet, SheetContent, SheetTitle } from "./ui/sheet";

export default function StartWorkoutSheet({
  open,
  routineId,
  onOpenChange,
}: {
  open: boolean;
  routineId: string | null;
  onOpenChange: (open: boolean) => void;
}) {
  const navigate = useNavigate();
  const { t } = useTranslation();

  return (
    <Sheet
      open={open}
      onOpenChange={(nextOpen) => {
        // This workflow closes only through one of its explicit start/change actions.
        if (nextOpen) onOpenChange(true);
      }}
    >
      <SheetContent
        side="bottom"
        showCloseButton={false}
        className="max-h-screen touch-pan-y overflow-y-auto overscroll-contain rounded-2xl bg-sheet p-2 px-4.5 pb-5 lg:inset-x-auto lg:left-1/2 lg:w-160 lg:-translate-x-1/2"
      >
        <SheetTitle className="sr-only">Quick check-in</SheetTitle>
        <div className="mx-auto mt-1.5 mb-3.5 h-1 w-9 rounded-full bg-foreground/20" />
        <PreWorkoutBodyweightSheet
          onDone={(bodyweight) => {
            onOpenChange(false);
            beginWorkout(routineId, bodyweight, t("workout.type.freestyle", "Freestyle"));
            void navigate({ to: "/workout" });
          }}
          onChooseDifferentWorkout={() => {
            onOpenChange(false);
            void navigate({ to: "/workout" });
          }}
        />
      </SheetContent>
    </Sheet>
  );
}
