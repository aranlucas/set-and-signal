import { useState } from "react";
import { useTranslation } from "react-i18next";
import ConfirmDialog from "@/shared/components/ConfirmDialog";
import type { ConfirmDialogOptions } from "@/shared/components/ConfirmDialog";
import { RouteBottomSheet } from "@/shared/components/RouteBottomSheet";
import { removeCustomExercise } from "@/features/exercises/custom-delete";
import { ExercisePicker, AddToRoutine } from "@/features/exercises/ExercisePickerSheet";
import { ExConfigSheet } from "@/features/exercises/ConfigSheet";
import { ExerciseDetail } from "@/features/exercises/ExerciseDetailSheet";
import { CustomExerciseForm } from "@/features/exercises/CustomExerciseSheet";
import { FinishSummary, TopWeight, WorkoutComplete } from "@/features/workout/WorkoutSheet";
import type { FinishSummaryPayload } from "@/features/workout/workout-actions";
import type { SetWorkoutSheet, WorkoutSheetState } from "@/features/workout/workout-state";
import type { CustomEx, SheetClose } from "@/shared/lib/types";
import type { SheetEx } from "@/features/exercises/sheet-shared";

type TopWeightSheetProps = { state: Extract<WorkoutSheetState, { type: "top-weight" }> };

type WorkoutCompleteSheetProps = {
  onComplete: () => void;
  state: Extract<WorkoutSheetState, { type: "workout-complete" }>;
};

type DetailSheetProps = { state: Extract<WorkoutSheetState, { type: "detail" }> };

type PickerSheetProps = { state: Extract<WorkoutSheetState, { type: "picker" }> };

type AddToRoutineSheetProps = { state: Extract<WorkoutSheetState, { type: "add-to-routine" }> };

type ConfigSheetProps = { state: Extract<WorkoutSheetState, { type: "config" }> };

type CustomSheetProps = { state: Extract<WorkoutSheetState, { type: "custom" }> };

type FinishSummarySheetProps = {
  summary: FinishSummaryPayload;
  close: SheetClose;
};

type WorkoutSheetHostProps = {
  workoutSheet: WorkoutSheetState | null;
  close: SheetClose;
  setWorkoutSheet: SetWorkoutSheet;
  onComplete: () => void;
};

type WorkoutSheetProps = {
  close: SheetClose;
  setWorkoutSheet: SetWorkoutSheet;
};

function isCustomExercise(exercise: SheetEx): exercise is CustomEx {
  return !("img" in exercise);
}

function TopWeightSheet({
  state,
  close,
  setWorkoutSheet,
}: WorkoutSheetProps & TopWeightSheetProps) {
  const { t } = useTranslation();

  return (
    <RouteBottomSheet
      title={t("workout.adjustTopWeight", "Adjust top weight")}
      onOpenChange={(open) => {
        if (!open) {
          void close().catch(console.error);
        }
      }}
    >
      <TopWeight entryIdx={state.entryIdx} close={close} setWorkoutSheet={setWorkoutSheet} />
    </RouteBottomSheet>
  );
}

function WorkoutCompleteSheet({
  close,
  onComplete,
}: WorkoutSheetProps & WorkoutCompleteSheetProps) {
  const { t } = useTranslation();

  return (
    <RouteBottomSheet
      title={t("workout.completion.sWholeWorkout", "That's the whole workout!")}
      onOpenChange={(open) => {
        if (!open) {
          void close().catch(console.error);
        }
      }}
    >
      <WorkoutComplete close={close} onFinish={onComplete} />
    </RouteBottomSheet>
  );
}

function DetailSheet({ state, close, setWorkoutSheet }: WorkoutSheetProps & DetailSheetProps) {
  const { t } = useTranslation();
  const [confirmation, setConfirmation] = useState<ConfirmDialogOptions | null>(null);
  const customExercise = isCustomExercise(state.exercise) ? state.exercise : null;

  const openCustom = (
    existingExercise: CustomEx | null,
    onDone?: (exercise: SheetEx | null) => void,
    prefillName?: string,
  ) => setWorkoutSheet({ type: "custom", existingExercise, onDone, prefillName });

  return (
    <>
      <RouteBottomSheet
        title={state.exercise.n}
        onOpenChange={(open) => {
          if (!open) {
            void close().catch(console.error);
          }
        }}
      >
        <ExerciseDetail
          exercise={state.exercise}
          close={close}
          openAddToRoutine={(exercise) => setWorkoutSheet({ type: "add-to-routine", exercise })}
          openCustom={openCustom}
          onDelete={
            customExercise
              ? () =>
                  setConfirmation({
                    title: t("customExercise.delete", "Delete “{{name}}”?", {
                      name: customExercise.n,
                    }),
                    description: t(
                      "customExercise.willRemovedRoutinesAlreadyLogged",
                      "It will be removed from your routines. Already-logged workouts keep their sets.",
                    ),
                    confirmLabel: t("common.delete", "Delete"),
                    danger: true,
                    onConfirm: () => {
                      removeCustomExercise(customExercise);
                      void close().catch(console.error);
                    },
                  })
              : undefined
          }
        />
      </RouteBottomSheet>
      {confirmation && (
        <ConfirmDialog
          {...confirmation}
          open
          onOpenChange={(open) => {
            if (!open) {
              setConfirmation(null);
            }
          }}
        />
      )}
    </>
  );
}

