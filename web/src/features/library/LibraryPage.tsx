import { type Dispatch, type SetStateAction, useState } from "react";
import { useTranslation } from "react-i18next";
import { useExerciseMetadataLabels } from "@/shared/hooks/use-exercise-metadata-labels";
import { useStore } from "@/app/store/useStore";
import { EXDB, BODYPARTS, allExercises, equipmentOf } from "@/domain/exercises/exercises";
import { bestWeightFor } from "@/domain/training/history";
import { fmtNum } from "@/shared/lib/format";
import { Thumb } from "@/shared/components/Media";
import { ExerciseDetail } from "@/features/exercises/ExerciseDetailSheet";
import { AddToRoutine } from "@/features/exercises/ExercisePickerSheet";
import { CustomExerciseForm } from "@/features/exercises/CustomExerciseSheet";
import { ExConfigSheet } from "@/features/exercises/ConfigSheet";
import { Header } from "@/shared/components/Header";
import Icon from "@/shared/components/Icon";
import { SpaceBetween } from "@/shared/components/SpaceBetween";
import { Button } from "@/shared/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/shared/ui/alert-dialog";
import { Input } from "@/shared/ui/input";
import { Label } from "@/shared/ui/label";
import { Sheet, SheetContent, SheetTitle } from "@/shared/ui/sheet";
import { toCatalogExercise, type SheetEx } from "@/features/exercises/sheet-shared";
import { removeCustomExercise } from "@/features/exercises/custom-delete";
import { cn } from "@/shared/lib/utils";
import { exerciseSearchScore } from "@/domain/exercises/exercise-search";
import { preloadExerciseInstructions } from "@/domain/exercises/exercise-instructions";
import type { CustomEx, ExConfig, Routine, SheetClose } from "@/shared/lib/types";

type LibrarySheet =
  | { kind: "detail"; exercise: SheetEx }
  | { kind: "add"; exercise: SheetEx }
  | {
      kind: "custom";
      existingExercise: CustomEx | null;
      onDone?: (exercise: SheetEx | null) => void;
      prefillName?: string;
    }
  | {
      kind: "config";
      exercise: SheetEx;
      existing: ExConfig | null;
      onSave: (config: ExConfig) => void;
      onDelete?: (() => void) | null;
      routine?: Routine | null;
    };

type Confirmation = { title: string; message: string; onConfirm: () => void };

