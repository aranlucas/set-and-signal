import { type Dispatch, type SetStateAction, useState } from "react";
import { useTranslation } from "react-i18next";
import { useForm } from "react-hook-form";
import { valibotResolver } from "@hookform/resolvers/valibot";
import { useMuscleLabels } from "@/shared/hooks/use-muscle-labels";
import { useProgressionLabels } from "@/shared/hooks/use-progression-labels";
import { Navigate, useNavigate, useParams } from "@tanstack/react-router";
import { useStore } from "@/app/store/useStore";
import { exOr } from "@/domain/exercises/exercises";
import { uid } from "@/shared/lib/format";
import { weekdayFromNumber } from "@/shared/lib/format";
import { supersetUnits, cleanupSg, exLine } from "@/domain/training/history";
import { Thumb } from "@/shared/components/Media";
import { GlyphPicker } from "@/features/exercises/GlyphSheet";
import { ExercisePicker } from "@/features/exercises/ExercisePickerSheet";
import { ExConfigSheet } from "@/features/exercises/ConfigSheet";
import { CustomExerciseForm } from "@/features/exercises/CustomExerciseSheet";
import Icon from "@/shared/components/Icon";
import { SpaceBetween } from "@/shared/components/SpaceBetween";
import { glyphOf } from "@/domain/exercises/glyphs";
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
import { Sheet, SheetContent, SheetTitle } from "@/shared/ui/sheet";
import { SelectRow } from "@/shared/components/SelectRow";
import type { PickOption } from "@/shared/components/SelectRow";
import { POLICIES_FOR } from "@/domain/training/progression";
import BodyMap from "@/shared/components/BodyMap";
import type {
  AppState,
  CustomEx,
  ExConfig,
  PolicyId,
  Routine,
  SheetClose,
} from "@/shared/lib/types";
import type { SheetEx } from "@/features/exercises/sheet-shared";
import type { IconName } from "@/shared/components/Icon";
import { loadOfRoutine, rankOf } from "@/domain/exercises/muscles";
import { removeCustomExercise } from "@/features/exercises/custom-delete";
import { cn } from "@/shared/lib/utils";
import { routineNameFormSchema } from "@/shared/lib/form-schemas";

type EditSheet =
  | { kind: "glyph"; current: string; onPick: (name: IconName) => void }
  | { kind: "picker"; onPick: (exercise: SheetEx) => void }
  | {
      kind: "config";
      exercise: SheetEx;
      existing: ExConfig | null;
      onSave: (config: ExConfig) => void;
      onDelete?: (() => void) | null;
      routine: Routine;
    }
  | {
      kind: "custom";
      existingExercise: CustomEx | null;
      onDone?: (exercise: SheetEx | null) => void;
      prefillName?: string;
    };

type Confirmation = { title: string; message: string; onConfirm: () => void };