function PickerSheet({ state, close, setWorkoutSheet }: WorkoutSheetProps & PickerSheetProps) {
  const { t } = useTranslation();

  const openCustom = (
    existingExercise: CustomEx | null,
    onDone?: (exercise: SheetEx | null) => void,
    prefillName?: string,
  ) => setWorkoutSheet({ type: "custom", existingExercise, onDone, prefillName });

  return (
    <RouteBottomSheet
      title={t("exercise.addExercise", "Add exercise")}
      onOpenChange={(open) => {
        if (!open) {
          void close().catch(console.error);
        }
      }}
    >
      <ExercisePicker onPick={state.onPick} close={close} openCustom={openCustom} />
    </RouteBottomSheet>
  );
}

function AddToRoutineSheet({
  state,
  close,
  setWorkoutSheet,
}: WorkoutSheetProps & AddToRoutineSheetProps) {
  const { t } = useTranslation();

  return (
    <RouteBottomSheet
      title={t("exercise.add", "Add “{{exercise}}”", { exercise: state.exercise.n })}
      onOpenChange={(open) => {
        if (!open) {
          void close().catch(console.error);
        }
      }}
    >
      <AddToRoutine
        exercise={state.exercise}
        close={close}
        openConfig={(exercise, existing, onSave, onDelete, routine) =>
          setWorkoutSheet({
            type: "config",
            exercise,
            existing,
            onSave,
            onDelete,
            routine: routine ?? null,
          })
        }
      />
    </RouteBottomSheet>
  );
}

function ConfigSheet({ state, close, setWorkoutSheet }: WorkoutSheetProps & ConfigSheetProps) {
  return (
    <RouteBottomSheet
      title={state.exercise.n}
      onOpenChange={(open) => {
        if (!open) {
          void close().catch(console.error);
        }
      }}
    >
      <ExConfigSheet
        exercise={state.exercise}
        existing={state.existing}
        onSave={state.onSave}
        onDelete={state.onDelete}
        close={close}
        routine={state.routine}
        openCustom={(exercise) => setWorkoutSheet({ type: "custom", existingExercise: exercise })}
      />
    </RouteBottomSheet>
  );
}

function CustomSheet({ state, close }: WorkoutSheetProps & CustomSheetProps) {
  const { t } = useTranslation();

  return (
    <RouteBottomSheet
      title={
        state.existingExercise
          ? t("customExercise.editCustomExercise", "Edit custom exercise")
          : t("customExercise.createOwnExercise", "Create your own exercise")
      }
      onOpenChange={(open) => {
        if (!open) {
          void close().catch(console.error);
        }
      }}
    >
      <CustomExerciseForm
        existingExercise={state.existingExercise}
        prefillName={state.prefillName}
        onDone={state.onDone}
        onDelete={state.onDelete}
        close={close}
      />
    </RouteBottomSheet>
  );
}

export function FinishSummarySheet({ summary, close }: FinishSummarySheetProps) {
  const { t } = useTranslation();

  return (
    <RouteBottomSheet
      title={t("workout.completion.workoutComplete", "Workout complete!")}
      onOpenChange={(open) => {
        if (!open) {
          void close().catch(console.error);
        }
      }}
    >
      <FinishSummary {...summary} close={close} />
    </RouteBottomSheet>
  );
}

export function WorkoutSheetHost({
  workoutSheet,
  close,
  setWorkoutSheet,
  onComplete,
}: WorkoutSheetHostProps) {
  if (!workoutSheet) {
    return null;
  }

  switch (workoutSheet.type) {
    case "top-weight":
      return (
        <TopWeightSheet state={workoutSheet} close={close} setWorkoutSheet={setWorkoutSheet} />
      );
    case "workout-complete":
      return (
        <WorkoutCompleteSheet
          state={workoutSheet}
          close={close}
          setWorkoutSheet={setWorkoutSheet}
          onComplete={onComplete}
        />
      );
    case "detail":
      return <DetailSheet state={workoutSheet} close={close} setWorkoutSheet={setWorkoutSheet} />;
    case "picker":
      return <PickerSheet state={workoutSheet} close={close} setWorkoutSheet={setWorkoutSheet} />;
    case "add-to-routine":
      return (
        <AddToRoutineSheet state={workoutSheet} close={close} setWorkoutSheet={setWorkoutSheet} />
      );
    case "config":
      return <ConfigSheet state={workoutSheet} close={close} setWorkoutSheet={setWorkoutSheet} />;
    case "custom":
      return <CustomSheet state={workoutSheet} close={close} setWorkoutSheet={setWorkoutSheet} />;
  }

  return null;
}