const isCustomExercise = (exercise: SheetEx): exercise is CustomEx => exercise.custom === true;
export default function Library() {
  const { t, i18n } = useTranslation();
  const metadata = useExerciseMetadataLabels();
  const state = useStore((store) => store.appState);
  const [searchQuery, setSearchQuery] = useState("");
  const [bodyPart, setBodyPart] = useState("");
  const [equipment, setEquipment] = useState("");
  const [visibleCount, setVisibleCount] = useState(40);
  const [sheet, setSheet] = useState<LibrarySheet | null>(null);
  const [confirmation, setConfirmation] = useState<Confirmation | null>(null);
  const closeSheet: SheetClose = () => {
    setSheet(null);
    return Promise.resolve();
  };
  const filteredExercises: SheetEx[] = allExercises(state)
    .flatMap((exercise) => {
      if (bodyPart && exercise.bp !== bodyPart) return [];
      const score = exerciseSearchScore(
        {
          ...exercise,
          desc: "desc" in exercise ? exercise.desc || "" : "",
        },
        searchQuery,
      );
      return score === null ? [] : [{ exercise, score }];
    })
    .sort((a, b) => a.score - b.score)
    .map(({ exercise }) => exercise);
  const equipmentOptions = equipmentOf(filteredExercises);
  // Drop the equipment filter if the search narrowed it away, so you never hit a dead end.
  const selectedEquipment = equipmentOptions.includes(equipment) ? equipment : "";
  const visibleExercises = selectedEquipment
    ? filteredExercises.filter((exercise) => exercise.eq === selectedEquipment)
    : filteredExercises;

  return (
    <>
      <Header
        variant="h1"
        className="mt-2 mb-4.5"
        description={t("library.exercisesAnimations", "{{count}} exercises with animations", {
          count: EXDB.length,
        })}
      >
        {t("navigation.exercises", "Exercises")}
      </Header>
      <div className="relative mb-2.5">
        <svg
          className="pointer-events-none absolute top-1/2 left-3 z-1 size-4 -translate-y-1/2 stroke-foreground/30"
          viewBox="0 0 24 24"
        >
          <circle cx="11" cy="11" r="7" />
          <path d="m21 21-4.3-4.3" />
        </svg>
        <Label htmlFor="library-search" className="sr-only">
          {t("exercise.searchLabel", "Search exercises")}
        </Label>
        <Input
          id="library-search"
          className="w-full rounded-md bg-muted px-4 py-3 pl-9 text-lg tracking-tight transition-shadow duration-140 outline-none placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-primary"
          placeholder={t("library.search", "Search…")}
          value={searchQuery}
          onChange={(event) => {
            setSearchQuery(event.target.value);
            setVisibleCount(40);
          }}
        />
      </div>
      <div
        className={cn(
          "flex scrollbar-none gap-2 overflow-x-auto pb-0.5 [&::-webkit-scrollbar]:hidden",
          equipmentOptions.length > 1 ? "mb-2" : "mb-3",
        )}
      >
        <Button
          variant="plain"
          type="button"
          aria-pressed={!bodyPart}
          className={cn(
            "flex-none rounded-full bg-card px-3 py-1.5 text-sm tracking-tight text-foreground transition-colors duration-140 outline-none focus-visible:underline focus-visible:underline-offset-2 active:bg-muted",
            !bodyPart && "bg-primary font-medium text-primary-foreground",
          )}
          onClick={() => {
            setBodyPart("");
            setEquipment("");
            setVisibleCount(40);
          }}
        >
          {t("common.all", "All")}
        </Button>
        {BODYPARTS.map((b) => (
          <Button
            variant="plain"
            key={b}
            type="button"
            aria-pressed={bodyPart === b}
            className={cn(
              "flex-none rounded-full bg-card px-3 py-1.5 text-sm tracking-tight text-foreground transition-colors duration-140 outline-none focus-visible:underline focus-visible:underline-offset-2 active:bg-muted",
              bodyPart === b && "bg-primary font-medium text-primary-foreground",
              "capitalize",
            )}
            onClick={() => {
              setBodyPart(b);
              setEquipment("");
              setVisibleCount(40);
            }}
          >
            {metadata.bodyPart(b)}
          </Button>
        ))}
      </div>
      {equipmentOptions.length > 1 && (
        <div className="mb-3 flex scrollbar-none gap-2 overflow-x-auto pb-0.5 [&::-webkit-scrollbar]:hidden">
          <Button
            variant="plain"
            type="button"
            aria-pressed={!selectedEquipment}
            className={cn(
              "flex-none rounded-full bg-card px-3 py-1.5 text-sm tracking-tight text-foreground transition-colors duration-140 outline-none focus-visible:underline focus-visible:underline-offset-2 active:bg-muted",
              !selectedEquipment && "bg-primary font-medium text-primary-foreground",
            )}
            onClick={() => {
              setEquipment("");
              setVisibleCount(40);
            }}
          >
            {t("exercise.equipment.anyEquipment", "Any equipment")}
          </Button>
          {equipmentOptions.map((equipmentOption) => (
            <Button
              variant="plain"
              key={equipmentOption}
              type="button"
              aria-pressed={selectedEquipment === equipmentOption}
              className={cn(
                "flex-none rounded-full bg-card px-3 py-1.5 text-sm tracking-tight text-foreground transition-colors duration-140 outline-none focus-visible:underline focus-visible:underline-offset-2 active:bg-muted",
                selectedEquipment === equipmentOption &&
                  "bg-primary font-medium text-primary-foreground",
                "capitalize",
              )}
              onClick={() => {
                setEquipment(equipmentOption);
                setVisibleCount(40);
              }}
            >
              {metadata.equipment(equipmentOption)}
            </Button>
          ))}
        </div>
      )}
      <SpaceBetween size="xs">
        <Button
          variant="plain"
          type="button"
          className="flex min-h-15 w-full items-center gap-3 rounded-lg bg-card px-3 py-2 text-left transition-colors duration-140 active:bg-muted"
          onClick={() =>
            setSheet({
              kind: "custom",
              existingExercise: null,
              onDone: (exercise) => {
                if (exercise) setSheet({ kind: "detail", exercise });
              },
              prefillName: searchQuery.trim(),
            })
          }
        >
          <span className="flex size-12.5 flex-none items-center justify-center rounded-md bg-muted object-cover text-2xl text-foreground/60">
            <Icon name="sparkles" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-base leading-tight font-normal tracking-tight">
              {t("customExercise.createOwnExercise", "Create your own exercise")}
            </span>
            <span className="mt-0.5 block text-sm text-foreground/60">
              {t("customExercise.nameBodyPartNoAnimation", "name + body part, no animation")}
            </span>
          </span>
          <Icon name="plus" className="flex-none text-base text-foreground" />
        </Button>
        {visibleExercises.slice(0, visibleCount).map((exercise) => {
          const bestWeight = bestWeightFor(state, exercise.id);
          return (
            <div
              key={exercise.id}
              className="flex min-h-15 w-full items-center gap-3 rounded-lg bg-card px-3 py-2 text-left transition-colors duration-140 active:bg-muted"
            >
              <Button
                variant="plain"
                type="button"
                className="flex min-w-0 flex-1 items-center gap-3 border-0 bg-transparent p-0 text-left outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                onPointerEnter={() => {
                  if ("img" in exercise)
                    preloadExerciseInstructions(
                      i18n.resolvedLanguage || i18n.language,
                      exercise.id,
                    );
                }}
                onPointerDown={() => {
                  if ("img" in exercise)
                    preloadExerciseInstructions(
                      i18n.resolvedLanguage || i18n.language,
                      exercise.id,
                    );
                }}
                onFocus={() => {
                  if ("img" in exercise)
                    preloadExerciseInstructions(
                      i18n.resolvedLanguage || i18n.language,
                      exercise.id,
                    );
                }}
                onClick={() => setSheet({ kind: "detail", exercise })}
                aria-label={t("exercise.viewDetailsLabel", "View details for {{exercise}}", {
                  exercise: exercise.n,
                })}
              >
                <Thumb exercise={toCatalogExercise(exercise)} />
                <span className="min-w-0 flex-1">
                  <span className="block text-base leading-tight font-normal tracking-tight capitalize">
                    {exercise.n}
                  </span>
                  <span className="mt-0.5 block text-sm text-foreground/60 capitalize">
                    {metadata.muscle(exercise.tg || exercise.bp)} ·{" "}
                    {metadata.equipment(exercise.eq || "")}
                  </span>
                </span>
                {bestWeight > 0 && (
                  <span className="inline-flex items-center gap-1 rounded-sm bg-primary/15 px-2 py-0.5 text-xs font-medium text-primary">
                    {fmtNum(bestWeight)}
                  </span>
                )}
              </Button>
              <Button
                size="sm"
                variant="secondary"
                onClick={() => setSheet({ kind: "add", exercise })}
              >
                <Icon name="plus" />
                {t("navigation.plan", "Plan")}
              </Button>
            </div>
          );
        })}
        {visibleExercises.length === 0 && (
          <div className="px-5 py-11 text-center text-base leading-normal text-foreground/60">
            <div className="mb-3 flex justify-center text-4xl text-foreground/60">
              <Icon name="magnifier" />
            </div>
            {t("exercise.noMatch", "No match")}
          </div>
        )}
        {visibleExercises.length > visibleCount && (
          <Button className="w-full" onClick={() => setVisibleCount((count) => count + 40)}>
            {t("exercise.showMore", "Show more")}
          </Button>
        )}
      </SpaceBetween>
      <LibrarySheetOverlay
        sheet={sheet}
        setSheet={setSheet}
        closeSheet={closeSheet}
        confirmation={confirmation}
        setConfirmation={setConfirmation}
      />
    </>
  );
}