export default function RoutineEdit() {
  const { t } = useTranslation();
  const progressionLabels = useProgressionLabels();
  const [sheet, setSheet] = useState<EditSheet | null>(null);
  const [confirmation, setConfirmation] = useState<Confirmation | null>(null);
  const nav = useNavigate();
  const { id } = useParams({ from: "/plan/r/$id" });
  const state = useStore((store) => store.appState);
  const update = useStore((store) => store.update);
  const closeSheet: SheetClose = () => {
    setSheet(null);
    return Promise.resolve();
  };
  const routine = state.routines.find((candidate) => candidate.id === id);
  const { handleSubmit, register, reset } = useForm<{ name: string }>({
    defaultValues: { name: routine?.name ?? "" },
    values: { name: routine?.name ?? "" },
    resolver: valibotResolver(routineNameFormSchema),
  });
  if (!routine) return <Navigate to="/plan" replace />;

  const updateRoutine = (recipe: (currentRoutine: Routine) => void) =>
    update((nextState) => {
      const currentRoutine = nextState.routines.find((candidate) => candidate.id === id);
      if (currentRoutine) recipe(currentRoutine);
    });
  const edit = (fn: (ex: ExConfig[]) => void) =>
    updateRoutine((currentRoutine) => fn(currentRoutine.ex));
  const move = (i: number, dir: number) =>
    edit((ex) => {
      const j = i + dir;
      if (j < 0 || j >= ex.length) return;
      [ex[i], ex[j]] = [ex[j], ex[i]];
      cleanupSg(ex);
    });
  const toggleLink = (i: number) =>
    edit((ex) => {
      if (i < 1) return;
      const cur = ex[i];
      const prev = ex[i - 1];
      if (cur.sg && prev.sg && cur.sg === prev.sg) delete cur.sg;
      else {
        const gid = prev.sg || "sg" + uid();
        prev.sg = gid;
        cur.sg = gid;
      }
      cleanupSg(ex);
    });

  const units = supersetUnits(routine.ex);
  const multiUnits = units.filter((u) => u.length > 1);
  const unitFirst = new Set(multiUnits.map((u) => u[0]));
  const inSS = new Set(multiUnits.flat());
  const saveName = ({ name: draftName }: { name: string }) => {
    const name = draftName.trim() || t("workout.type.routine", "Routine");
    reset({ name });
    if (name === routine.name) return;
    updateRoutine((currentRoutine) => {
      currentRoutine.name = name;
    });
  };

  return (
    <div className="mx-auto w-full max-w-160">
      <h1 className="sr-only">{routine.name}</h1>
      <div className="mt-2 mb-4.5 flex items-end justify-between gap-3">
        <Button
          variant="plain"
          type="button"
          className="flex size-9 flex-none items-center justify-center rounded-full bg-card text-lg text-foreground transition duration-140 active:scale-95 active:bg-muted"
          onClick={() => nav({ to: "/plan" })}
          aria-label={t("navigation.plan", "Plan")}
        >
          <Icon name="chevronLeft" />
        </Button>
        <form className="mx-3 min-w-0 flex-1" onSubmit={handleSubmit(saveName)}>
          <Input
            aria-label={t("routine.name", "Routine name")}
            className="w-full rounded-lg bg-card px-4 py-3 text-xl font-semibold tracking-tight transition-shadow duration-140 outline-none placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-primary"
            {...register("name")}
            onBlur={() => void handleSubmit(saveName)()}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                event.currentTarget.blur();
              }
            }}
          />
        </form>
        <Button
          variant="plain"
          type="button"
          className="flex size-9 flex-none items-center justify-center rounded-full bg-card text-lg text-foreground transition duration-140 active:scale-95 active:bg-muted"
          aria-label={t("exercise.pickIcon", "Pick an icon")}
          onClick={() =>
            setSheet({
              kind: "glyph",
              current: routine.emoji,
              onPick: (g) =>
                updateRoutine((currentRoutine) => {
                  currentRoutine.emoji = g;
                }),
            })
          }
        >
          <Icon name={glyphOf(routine.emoji)} />
        </Button>
      </div>

      <div className="mb-4 overflow-hidden rounded-lg bg-card">
        <SelectRow
          icon="chartLine"
          title={t("progression.progression", "Progression")}
          sheetTitle={t("progression.progression", "Progression")}
          value={routine.prog || "linear"}
          onChange={(v) =>
            updateRoutine((currentRoutine) => {
              currentRoutine.prog = v;
            })
          }
          options={
            POLICIES_FOR.reps.map((p: PolicyId) => ({
              value: p,
              label: progressionLabels[p].name,
              subtitle: progressionLabels[p].description,
            })) as PickOption<PolicyId>[]
          }
        />
      </div>
      <div className="mx-0.5 -mt-2.5 mb-4 text-sm leading-snug text-muted-foreground">
        {t(
          "progression.appliesEveryExerciseRoutineNot",
          "Applies to every exercise in this routine that does not set its own rule.",
        )}
      </div>

      <RoutineExerciseList
        routine={routine}
        unit={state.unit}
        unitFirst={unitFirst}
        inSS={inSS}
        edit={edit}
        move={move}
        toggleLink={toggleLink}
        setSheet={setSheet}
      />

      {/* Coverage of the routine as planned, so a gap shows up while you're building it
        rather than after a month of training around it. */}
      <RoutineCoverage routine={routine} body={state.body} />

      <div className="mx-0.5 my-2.5 flex items-center gap-1.5 text-sm leading-snug text-muted-foreground">
        <Icon name="link" className="text-sm" />
        {t(
          "routine.tapLinkButtonExerciseSuperset",
          "Tap the link button on an exercise to superset it with the one above — you’ll do them back-to-back.",
        )}
      </div>
      <SpaceBetween size="xs">
        <Button
          className="w-full"
          variant="default"
          onClick={() =>
            setSheet({
              kind: "picker",
              onPick: (ex) =>
                setSheet({
                  kind: "config",
                  exercise: ex,
                  existing: null,
                  onSave: (cfg) =>
                    edit((x) => {
                      x.push({ ...cfg, id: ex.id });
                    }),
                  onDelete: null,
                  routine,
                }),
            })
          }
        >
          <Icon name="plus" />
          {t("exercise.addExercise", "Add exercise")}
        </Button>
        <Button
          className="w-full"
          variant="destructive"
          onClick={() =>
            setConfirmation({
              title: t("routine.deleteRoutine", "Delete routine?"),
              message: t(
                "routine.exercisesWillRemoved",
                "“{{routine}}” and its exercises will be removed.",
                { routine: routine.name },
              ),
              onConfirm: () => {
                update((s) => {
                  s.routines = s.routines.filter((x) => x.id !== id);
                  Object.keys(s.week).forEach((weekdayKey) => {
                    const weekday = weekdayFromNumber(Number(weekdayKey));
                    if (weekday != null && s.week[weekday] === id) delete s.week[weekday];
                  });
                  Object.keys(s.dayPlan).forEach((k) => {
                    if (s.dayPlan[k] === id) delete s.dayPlan[k];
                  });
                });
                void nav({ to: "/plan" });
              },
            })
          }
        >
          {t("routine.deleteRoutineLabel", "Delete routine")}
        </Button>
      </SpaceBetween>
      <RoutineSheet
        sheet={sheet}
        setSheet={setSheet}
        closeSheet={closeSheet}
        setConfirmation={setConfirmation}
      />
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
    </div>
  );
}

