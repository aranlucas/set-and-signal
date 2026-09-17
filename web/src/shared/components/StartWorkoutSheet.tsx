import { useTranslation } from "react-i18next";
import { useNavigate } from "@tanstack/react-router";
import { PreWorkoutBodyweightSheet } from "@/features/account/AccountSheet";
import { beginWorkout } from "@/features/workout/workout-actions";
import { RouteBottomSheet } from "@/shared/components/RouteBottomSheet";

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
    <RouteBottomSheet
      open={open}
      onOpenChange={(nextOpen) => {
        // This workflow closes only through one of its explicit start/change actions.
        if (nextOpen) onOpenChange(true);
      }}
      title="Quick check-in"
    >
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
    </RouteBottomSheet>
  );
}