type LibrarySheetOverlayProps = {
  sheet: LibrarySheet | null;
  setSheet: Dispatch<SetStateAction<LibrarySheet | null>>;
  closeSheet: SheetClose;
  confirmation: Confirmation | null;
  setConfirmation: Dispatch<SetStateAction<Confirmation | null>>;
};

function LibrarySheetOverlay({
  sheet,
  setSheet,
  closeSheet,
  confirmation,
  setConfirmation,
}: LibrarySheetOverlayProps) {
  const { t } = useTranslation();
  return (
    <>
      <Sheet open={sheet !== null} onOpenChange={(open) => !open && setSheet(null)}>
        <SheetContent
          side="bottom"
          className="max-h-screen touch-pan-y overflow-y-auto overscroll-contain rounded-2xl bg-sheet p-2 px-4.5 pb-5 lg:inset-x-auto lg:left-1/2 lg:w-160 lg:-translate-x-1/2"
          showCloseButton={false}
        >
          <SheetTitle className="sr-only">
            {sheet?.kind === "detail"
              ? sheet.exercise.n
              : sheet?.kind === "add"
                ? t("exercise.add", "Add “{{exercise}}”", { exercise: sheet.exercise.n })
                : sheet?.kind === "custom"
                  ? sheet.existingExercise
                    ? t("customExercise.editCustomExercise", "Edit custom exercise")
                    : t("customExercise.createOwnExercise", "Create your own exercise")
                  : sheet?.kind === "config"
                    ? sheet.exercise.n
                    : t("navigation.exercises", "Exercises")}
          </SheetTitle>
          <div className="mx-auto mt-1.5 mb-3.5 h-1 w-9 rounded-full bg-foreground/20" />
          {sheet?.kind === "detail" && (
            <ExerciseDetail
              exercise={sheet.exercise}
              close={closeSheet}
              openAddToRoutine={(exercise) => setSheet({ kind: "add", exercise })}
              openCustom={(exercise) => setSheet({ kind: "custom", existingExercise: exercise })}
              onDelete={() => {
                if (!isCustomExercise(sheet.exercise)) return;
                const customExercise = sheet.exercise;
                setConfirmation({
                  title: t("customExercise.delete", "Delete “{{name}}”?", {
                    name: customExercise.n,
                  }),
                  message: t(
                    "customExercise.willRemovedRoutinesAlreadyLogged",
                    "It will be removed from your routines. Already-logged workouts keep their sets.",
                  ),
                  onConfirm: () => {
                    removeCustomExercise(customExercise);
                    setSheet(null);
                  },
                });
              }}
            />
          )}
          {sheet?.kind === "add" && (
            <AddToRoutine
              exercise={sheet.exercise}
              close={closeSheet}
              openConfig={(exercise, existing, onSave, onDelete, routine) =>
                setSheet({ kind: "config", exercise, existing, onSave, onDelete, routine })
              }
            />
          )}
          {sheet?.kind === "custom" && (
            <CustomExerciseForm
              existingExercise={sheet.existingExercise}
              prefillName={sheet.prefillName}
              onDone={sheet.onDone}
              onDelete={
                sheet.existingExercise
                  ? () => {
                      const customExercise = sheet.existingExercise;
                      if (!customExercise) return;
                      setConfirmation({
                        title: t("customExercise.delete", "Delete “{{name}}”?", {
                          name: customExercise.n,
                        }),
                        message: t(
                          "customExercise.willRemovedRoutinesAlreadyLogged",
                          "It will be removed from your routines. Already-logged workouts keep their sets.",
                        ),
                        onConfirm: () => {
                          removeCustomExercise(customExercise);
                          setSheet(null);
                        },
                      });
                    }
                  : undefined
              }
              close={closeSheet}
            />
          )}
          {sheet?.kind === "config" && (
            <ExConfigSheet
              exercise={sheet.exercise}
              existing={sheet.existing}
              onSave={sheet.onSave}
              onDelete={sheet.onDelete}
              routine={sheet.routine || null}
              openCustom={(exercise) => setSheet({ kind: "custom", existingExercise: exercise })}
              close={closeSheet}
            />
          )}
        </SheetContent>
      </Sheet>
      <AlertDialog
        open={confirmation !== null}
        onOpenChange={(open) => {
          if (!open) setConfirmation(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{confirmation?.title}</AlertDialogTitle>
            <AlertDialogDescription>{confirmation?.message}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("common.cancel", "Cancel")}</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={() => {
                const onConfirm = confirmation?.onConfirm;
                setConfirmation(null);
                onConfirm?.();
              }}
            >
              {t("common.delete", "Delete")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