type RoutineExerciseListProps = {
  routine: Routine;
  unit: AppState["unit"];
  unitFirst: Set<number>;
  inSS: Set<number>;
  edit: (fn: (exercises: ExConfig[]) => void) => void;
  move: (index: number, direction: number) => void;
  toggleLink: (index: number) => void;
  setSheet: Dispatch<SetStateAction<EditSheet | null>>;
};

function RoutineExerciseList({
  routine,
  unit,
  unitFirst,
  inSS,
  edit,
  move,
  toggleLink,
  setSheet,
}: RoutineExerciseListProps) {
  const { t } = useTranslation();

  if (routine.ex.length === 0) {
    return (
      <div className="px-5 py-11 text-center text-base leading-normal text-foreground/60">
        <div className="mb-3 flex justify-center text-4xl text-foreground/60">
          <Icon name="dumbbell" />
        </div>
        {t("routine.noExercisesYetAddFirst", "No exercises yet — add your first one.")}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      {routine.ex.map((exerciseConfig, index) => {
        // An unresolvable id is shown rather than skipped — hiding it left an entry you
        // could neither see nor delete, but that still turned up in the workout.
        const exercise = exOr(exerciseConfig.id);
        const linkedPrevious =
          index > 0 && exerciseConfig.sg && routine.ex[index - 1].sg === exerciseConfig.sg;
        const openExerciseEditor = () =>
          setSheet({
            kind: "config",
            exercise,
            existing: exerciseConfig,
            onSave: (config) =>
              edit((exercises) => {
                exercises[index] = { ...config, id: exercises[index].id, sg: exercises[index].sg };
              }),
            onDelete: () =>
              edit((exercises) => {
                exercises.splice(index, 1);
                cleanupSg(exercises);
              }),
            routine,
          });
        return (
          <div key={exerciseConfig.id}>
            {unitFirst.has(index) && (
              <div className="mt-2 mb-1.5 ml-1 flex items-center gap-1.5 text-xs font-semibold text-primary">
                <Icon name="link" />
                {t("workout.type.superset", "Superset")}
              </div>
            )}
            <div
              className={cn(
                "flex min-h-15 w-full items-center gap-3 rounded-lg bg-card px-3 py-2 text-left transition-colors duration-140 active:bg-muted",
                inSS.has(index) && "border-l-2 border-primary",
              )}
            >
              <Button
                variant="plain"
                type="button"
                className="flex min-w-0 flex-1 items-center gap-3 bg-transparent p-0 text-left"
                onClick={openExerciseEditor}
              >
                <Thumb exercise={exercise} />
                <div className="min-w-0 flex-1">
                  <div className="text-base leading-tight font-normal tracking-tight capitalize">
                    {exercise.n}
                  </div>
                  <div className="mt-0.5 text-sm text-foreground/60">
                    {exLine(exerciseConfig, unit)}
                  </div>
                </div>
              </Button>
              <div className="flex flex-none flex-col items-center gap-0.5">
                {index > 0 && (
                  <Button
                    variant="plain"
                    type="button"
                    className={cn(
                      "flex h-7 w-8 flex-none items-center justify-center rounded-sm bg-card text-base text-foreground transition duration-140 active:scale-95 active:bg-muted",
                      linkedPrevious && "bg-primary/15 text-primary",
                    )}
                    title={t("routine.supersetExerciseAbove", "Superset with exercise above")}
                    onClick={(event) => {
                      event.stopPropagation();
                      toggleLink(index);
                    }}
                  >
                    <Icon name="link" />
                  </Button>
                )}
                <div className="flex gap-0.5">
                  <Button
                    variant="plain"
                    type="button"
                    className="flex h-6 w-7 flex-none items-center justify-center rounded-sm bg-card text-xs text-foreground transition duration-140 active:scale-95 active:bg-muted"
                    aria-label="Move up"
                    onClick={(event) => {
                      event.stopPropagation();
                      move(index, -1);
                    }}
                  >
                    <Icon name="chevronUp" />
                  </Button>
                  <Button
                    variant="plain"
                    type="button"
                    className="flex h-6 w-7 flex-none items-center justify-center rounded-sm bg-card text-xs text-foreground transition duration-140 active:scale-95 active:bg-muted"
                    aria-label="Move down"
                    onClick={(event) => {
                      event.stopPropagation();
                      move(index, 1);
                    }}
                  >
                    <Icon name="chevronDown" />
                  </Button>
                </div>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function RoutineCoverage({ routine, body }: { routine: Routine; body: AppState["body"] }) {
  const { t } = useTranslation();
  const muscleLabels = useMuscleLabels();
  if (routine.ex.length === 0) return null;
  const load = loadOfRoutine(routine);
  const { worked } = rankOf(load);
  return (
    <div className="my-3 rounded-lg bg-card p-4">
      <h2 className="mb-3 text-sm font-normal tracking-tight text-foreground/60">
        {t("muscleMap.whatSessionHits", "What this session hits")}
      </h2>
      <BodyMap load={load} body={body} />
      <div className="mt-1 flex flex-wrap gap-1.5">
        {worked.slice(0, 6).map((muscle) => (
          <span
            key={muscle}
            className="rounded-full bg-muted px-2.5 py-1 text-xs text-foreground/60"
          >
            {muscleLabels[muscle]}
          </span>
        ))}
      </div>
    </div>
  );
}

type RoutineSheetProps = {
  sheet: EditSheet | null;
  setSheet: Dispatch<SetStateAction<EditSheet | null>>;
  closeSheet: SheetClose;
  setConfirmation: Dispatch<SetStateAction<Confirmation | null>>;
};

function RoutineSheet({ sheet, setSheet, closeSheet, setConfirmation }: RoutineSheetProps) {
  const { t } = useTranslation();
  return (
    <Sheet open={sheet !== null} onOpenChange={(open) => !open && setSheet(null)}>
      <SheetContent
        side="bottom"
        className="max-h-screen touch-pan-y overflow-y-auto overscroll-contain rounded-2xl bg-sheet p-2 px-4.5 pb-5 lg:inset-x-auto lg:left-1/2 lg:w-160 lg:-translate-x-1/2"
        showCloseButton={false}
      >
        <SheetTitle className="sr-only">{t("routine.editorTitle", "Routine editor")}</SheetTitle>
        <div className="mx-auto mt-1.5 mb-3.5 h-1 w-9 rounded-full bg-foreground/20" />
        {sheet?.kind === "glyph" && (
          <GlyphPicker current={sheet.current} onPick={sheet.onPick} close={closeSheet} />
        )}
        {sheet?.kind === "picker" && (
          <ExercisePicker
            onPick={async (exercise) => {
              await closeSheet();
              sheet.onPick(exercise);
            }}
            openCustom={(existingExercise, onDone, prefillName) =>
              setSheet({ kind: "custom", existingExercise, onDone, prefillName })
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
            routine={sheet.routine}
            openCustom={(customExercise) =>
              setSheet({ kind: "custom", existingExercise: customExercise })
            }
            close={closeSheet}
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
      </SheetContent>
    </Sheet>
  );
}
