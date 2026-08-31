import { useDeferredValue, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { useExerciseMetadataLabels } from "@/shared/hooks/use-exercise-metadata-labels";
import { useStore } from "@/app/store/useStore";
import {
  BODYPARTS,
  allExercises,
  equipmentOf,
  searchExercises,
} from "@/domain/exercises/exercises";
import { exCount, uid } from "@/shared/lib/format";
import { toast } from "@/shared/lib/toast";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import { Thumb } from "@/shared/components/Media";
import Icon from "@/shared/components/Icon";
import { SpaceBetween } from "@/shared/components/SpaceBetween";
import { glyphOf } from "@/domain/exercises/glyphs";
import { cn } from "@/shared/lib/utils";
import type { CustomEx, ExConfig, Routine, SheetClose } from "@/shared/lib/types";
import {
  getAppState,
  toCatalogExercise,
  updateAppState,
  type SheetEx,
} from "@/features/exercises/sheet-shared";
import { exerciseUsage } from "@/features/exercises/custom-delete";

function useAppState() {
  return useStore((state) => state.appState);
}

type OpenConfig = (
  exercise: SheetEx,
  existing: ExConfig | null,
  onSave: (config: ExConfig) => void,
  onDelete?: (() => void) | null,
  routine?: Routine | null,
) => void;

type OpenCustom = (
  existingExercise: CustomEx | null,
  onDone?: (exercise: SheetEx | null) => void,
  prefillName?: string,
) => void;

export function AddToRoutine({
  exercise,
  close,
  openConfig,
}: {
  exercise: SheetEx;
  close: SheetClose;
  openConfig: OpenConfig;
}) {
  const { t } = useTranslation();
  const nav = useNavigate();
  const appState = useAppState();

  const chooseRoutine = async (routineId: string) => {
    await close();
    const createNewRoutine = routineId === "_new";
    openConfig(
      exercise,
      null,
      (exerciseConfig) => {
        updateAppState((state) => {
          const routine = createNewRoutine
            ? {
                id: uid(),
                name: t("exercise.newRoutine", "New routine"),
                emoji: "dumbbell",
                ex: [],
              }
            : state.routines.find((candidate) => candidate.id === routineId);
          if (!routine) return;
          if (createNewRoutine) state.routines.push(routine);
          routine.ex.push(exerciseConfig);
        });
        const selectedRoutine = createNewRoutine
          ? getAppState().routines.at(-1)
          : appState.routines.find((candidate) => candidate.id === routineId);
        toast(
          t("exercise.addedTo", "“{{exercise}}” added to {{routine}}", {
            exercise: exercise.n,
            routine: selectedRoutine
              ? selectedRoutine.name
              : t("workout.type.routineLowercase", "routine"),
          }),
        );
        if (createNewRoutine && selectedRoutine)
          void nav({ to: "/plan/r/$id", params: { id: selectedRoutine.id } });
      },
      null,
      createNewRoutine
        ? null
        : appState.routines.find((candidate) => candidate.id === routineId) || null,
    );
  };

  return (
    <>
      <h3 className="capitalize">
        {t("exercise.add", "Add “{{exercise}}”", { exercise: exercise.n })}
      </h3>
      <div className="mb-3 text-sm leading-snug text-foreground/60">
        {t("exercise.pickRoutineSetsRepsWeight", "Pick a routine — sets, reps & weight come next.")}
      </div>
      <SpaceBetween size="xs">
        {appState.routines.map((routine) => (
          <button
            type="button"
            key={routine.id}
            className="flex min-h-15 w-full items-center gap-3 rounded-lg bg-card px-3 py-2.5 text-left transition-colors active:bg-muted"
            onClick={() => chooseRoutine(routine.id)}
          >
            <span className="flex size-7.25 shrink-0 items-center justify-center rounded-sm bg-primary text-lg text-white">
              <Icon name={glyphOf(routine.emoji)} />
            </span>
            <span className="min-w-0 grow">
              <span className="block text-base leading-tight tracking-tight">{routine.name}</span>
              <span className="mt-0.5 block text-sm text-foreground/60">
                {exCount(t, routine.ex.length)}
              </span>
            </span>
            {routine.ex.some((routineExercise) => routineExercise.id === exercise.id) && (
              <span className="inline-flex items-center gap-1 rounded-sm bg-muted px-2 py-0.5 text-xs font-medium text-foreground/60">
                {t("exercise.alreadyIn", "already in")}
              </span>
            )}
            <Icon name="plus" className="shrink-0 text-base text-foreground" />
          </button>
        ))}
        <button
          type="button"
          className="flex min-h-15 w-full items-center gap-3 rounded-lg bg-card px-3 py-2.5 text-left transition-colors active:bg-muted"
          onClick={() => chooseRoutine("_new")}
        >
          <span className="flex size-7 shrink-0 items-center justify-center rounded-sm bg-input text-lg text-white">
            <Icon name="sparkles" />
          </span>
          <span className="min-w-0 grow">
            <span className="block text-base leading-tight tracking-tight">
              {t("exercise.newRoutine", "New routine")}
            </span>
            <span className="mt-0.5 block text-sm text-foreground/60">
              {t("exercise.createOneStartExercise", "Create one and start with this exercise")}
            </span>
          </span>
          <Icon name="plus" className="shrink-0 text-base text-foreground" />
        </button>
      </SpaceBetween>
    </>
  );
}

export function ExercisePicker({
  onPick,
  close,
  openCustom,
}: {
  onPick: (exercise: SheetEx) => void;
  close: SheetClose;
  openCustom: OpenCustom;
}) {
  const { t } = useTranslation();
  const metadata = useExerciseMetadataLabels();
  const appState = useAppState();
  const usageByExercise = exerciseUsage(appState);
  const [query, setQuery] = useState("");
  const [bodyPart, setBodyPart] = useState("");
  const [equipment, setEquipment] = useState("");
  const [visibleCount, setVisibleCount] = useState(50);
  const deferredQuery = useDeferredValue(query);
  const allCatalogExercises: SheetEx[] = allExercises(appState);
  let matchingExercises = searchExercises(allCatalogExercises, deferredQuery, {
    bodyPart: bodyPart === "★" ? undefined : bodyPart,
  });
  if (bodyPart === "★") {
    matchingExercises = matchingExercises.filter((exercise) =>
      Boolean(usageByExercise[exercise.id]),
    );
  }
  if (bodyPart === "★")
    matchingExercises = matchingExercises.toSorted(
      (leftExercise, rightExercise) =>
        usageByExercise[rightExercise.id] - usageByExercise[leftExercise.id] ||
        (leftExercise.n < rightExercise.n ? -1 : 1),
    );
  const equipmentOptions = equipmentOf(matchingExercises);
  const activeEquipment = equipmentOptions.includes(equipment) ? equipment : "";
  const filteredExercises = activeEquipment
    ? matchingExercises.filter((exercise) => exercise.eq === activeEquipment)
    : matchingExercises;
  const chosenExerciseCount = Object.keys(usageByExercise).length;
  const resetVisibleCount = () => setVisibleCount(50);
  const pickExercise = async (exercise: SheetEx) => {
    await close();
    onPick(exercise);
  };

  return (
    <>
      <h3>{t("exercise.addExercise", "Add exercise")}</h3>
      <div className="relative">
        <svg
          className="pointer-events-none absolute top-1/2 left-3 z-1 size-4 -translate-y-1/2 fill-none stroke-foreground/30 stroke-2"
          viewBox="0 0 24 24"
          strokeLinecap="round"
          aria-hidden="true"
        >
          <circle cx="11" cy="11" r="7" />
          <path d="m21 21-4.3-4.3" />
        </svg>
        <Input
          className="rounded-md bg-muted pl-9"
          aria-label={t("exercise.searchLabel", "Search exercises")}
          placeholder={t("exercise.searchExercises", "Search {{count}} exercises…", {
            count: allCatalogExercises.length,
          })}
          value={query}
          onChange={(event) => {
            setQuery(event.target.value);
            resetVisibleCount();
          }}
        />
      </div>
      <div
        className={
          equipmentOptions.length > 1
            ? "my-2.5 mb-1.5 flex shrink-0 scrollbar-none gap-2 overflow-x-auto pb-0.5 [&::-webkit-scrollbar]:hidden"
            : "my-2.5 flex shrink-0 scrollbar-none gap-2 overflow-x-auto pb-0.5 [&::-webkit-scrollbar]:hidden"
        }
      >
        {chosenExerciseCount > 0 && (
          <button
            type="button"
            aria-pressed={bodyPart === "★"}
            className={cn(
              "inline-flex shrink-0 items-center gap-1 rounded-full bg-card px-3 py-1.5 text-sm text-foreground outline-none focus-visible:underline focus-visible:underline-offset-2",
              bodyPart === "★" && "bg-primary font-medium text-primary-foreground",
            )}
            onClick={() => {
              setBodyPart("★");
              setEquipment("");
              resetVisibleCount();
            }}
          >
            <Icon name="starFill" />
            {t("exercise.chosen", "Chosen")} ({chosenExerciseCount})
          </button>
        )}
        <button
          type="button"
          aria-pressed={!bodyPart}
          className={cn(
            "shrink-0 rounded-full bg-card px-3 py-1.5 text-sm text-foreground outline-none focus-visible:underline focus-visible:underline-offset-2",
            !bodyPart && "bg-primary font-medium text-primary-foreground",
          )}
          onClick={() => {
            setBodyPart("");
            setEquipment("");
            resetVisibleCount();
          }}
        >
          {t("common.all", "All")}
        </button>
        {BODYPARTS.map((option) => (
          <button
            type="button"
            key={option}
            aria-pressed={bodyPart === option}
            className={cn(
              "shrink-0 rounded-full bg-card px-3 py-1.5 text-sm text-foreground outline-none focus-visible:underline focus-visible:underline-offset-2",
              bodyPart === option && "bg-primary font-medium text-primary-foreground",
            )}
            onClick={() => {
              setBodyPart(option);
              setEquipment("");
              resetVisibleCount();
            }}
          >
            {metadata.bodyPart(option)}
          </button>
        ))}
      </div>
      {equipmentOptions.length > 1 && (
        <div className="mb-2.5 flex shrink-0 scrollbar-none gap-2 overflow-x-auto pb-0.5">
          <button
            type="button"
            aria-pressed={!activeEquipment}
            className={cn(
              "shrink-0 rounded-full bg-card px-3 py-1.5 text-sm text-foreground outline-none focus-visible:underline focus-visible:underline-offset-2",
              !activeEquipment && "bg-primary font-medium text-primary-foreground",
            )}
            onClick={() => {
              setEquipment("");
              resetVisibleCount();
            }}
          >
            {t("exercise.equipment.anyEquipment", "Any equipment")}
          </button>
          {equipmentOptions.map((option) => (
            <button
              type="button"
              key={option}
              aria-pressed={activeEquipment === option}
              className={cn(
                "shrink-0 rounded-full bg-card px-3 py-1.5 text-sm text-foreground outline-none focus-visible:underline focus-visible:underline-offset-2",
                activeEquipment === option && "bg-primary font-medium text-primary-foreground",
              )}
              onClick={() => {
                setEquipment(option);
                resetVisibleCount();
              }}
            >
              {metadata.equipment(option)}
            </button>
          ))}
        </div>
      )}
      <SpaceBetween size="xs">
        <SpaceBetween size="xs">
          {bodyPart !== "★" && (
            <button
              type="button"
              className="flex min-h-15 w-full items-center gap-3 rounded-lg bg-card px-3 py-2.5 text-left transition-colors active:bg-muted"
              onClick={() =>
                openCustom(
                  null,
                  async (customExercise) => {
                    if (customExercise) await pickExercise(customExercise);
                  },
                  query.trim(),
                )
              }
            >
              <span className="flex size-12.5 shrink-0 items-center justify-center rounded-md bg-muted text-2xl text-foreground/60">
                <Icon name="sparkles" />
              </span>
              <span className="min-w-0 grow">
                <span className="block text-base leading-tight tracking-tight">
                  {t("customExercise.createOwnExercise", "Create your own exercise")}
                </span>
                <span className="mt-0.5 block text-sm text-foreground/60">
                  {t("customExercise.nameBodyPartNoAnimation", "name + body part, no animation")}
                </span>
              </span>
              <Icon name="plus" className="shrink-0 text-base text-foreground" />
            </button>
          )}
          {filteredExercises.slice(0, visibleCount).map((exercise) => (
            <button
              type="button"
              key={exercise.id}
              className="flex min-h-15 w-full items-center gap-3 rounded-lg bg-card px-3 py-2.5 text-left transition-colors active:bg-muted"
              onClick={() => pickExercise(exercise)}
            >
              <Thumb exercise={toCatalogExercise(exercise)} />
              <span className="min-w-0 grow">
                <span className="block text-base leading-tight tracking-tight capitalize">
                  {exercise.n}
                </span>
                <span className="mt-0.5 block text-sm text-foreground/60 capitalize">
                  {metadata.muscle(exercise.tg || exercise.bp)} ·{" "}
                  {metadata.equipment(exercise.eq || "")}
                </span>
              </span>
              {usageByExercise[exercise.id] ? (
                <span className="inline-flex items-center gap-1 rounded-sm bg-primary/15 px-2 py-0.5 text-xs font-medium text-primary">
                  <Icon name="starFill" />
                </span>
              ) : null}
              <Icon name="plus" className="shrink-0 text-base text-foreground" />
            </button>
          ))}
          {filteredExercises.length === 0 && bodyPart === "★" && (
            <div className="px-5 py-11 text-center text-base leading-normal text-foreground/60">
              {t(
                "exercise.nothingChosenYetAddExercises",
                "Nothing chosen yet — add exercises and they’ll show up here.",
              )}
            </div>
          )}
        </SpaceBetween>
        {filteredExercises.length > visibleCount && (
          <Button className="w-full" onClick={() => setVisibleCount((count) => count + 50)}>
            {t("exercise.showMore", "Show more")}
          </Button>
        )}
      </SpaceBetween>
    </>
  );
}
