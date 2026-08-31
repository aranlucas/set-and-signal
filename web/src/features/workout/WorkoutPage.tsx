import { useEffect, useRef, useState } from "react";
import type { TFunction } from "i18next";
import { useTranslation } from "react-i18next";
import { useDateLabels } from "@/shared/hooks/use-date-labels";
import { useEffortLabels } from "@/shared/hooks/use-effort-labels";
import { useExerciseMetadataLabels } from "@/shared/hooks/use-exercise-metadata-labels";
import { useNavigate } from "@tanstack/react-router";
import { useStore } from "@/app/store/useStore";
import { useWorkoutTimer } from "@/features/workout/useWorkoutTimer";
import { exOr, isBarbellEq } from "@/domain/exercises/exercises";
import {
  effectiveRoutine,
  lastEntryFor,
  bestWeightFor,
  buildSets,
  setsDoneActive,
  supersetUnits,
  unitOf,
  setLabel,
  modeOf,
  isBw,
  isPerSide,
  sideReps,
  repStep,
  isWarmup,
  EFFORT,
  effortOf,
  stepEffort,
  capEffort,
} from "@/domain/training/history";
import { fmtNum, fmtDate, todayISO, exCount } from "@/shared/lib/format";
import { beep, vibrate } from "@/shared/lib/sound";
import { api } from "@/shared/lib/api";
import Media from "@/shared/components/Media";
import { beginWorkout, completeWorkout } from "@/features/workout/workout-actions";
import { Header } from "@/shared/components/Header";
import Icon from "@/shared/components/Icon";
import { SpaceBetween } from "@/shared/components/SpaceBetween";
import { Button } from "@/shared/ui/button";
import { Checkbox } from "@/shared/ui/checkbox";
import { NumberField } from "@/shared/components/NumField";
import { nextPrescription, applyPrescription } from "@/domain/training/progression";
import { warmupSets } from "@/domain/training/warmup";
import { PlateRow } from "@/shared/components/PlateRow";
import { barWeightFor } from "@/domain/training/plates";
import { glyphOf } from "@/domain/exercises/glyphs";
import type { AppState, EffortKind, LoggedSet, ActiveWorkout } from "@/shared/lib/types";
import { toast } from "@/shared/lib/toast";
import { cn } from "@/shared/lib/utils";
import { Sheet, SheetContent, SheetTitle } from "@/shared/ui/sheet";
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
import { PreWorkoutBodyweightSheet } from "@/features/account/AccountSheet";
import type { CustomEx, SheetClose, Id } from "@/shared/lib/types";
import type { SheetEx } from "@/features/exercises/sheet-shared";
import type { FinishSummaryPayload } from "@/features/workout/workout-actions";
import type { SetWorkoutSheet, WorkoutSheetState } from "@/features/workout/workout-state";
import { removeCustomExercise } from "@/features/exercises/custom-delete";
import { ExercisePicker, AddToRoutine } from "@/features/exercises/ExercisePickerSheet";
import { ExConfigSheet } from "@/features/exercises/ConfigSheet";
import { ExerciseDetail } from "@/features/exercises/ExerciseDetailSheet";
import { CustomExerciseForm } from "@/features/exercises/CustomExerciseSheet";
import { FinishSummary, TopWeight, WorkoutComplete } from "@/features/workout/WorkoutSheet";

const translatedReason = (
  t: TFunction,
  why: NonNullable<import("@/shared/lib/types").Prescription["why"]>,
): string => t(why.key, why.defaultValue, why.values);

type WorkoutConfirmation = {
  title: string;
  message: string;
  confirmText: string;
  danger?: boolean;
  onConfirm: () => void;
};

/* ---------- start chooser (no active workout) ---------- */
function StartChooser() {
  const { t } = useTranslation();
  const { weekdays } = useDateLabels();
  const nav = useNavigate();
  const appState = useStore((state) => state.appState);
  const todayR = effectiveRoutine(appState, todayISO());
  const routineIdRef = useRef<Id | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const openStart = (nextRoutineId: Id | null) => {
    routineIdRef.current = nextRoutineId;
    setSheetOpen(true);
  };
  const todayOvr = appState.dayPlan[todayISO()] !== undefined;
  const others = appState.routines.filter((r) => r !== todayR);
  return (
    <div className="mx-auto max-w-140">
      <Header
        variant="h1"
        className="mt-2 mb-4.5"
        description={
          <>
            {weekdays[new Date().getDay()]} —{" "}
            {todayR
              ? t("workout.todayIs", "today is {{day}}", { day: todayR.name })
              : t("workout.restDayNoOneS", "rest day, but no one’s stopping you")}
          </>
        }
      >
        {t("workout.startWorkout", "Start workout")}
      </Header>
      {todayR && (
        <div className="mb-3 rounded-lg border border-primary bg-card p-4">
          <h2 className="mb-3 text-sm font-normal tracking-tight text-foreground/60">
            {t("workout.todaySPlan", "Today's plan")}
            {todayOvr ? " · " + t("calendar.status.rescheduledLowercase", "rescheduled") : ""}
          </h2>
          <div className="mb-3 flex items-center justify-between gap-3">
            <div>
              <div className="text-3xl leading-tight font-semibold tracking-tight">
                {todayR.name}
              </div>
              <div className="text-sm leading-snug text-foreground/60">
                {exCount(t, todayR.ex.length)}
              </div>
            </div>
            <span className="flex size-9.5 flex-none items-center justify-center rounded-md bg-primary text-2xl text-white">
              <Icon name={glyphOf(todayR.emoji)} />
            </span>
          </div>
          <Button className="w-full" variant="default" onClick={() => openStart(todayR.id)}>
            <Icon name="play" />
            {t("common.startNamed", "Start {{routine}}", { routine: todayR.name })}
          </Button>
        </div>
      )}
      {others.length > 0 && (
        <>
          <h2 className="mt-5.5 mb-2 px-1 text-sm font-normal tracking-tight text-foreground/60">
            {t("workout.otherRoutines", "Other routines")}
          </h2>
          <SpaceBetween size="xs">
            {others.map((routine) => (
              <button
                type="button"
                key={routine.id}
                className="flex min-h-15 w-full items-center gap-3 rounded-lg bg-card px-3 py-2.5 text-left transition-colors duration-140 active:bg-muted"
                onClick={() => openStart(routine.id)}
              >
                <span className="flex size-7 flex-none items-center justify-center rounded-sm bg-primary text-lg text-white">
                  <Icon name={glyphOf(routine.emoji)} />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="text-base leading-tight font-normal tracking-tight">
                    {routine.name}
                  </div>
                  <div className="mt-0.5 text-sm text-foreground/60">
                    {exCount(t, routine.ex.length)}
                  </div>
                </div>
                <span className="inline-flex items-center gap-1 rounded-sm bg-primary/15 px-2 py-0.5 text-xs font-medium text-primary">
                  {t("common.start", "Start")}
                </span>
              </button>
            ))}
          </SpaceBetween>
        </>
      )}
      <SpaceBetween size="xs" className="pt-4">
        <Button className="w-full" onClick={() => openStart(null)}>
          <Icon name="shuffle" />
          {t("workout.freestyleWorkoutPickGo", "Freestyle workout (pick as you go)")}
        </Button>
        {appState.routines.length === 0 && (
          <Button className="w-full" variant="default" onClick={() => nav({ to: "/plan" })}>
            {t("workout.buildPlanFirst", "Build a plan first")}
          </Button>
        )}
      </SpaceBetween>
      <Sheet
        open={sheetOpen}
        onOpenChange={(open) => {
          // This workflow closes only through one of its explicit start/change actions.
          if (open) setSheetOpen(true);
        }}
      >
        <SheetContent
          side="bottom"
          showCloseButton={false}
          className="max-h-screen touch-pan-y overflow-y-auto overscroll-contain rounded-2xl bg-sheet p-2 px-4.5 pb-5 lg:inset-x-auto lg:left-1/2 lg:w-160 lg:-translate-x-1/2"
        >
          <SheetTitle className="sr-only">{t("weight.quickCheck", "Quick check-in")}</SheetTitle>
          <div className="mx-auto mt-1.5 mb-3.5 h-1 w-9 rounded-full bg-foreground/20" />
          <PreWorkoutBodyweightSheet
            onDone={(bodyweight) => {
              setSheetOpen(false);
              beginWorkout(
                routineIdRef.current,
                bodyweight,
                t("workout.type.freestyle", "Freestyle"),
              );
              void nav({ to: "/workout" });
            }}
            onChooseDifferentWorkout={() => setSheetOpen(false)}
          />
        </SheetContent>
      </Sheet>
    </div>
  );
}

/* ---------- elapsed clock (isolated so the workout tree doesn't re-render every second) ---------- */
function Elapsed({ start }: { start: number }) {
  const [elapsedText, setElapsedText] = useState("0:00");
  useEffect(() => {
    const tick = () => {
      const s = Math.floor((Date.now() - start) / 1000);
      setElapsedText(Math.floor(s / 60) + ":" + String(s % 60).padStart(2, "0"));
    };
    tick();
    const iv = setInterval(tick, 1000);
    return () => clearInterval(iv);
  }, [start]);
  return <span>{elapsedText}</span>;
}

/* One stepper column over a logged set. `f` names the field on the set; `eff`/`opt` only
   appear on the effort column. */
interface Col {
  f: SetField;
  step: number;
  dec: boolean;
  hd: string;
  eff?: EffortKind; // effort columns walk their own scale (stepEffort/capEffort)
  opt?: boolean; // an unlogged effort is not 0 — clearing drops the key instead
  min?: number;
}
type SetField = "w" | "r" | "sec" | "min" | "speed" | "rir" | "rpe";

// LoggedSet deliberately has no persisted discriminant. Read and write fields through the
// field names that identify each shape instead of casting a set to an arbitrary record.
const fieldOf = (set: LoggedSet, field: SetField): number | undefined => {
  switch (field) {
    case "w":
      return "w" in set ? set.w : undefined;
    case "r":
      return "r" in set ? set.r : undefined;
    case "sec":
      return "sec" in set ? set.sec : undefined;
    case "min":
      return "min" in set ? set.min : undefined;
    case "speed":
      return "speed" in set ? set.speed : undefined;
    case "rir":
      return "r" in set || "sec" in set ? set.rir : undefined;
    case "rpe":
      return "r" in set || "sec" in set ? set.rpe : undefined;
  }
};

const setFieldValue = (set: LoggedSet, field: SetField, value: number | null) => {
  switch (field) {
    case "w":
      if ("w" in set) set.w = value ?? 0;
      return;
    case "r":
      if ("r" in set) set.r = value ?? 0;
      return;
    case "sec":
      if ("sec" in set) set.sec = value ?? 0;
      return;
    case "min":
      if ("min" in set) set.min = value ?? 0;
      return;
    case "speed":
      if ("speed" in set) set.speed = value ?? 0;
      return;
    case "rir":
      if ("r" in set || "sec" in set) {
        if (value == null) delete set.rir;
        else set.rir = value;
      }
      return;
    case "rpe":
      if ("r" in set || "sec" in set) {
        if (value == null) delete set.rpe;
        else set.rpe = value;
      }
  }
};

const weightOf = (set?: LoggedSet) => (set && "w" in set ? set.w : undefined);
const repsOf = (set: LoggedSet) => ("r" in set ? set.r : undefined);
const hasWeight = (set: LoggedSet) => {
  const weight = weightOf(set);
  return weight !== undefined && weight > 0;
};

/* ---------- one exercise block (reps: weight×reps · time: a held duration · cardio: duration+speed) ---------- */
function ExerciseBlock({
  entryIdx,
  compact,
  onToggle,
  onField,
  onAddSet,
  onRemoveSet,
  onToggleWarmup,
  onStartTimed,
  setWorkoutSheet,
}: {
  entryIdx: number;
  compact?: boolean;
  onToggle: (i: number) => void;
  onField: (i: number, f: SetField, v: number | null) => void;
  onAddSet: () => void;
  onRemoveSet: () => void;
  onToggleWarmup: () => void;
  onStartTimed: (i: number) => void;
  setWorkoutSheet: SetWorkoutSheet;
}) {
  const { t } = useTranslation();
  const effortLabels = useEffortLabels();
  const metadata = useExerciseMetadataLabels();
  const appState = useStore((state) => state.appState);
  const working = useWorkoutTimer((state) => state.work);
  const [setKeys] = useState(() => new Map<string, string>());
  if (!appState.active) return null;
  const A: ActiveWorkout = appState.active;
  const entry = A.entries[entryIdx];
  const setKeyFor = (position: number) => {
    const mapKey = `${entry.id}:${position}`;
    const existing = setKeys.get(mapKey);
    if (existing) return existing;
    const key = `${entry.id}-set-${setKeys.size}`;
    setKeys.set(mapKey, key);
    return key;
  };
  const ex = exOr(entry.id);
  const mode = modeOf({ ...entry.target, id: entry.id });
  const cardio = mode === "cardio";
  const timed = mode === "time";
  const last = lastEntryFor(appState, entry.id);
  // The same number the "confirm your working weight" sheet calls your best, so the two
  // never disagree inside one session: heaviest logged set, or the working weight you kept.
  const best = cardio
    ? 0
    : Math.max(bestWeightFor(appState, entry.id), (appState.exWeights[entry.id] || {}).w || 0);
  // What the progression policy decided for this session, and why (issue #17). Computed when
  // the session was built so the reason matches the numbers already in the rows.
  const plan = entry.plan;
  // A bodyweight set has no weight to type, so the column is not there (issue #32) — one
  // stepper instead of two, which is the whole point of the flag. Adding a belt weight in the
  // config brings it back, now labelled as the addition it is.
  const cfg = { ...entry.target, id: entry.id };
  const bw = !cardio && isBw(cfg);
  const barbell = !bw && isBarbellEq(ex);
  const emptyBar = barbell ? barWeightFor(appState.unit, appState.plates) : 0;
  const added = bw && entry.sets.some((set) => (weightOf(set) ?? 0) > 0);
  const hasWarmup = entry.sets.some(isWarmup);
  // The load the plate breakdown is drawn for: the set you're working on, else the last
  // one. Only loaded rep work has plates to put on a bar.
  const plateWeight =
    mode === "reps" && barbell
      ? (weightOf(entry.sets.find((set) => !set.done && !isWarmup(set)) ?? entry.sets.at(-1)) ?? 0)
      : 0;
  const loadCol: Col = {
    f: "w",
    step: barbell && appState.unit === "lb" ? 5 : 2.5,
    dec: true,
    min: emptyBar,
    hd: bw
      ? t("exercise.measurement.added", "Added ({{unit}})", { unit: appState.unit })
      : barbell
        ? t("exercise.totalWeight", "Total weight ({{unit}})", { unit: appState.unit })
        : t("exercise.weight", "Weight ({{unit}})", { unit: appState.unit }),
  };
  // The reps column is the total in every mode, unilateral included — the stepper walks in
  // twos there so the number you land on is one you can actually split evenly.
  const repCol: Col = { f: "r", step: repStep(cfg), dec: false, hd: t("exercise.reps", "Reps") };
  const col1: Col = cardio
    ? { f: "min", step: 1, dec: false, hd: t("workout.durationMin", "Duration (min)") }
    : timed
      ? { f: "sec", step: 5, dec: false, hd: t("progression.seconds", "Seconds") }
      : bw && !added
        ? repCol
        : loadCol;
  const col2: Col | null = cardio
    ? { f: "speed", step: 0.5, dec: true, hd: t("exercise.speedKmH", "Speed (km/h)") }
    : timed
      ? bw && !added
        ? null
        : loadCol
      : bw && !added
        ? null
        : repCol;
  // Effort (RIR or RPE, whichever the profile logs) only makes sense for weighted rep sets,
  // not cardio/timed holds, and is opt-in since it adds a third stepper to every row. `opt`
  // because an unlogged effort is not the same as 0 — RIR 0 says the set went to failure.
  const kind = effortOf(appState);
  const col3: Col | null =
    mode !== "reps" || kind === "none"
      ? null
      : {
          ...EFFORT[kind],
          eff: kind,
          dec: true,
          opt: true,
          hd: kind === "rir" ? effortLabels.rir : effortLabels.rpe,
        };
  // The effort column walks its own scale — see stepEffort. Weight and reps step up from 0
  // with no ceiling, as they always did.
  const bump = (s: LoggedSet, i: number, col: Col, dir: number) => {
    const cur = fieldOf(s, col.f);
    if (col.eff) return onField(i, col.f, stepEffort(col.eff, cur ?? null, dir));
    onField(
      i,
      col.f,
      Math.max(col.min ?? 0, Math.round(((cur || 0) + dir * col.step) * 100) / 100),
    );
  };
  // Uses the shared stepper markup so a set row picks up the same control styling
  // as every other +/- field in the app.
  const cell = (s: LoggedSet, i: number, col: Col, cls: string) => (
    <div
      className={`min-w-0 sm:col-span-1 sm:flex-1 ${
        (col3 && cls === "eff") || (!col2 && cls === "w") ? "col-span-2" : ""
      }`}
    >
      <span className="mb-1 block text-center text-xs font-medium tracking-wide text-muted-foreground uppercase sm:hidden">
        {col.hd}
      </span>
      <div className="flex min-w-0 items-center overflow-hidden rounded-md bg-muted">
        <button
          type="button"
          className={`${col3 ? (cls === "eff" ? "sm:w-5" : "sm:w-6") : "sm:w-8"} flex size-11 flex-none items-center justify-center text-foreground transition-colors duration-140 active:bg-input sm:h-10`}
          aria-label={`Decrease ${ex.n}, ${t("exercise.sets", "Sets")} ${i + 1}, ${col.hd}`}
          onClick={() => bump(s, i, col, -1)}
        >
          <Icon name="minus" />
        </button>
        <span className="flex min-w-10 flex-1 items-baseline justify-center gap-1 px-0.5 sm:min-w-0">
          <NumberField
            aria-label={`${ex.n}, ${t("exercise.sets", "Sets")} ${i + 1}, ${col.hd}`}
            decimal={col.dec}
            nullable={col.opt}
            value={fieldOf(s, col.f)}
            className={col3 ? "text-sm" : undefined}
            onChange={(v) =>
              onField(
                i,
                col.f,
                (col.eff ? capEffort(col.eff, v) : Math.max(col.min ?? 0, v ?? 0)) ?? null,
              )
            }
          />
        </span>
        <button
          type="button"
          className={`${col3 ? (cls === "eff" ? "sm:w-5" : "sm:w-6") : "sm:w-8"} flex size-11 flex-none items-center justify-center text-foreground transition-colors duration-140 active:bg-input sm:h-10`}
          aria-label={`Increase ${ex.n}, ${t("exercise.sets", "Sets")} ${i + 1}, ${col.hd}`}
          onClick={() => bump(s, i, col, 1)}
        >
          <Icon name="plus" />
        </button>
      </div>
    </div>
  );
  return (
    <>
      <Media exercise={ex} key={entry.id} compact={compact} minimizable />
      <div className="mb-1.5 flex items-center justify-between gap-3">
        <div
          className={`${compact ? "text-lg" : "text-xl"} leading-tight font-semibold tracking-tight capitalize`}
        >
          {ex.n}
        </div>
        <button
          className="flex size-11 flex-none items-center justify-center rounded-full bg-card text-lg text-foreground transition duration-140 active:scale-95 active:bg-muted sm:size-9"
          aria-label={t("common.details", "Details")}
          onClick={() => setWorkoutSheet({ type: "detail", exercise: ex })}
        >
          <Icon name="info" />
        </button>
      </div>
      <div className="mb-2 flex flex-wrap items-center gap-1.5">
        {cardio && (
          <span className="inline-flex items-center gap-1 rounded-sm bg-primary/15 px-2 py-0.5 text-xs font-medium text-primary">
            <Icon name="figureRun" />
            {t("workout.type.cardio", "Cardio")}
          </span>
        )}
        {/* You log the total; this is the split, so the set in front of you is unambiguous
          without the rep count having to mean two different things (issue #31). */}
        {!cardio && !timed && isPerSide(cfg) && (
          <span className="inline-flex items-center gap-1 rounded-sm bg-primary/15 px-2 py-0.5 text-xs font-medium text-primary normal-case">
            <Icon name="shuffle" />
            {t("exercise.measurement.perSide", "{{value}} per side", {
              value: fmtNum(sideReps(repsOf(entry.sets.find((set) => !set.done) ?? entry.sets[0]))),
            })}
          </span>
        )}
        {(ex.tg || ex.bp) && (
          <span className="inline-flex items-center gap-1 rounded-sm bg-muted px-2 py-0.5 text-xs font-medium text-foreground/60 capitalize">
            {metadata.muscle(ex.tg || ex.bp)}
          </span>
        )}
        {ex.eq && (
          <span className="inline-flex items-center gap-1 rounded-sm bg-muted px-2 py-0.5 text-xs font-medium text-foreground/60 capitalize">
            {metadata.equipment(ex.eq)}
          </span>
        )}
        {best > 0 && (
          <span className="inline-flex items-center gap-1 rounded-sm bg-muted px-2 py-0.5 text-xs font-medium text-foreground/60 normal-case">
            {t("exercise.best", "Best:")} {fmtNum(best)} {appState.unit}
          </span>
        )}
      </div>
      {last && (
        <div className="mb-1 text-sm leading-snug text-muted-foreground">
          {t("workout.lastTime", "Last time")} ({fmtDate(t, last.d)}):{" "}
          {last.sets.map((s) => setLabel(entry.id, s, last.target)).join(", ")}
        </div>
      )}
      {plan && plan.why && plan.kind !== "off" && (
        <div
          className={`my-1.5 flex items-start gap-2 text-sm leading-snug ${plan.kind === "deload" ? "text-warning" : "text-primary"}`}
        >
          <Icon
            name={
              plan.kind === "up" ? "arrowUp" : plan.kind === "deload" ? "arrowDown" : "lightbulb"
            }
          />
          <span>{translatedReason(t, plan.why)}</span>
        </div>
      )}
      <div className="mt-2.5 rounded-lg bg-card p-4">
        {/* the header carries the same eff3 sizing as the rows, or the labels drift off their columns */}
        <div
          className={`hidden items-center gap-2 pb-1.5 text-xs font-medium tracking-wider text-muted-foreground uppercase sm:flex ${col3 ? "gap-1.5" : ""}`}
        >
          <span className="w-6 flex-none" />
          <span className={`${col3 ? "flex-1" : "flex-1"} text-center`}>{col1.hd}</span>
          {col2 && <span className="flex-1 text-center">{col2.hd}</span>}
          {col3 && <span className="flex-1 text-center">{col3.hd}</span>}
          {timed && <span className="w-7.5 flex-none" />}
          <span className="w-7.5 flex-none" />
        </div>
        {entry.sets.map((s, index) => (
          <div
            // Sets are only appended or removed from the end, so the position is a stable
            // identity. Do not derive keys from values: typing or checking a set must not
            // remount its NumberField and discard its local input draft.
            key={setKeyFor(index)}
            className={`relative grid grid-cols-2 gap-2 py-3 before:absolute before:inset-x-0 before:top-0 before:h-px before:bg-border/60 first:before:hidden sm:flex sm:items-center sm:py-2 sm:before:left-8 ${col3 ? "sm:gap-1.5" : ""}`}
          >
            <div
              className={`col-span-2 flex size-6 flex-none items-center justify-center rounded-full text-xs font-medium text-foreground/60 transition-colors duration-140 sm:col-span-1 ${
                s.done
                  ? "bg-primary text-primary-foreground"
                  : isWarmup(s)
                    ? "border border-dashed border-foreground/40"
                    : "bg-muted"
              }`}
              title={isWarmup(s) ? t("workout.warmupSet", "Warm-up set") : undefined}
            >
              {index + 1}
            </div>
            {cell(s, index, col1, "w")}
            {col2 && cell(s, index, col2, "r")}
            {col3 && cell(s, index, col3, "eff")}
            {/* A timed set is started, not typed: the timer counts the hold down and checks the
            set off itself. The checkbox stays for anyone who timed it on their own watch. */}
            {timed && (
              <button
                className="absolute top-2.5 right-10 flex size-11 flex-none items-center justify-center rounded-full bg-muted text-sm text-primary transition duration-140 active:bg-input disabled:cursor-default disabled:opacity-30 sm:static sm:size-7.5"
                aria-label={t("progression.startSet", "Start set")}
                disabled={s.done || !!working}
                onClick={() => onStartTimed(index)}
              >
                <Icon name="play" />
              </button>
            )}
            <Checkbox
              aria-label={`${ex.n}, ${t("exercise.sets", "Sets")} ${index + 1}, ${t("common.done", "Done")}`}
              checked={s.done}
              className="absolute top-3 right-0 size-6 sm:relative sm:top-auto sm:right-auto sm:size-4"
              onCheckedChange={() => onToggle(index)}
            />
          </div>
        ))}
        <div className="h-2" />
        {plateWeight > 0 && <PlateRow weight={plateWeight} />}
        <div className="mt-2.5 flex flex-wrap items-center gap-3">
          <Button size="sm" disabled={entry.sets.length <= 1} onClick={onRemoveSet}>
            <Icon name="minus" />
            {t("workout.removeSet", "Remove set")}
          </Button>
          <Button size="sm" onClick={onAddSet}>
            <Icon name="plus" />
            {t("workout.addSet", "Add set")}
          </Button>
          {mode === "reps" && (
            <Button
              size="sm"
              variant={hasWarmup ? "default" : "ghost"}
              onClick={onToggleWarmup}
              title={t(
                "workout.warmupRampDescription",
                "Insert a percentage ramp (40% × 8 · 60% × 5 · 80% × 3) before your work sets",
              )}
            >
              <Icon name="flame" />
              {t("workout.warmup", "Warm-up")}
            </Button>
          )}
        </div>
      </div>
    </>
  );
}

function WorkoutSessionHeader({
  name,
  start,
  done,
  total,
  onDiscard,
  onFinish,
}: {
  name: string;
  start: number;
  done: number;
  total: number;
  onDiscard: () => void;
  onFinish: () => void;
}) {
  const { t } = useTranslation();
  return (
    <div className="mt-2 mb-4.5 flex items-end justify-between gap-3">
      <button
        className="flex size-11 flex-none items-center justify-center rounded-full bg-card text-lg text-foreground transition duration-140 active:scale-95 active:bg-muted sm:size-9"
        aria-label={t("common.discard", "Discard")}
        onClick={onDiscard}
      >
        <Icon name="xmark" />
      </button>
      <div className="text-center">
        <h1 className="font-semibold">{name}</h1>
        <div className="mt-1 text-base tracking-tight text-foreground/60">
          <Elapsed start={start} /> ·{" "}
          {t("workout.completion.setProgress", "{{progress}} sets", {
            progress: done + "/" + total,
          })}
        </div>
      </div>
      <button
        className="flex size-11 flex-none items-center justify-center rounded-full bg-card text-lg text-primary transition duration-140 active:scale-95 active:bg-muted sm:size-9"
        aria-label={t("common.finish", "Finish")}
        onClick={onFinish}
      >
        <Icon name="check" />
      </button>
    </div>
  );
}

function WorkoutExerciseList({
  activeWorkout,
  currentEntry,
  unit,
  unitIndex,
  unitCount,
  isSuperset,
  setField,
  addSet,
  removeSet,
  toggleWarmup,
  startTimed,
  toggle,
  setWorkoutSheet,
}: {
  activeWorkout: ActiveWorkout;
  currentEntry: number;
  unit: number[];
  unitIndex: number;
  unitCount: number;
  isSuperset: boolean;
  setField: (entryIdx: number, setIdx: number, field: SetField, value: number | null) => void;
  addSet: (entryIdx: number) => void;
  removeSet: (entryIdx: number) => void;
  toggleWarmup: (entryIdx: number) => void;
  startTimed: (entryIdx: number, setIdx: number) => void;
  toggle: (entryIdx: number, setIdx: number) => void;
  setWorkoutSheet: SetWorkoutSheet;
}) {
  const { t } = useTranslation();
  if (!activeWorkout.entries.length) {
    return (
      <div className="px-5 py-11 text-center text-base leading-normal text-foreground/60">
        <div className="mb-3 flex justify-center text-4xl text-foreground/60">
          <Icon name="shuffle" />
        </div>
        {t(
          "workout.freestyleWorkoutAddFirstExercise",
          "Freestyle workout — add your first exercise.",
        )}
      </div>
    );
  }
  return (
    <>
      <div className="mb-1.5 text-sm leading-snug text-foreground/60">
        {isSuperset
          ? t("workout.superset", "Superset {{current}} / {{total}}", {
              current: unitIndex + 1,
              total: unitCount,
            })
          : t("workout.exercise", "Exercise {{current}} / {{total}}", {
              current: unitIndex + 1,
              total: unitCount,
            })}
      </div>
      {isSuperset ? (
        <div className="rounded-xl bg-card p-3.5 ring-2 ring-primary/40">
          <div className="mb-3 flex items-center justify-center gap-1.5 text-center text-xs font-semibold text-primary">
            <Icon name="link" />
            {t(
              "workout.supersetTheseBackBackRest",
              "Superset · do these back-to-back, rest after both",
            )}
          </div>
          {unit.map((idx, index) => (
            <div key={idx} className="relative">
              {index > 0 && (
                <div className="my-3.5 mb-2 text-center text-base font-semibold text-primary">
                  +
                </div>
              )}
              <ExerciseBlock
                entryIdx={idx}
                compact
                onToggle={(setIdx) => toggle(idx, setIdx)}
                onField={(setIdx, field, value) => setField(idx, setIdx, field, value)}
                onAddSet={() => addSet(idx)}
                onRemoveSet={() => removeSet(idx)}
                onToggleWarmup={() => toggleWarmup(idx)}
                onStartTimed={(setIdx) => startTimed(idx, setIdx)}
                setWorkoutSheet={setWorkoutSheet}
              />
            </div>
          ))}
        </div>
      ) : (
        <ExerciseBlock
          entryIdx={currentEntry}
          onToggle={(setIdx) => toggle(currentEntry, setIdx)}
          onField={(setIdx, field, value) => setField(currentEntry, setIdx, field, value)}
          onAddSet={() => addSet(currentEntry)}
          onRemoveSet={() => removeSet(currentEntry)}
          onToggleWarmup={() => toggleWarmup(currentEntry)}
          onStartTimed={(setIdx) => startTimed(currentEntry, setIdx)}
          setWorkoutSheet={setWorkoutSheet}
        />
      )}
    </>
  );
}

function useWorkoutSessionActions({
  activeWorkout,
  appState,
  unit,
  units,
  unitIndex,
  update,
  startRest,
  stopRest,
  setWorkoutSheet,
  setConfirmation,
  completeSession,
  t,
}: {
  activeWorkout: ActiveWorkout;
  appState: AppState;
  unit: number[];
  units: number[][];
  unitIndex: number;
  update: (mutate: (draft: AppState) => void, push?: boolean) => void;
  startRest: (seconds: number) => void;
  stopRest: () => void;
  setWorkoutSheet: SetWorkoutSheet;
  setConfirmation: (confirmation: WorkoutConfirmation | null) => void;
  completeSession: () => void;
  t: TFunction;
}) {
  const mutEntry = (idx: number, fn: (entry: ActiveWorkout["entries"][number]) => void) =>
    update((state) => {
      if (!state.active) return;
      fn(state.active.entries[idx]);
    }, true);
  const setField = (idx: number, setIdx: number, field: SetField, value: number | null) =>
    mutEntry(idx, (entry) => {
      const set = entry.sets[setIdx];
      if (set) setFieldValue(set, field, value);
    });
  const modeAt = (idx: number) =>
    modeOf({ ...activeWorkout.entries[idx].target, id: activeWorkout.entries[idx].id });
  const addSet = (idx: number) =>
    mutEntry(idx, (entry) => {
      const last = entry.sets.at(-1);
      const mode = modeOf({ ...entry.target, id: entry.id });
      if (mode === "cardio") {
        const previous = last && "min" in last ? last : undefined;
        entry.sets.push({
          min: previous ? previous.min : entry.target.min || 20,
          speed: previous ? previous.speed : entry.target.speed || 8,
          done: false,
        });
      } else if (mode === "time") {
        const previous = last && "sec" in last ? last : undefined;
        entry.sets.push({
          sec: previous ? previous.sec : entry.target.sec || 45,
          w: previous ? previous.w || 0 : entry.target.weight || 0,
          done: false,
        });
      } else {
        const previous = last && "r" in last ? last : undefined;
        entry.sets.push({
          w: previous ? previous.w : 0,
          r: previous ? previous.r : (entry.target.reps ?? 0),
          done: false,
        });
      }
    });
  const removeSet = (idx: number) =>
    mutEntry(idx, (entry) => {
      if (entry.sets.length > 1) entry.sets.pop();
    });
  // Warm-up ramp: inserts 40/60/80% sets in front of the work sets, or strips them all
  // back off when tapped again. The ramp is rebuilt from the heaviest weight in sight
  // (plan target or a seeded/logged set) so it always leads up to what you're about to do.
  const toggleWarmup = (idx: number) => {
    const removing = !!activeWorkout.entries[idx]?.sets.some(isWarmup);
    let built = false;
    mutEntry(idx, (draftEntry) => {
      if (removing) {
        draftEntry.sets = draftEntry.sets.filter((set) => !isWarmup(set));
        return;
      }
      const top = Math.max(
        draftEntry.target.weight || 0,
        ...draftEntry.sets.map((set) => weightOf(set) ?? 0),
      );
      const ramp = warmupSets(top, appState.unit);
      if (ramp.length > 0) {
        draftEntry.sets = [...ramp, ...draftEntry.sets];
        built = true;
      }
    });
    // A ramp needs a load to ramp toward: say so instead of doing nothing.
    if (!removing && !built)
      toast(
        t(
          "workout.warmupNeedsWorkingWeight",
          "Set a working weight first — there's nothing to warm up to.",
        ),
      );
  };
  const toggle = (idx: number, setIdx: number) => {
    const mode = modeAt(idx);
    const cardio = mode === "cardio";
    const isLastUnit = unitIndex >= units.length - 1;
    const pending = activeWorkout.entries[idx]?.sets[setIdx];
    if (
      pending &&
      !pending.done &&
      mode === "reps" &&
      !isWarmup(pending) &&
      !isBw({ ...activeWorkout.entries[idx].target, id: activeWorkout.entries[idx].id }) &&
      !hasWeight(pending)
    ) {
      toast(
        t("workout.workingSetNeedsWeight", "Log a weight for this set before checking it off."),
      );
      return;
    }
    let askTop = false;
    let exerciseDone = false;
    let workoutDone = false;
    mutEntry(idx, (entry) => {
      const set = entry.sets[setIdx];
      if (!set) return;
      set.done = !set.done;
      if (!set.done) return;
      beep(appState.sound, 1040, 0.12);
      vibrate(30);
      const isLastExercise = idx === unit.at(-1);
      const unitDone = unit.every((entryIndex) =>
        (entryIndex === idx ? entry : activeWorkout.entries[entryIndex]).sets.every(
          (item) => item.done,
        ),
      );
      if (isLastExercise && !unitDone) startRest(appState.restSec);
      else if (unitDone) stopRest();
      if (unitDone && isLastUnit) workoutDone = true;
      const loaded =
        mode === "reps" &&
        !(isBw({ ...entry.target, id: entry.id }) && !entry.sets.some(hasWeight));
      if (entry.sets.every((item) => item.done)) {
        exerciseDone = true;
        if (loaded && !entry.asked) {
          entry.asked = true;
          askTop = true;
        }
      }
    });
    if (askTop) setWorkoutSheet({ type: "top-weight", entryIdx: idx });
    else if (workoutDone) setWorkoutSheet({ type: "workout-complete" });
    else if (exerciseDone && cardio) toast(t("workout.cardioLogged", "Cardio logged"));
    else if (exerciseDone && mode === "time") toast(t("progression.holdLogged", "Hold logged"));
  };
  const startTimed = (idx: number, setIdx: number) => {
    const entry = activeWorkout.entries[idx];
    const set = entry?.sets[setIdx];
    if (!set || !("sec" in set)) return;
    useWorkoutTimer.getState().startWork(set.sec || 45, exOr(entry.id).n, (elapsed) => {
      mutEntry(idx, (nextEntry) => {
        const nextSet = nextEntry.sets[setIdx];
        if (nextSet && "sec" in nextSet) nextSet.sec = elapsed;
      });
      const nextSet = useStore.getState().appState.active?.entries[idx]?.sets[setIdx];
      if (nextSet && !nextSet.done) toggle(idx, setIdx);
    });
  };
  const requestFinish = () => {
    const done = setsDoneActive(activeWorkout);
    const total = activeWorkout.entries.reduce(
      (count, entry) => count + entry.sets.filter((set) => !isWarmup(set)).length,
      0,
    );
    if (!done) {
      setConfirmation({
        title: t("workout.completion.nothingLoggedYet", "Nothing logged yet"),
        message: t(
          "workout.completion.havenTCheckedOffAny",
          "You haven’t checked off any sets. Finish the workout anyway?",
        ),
        confirmText: t("workout.completion.finishAnyway", "Finish anyway"),
        onConfirm: completeSession,
      });
      return;
    }
    if (done < total) {
      const remaining = total - done;
      setConfirmation({
        title: t("workout.completion.finishEarly", "Finish early?"),
        message: t(
          "workout.completion.uncheckedSetWarning",
          "{{count}} set still unchecked. Finish the workout now?",
          { count: remaining },
        ),
        confirmText: t("workout.completion.finishWorkout", "Finish workout"),
        onConfirm: completeSession,
      });
      return;
    }
    completeSession();
  };
  return { setField, addSet, removeSet, toggleWarmup, startTimed, toggle, requestFinish };
}

/* ---------- active workout ---------- */
function ActiveWorkoutSession({
  activeWorkout,
  onComplete,
}: {
  activeWorkout: ActiveWorkout;
  onComplete: (summary: FinishSummaryPayload) => void;
}) {
  const { t } = useTranslation();
  const nav = useNavigate();
  const appState = useStore((state) => state.appState);
  const update = useStore((state) => state.update);
  const userId = useStore((state) => state.user?.id);
  const startRest = useWorkoutTimer((state) => state.startRest);
  const stopRest = useWorkoutTimer((state) => state.stopRest);
  const stopWork = useWorkoutTimer((state) => state.stopWork);
  const [workoutSheet, setWorkoutSheet] = useState<WorkoutSheetState | null>(null);
  const [confirmation, setConfirmation] = useState<WorkoutConfirmation | null>(null);
  const closeWorkoutSheet: SheetClose = () => {
    setWorkoutSheet(null);
    return Promise.resolve();
  };
  const completeActiveWorkout = () => {
    const summary = completeWorkout();
    if (summary) onComplete(summary);
  };
  const A = activeWorkout;
  const units = supersetUnits(A.entries);
  const cur = Math.min(A.cur, Math.max(0, A.entries.length - 1));
  const unit = A.entries.length > 0 ? unitOf(units, cur) : [];
  const unitIdx = units.findIndex((u) => u === unit);
  const isSuperset = unit.length > 1;

  // Working sets only — warm-up rows are optional preparation and don't belong in the
  // session progress count.
  const total = A.entries.reduce((n, e) => n + e.sets.filter((s) => !isWarmup(s)).length, 0);
  const done = setsDoneActive(A);

  const { setField, addSet, removeSet, toggleWarmup, startTimed, toggle, requestFinish } =
    useWorkoutSessionActions({
      activeWorkout: A,
      appState,
      unit,
      units,
      unitIndex: unitIdx,
      update,
      startRest,
      stopRest,
      setWorkoutSheet,
      setConfirmation,
      completeSession: completeActiveWorkout,
      t,
    });

  // Live-presence heartbeat so the admin dashboard can show who's training now. Signed-in only —
  // guests have no server session. Reads fresh state each tick so progress stays current.
  useEffect(() => {
    if (!userId) return;
    let stopped = false;
    const ping = (active: boolean) => {
      const A2 = useStore.getState().appState.active;
      if (!A2) return;
      const u = supersetUnits(A2.entries);
      const c = Math.min(A2.cur, Math.max(0, A2.entries.length - 1));
      const ui = u.findIndex((x) => x.includes(c));
      const tot = A2.entries.reduce((n, e) => n + e.sets.filter((s) => !isWarmup(s)).length, 0);
      api("/api/activity", {
        method: "POST",
        body: JSON.stringify({
          active,
          name: A2.name,
          exIdx: ui + 1,
          exTotal: u.length,
          setsDone: setsDoneActive(A2),
          setsTotal: tot,
          startedAt: A2.start,
        }),
      }).catch(() => {});
    };
    ping(true);
    const iv = setInterval(() => {
      if (!stopped) ping(true);
    }, 20000);
    return () => {
      stopped = true;
      clearInterval(iv);
      // best-effort "left" signal: sendBeacon survives a tab close, fetch covers in-app nav
      try {
        navigator.sendBeacon?.(
          "/api/activity",
          new Blob([JSON.stringify({ active: false })], {
            type: "application/json",
          }),
        );
      } catch {
        /* */
      }
      api("/api/activity", {
        method: "POST",
        body: JSON.stringify({ active: false }),
      }).catch(() => {});
    };
  }, [userId]);

  const requestDiscard = () =>
    setConfirmation({
      title: t("workout.discardWorkout", "Discard workout?"),
      message: t(
        "workout.setsLoggedSessionWillLost",
        "The sets you logged in this session will be lost.",
      ),
      confirmText: t("common.discard", "Discard"),
      danger: true,
      onConfirm: () => {
        update((s) => {
          s.active = null;
        });
        stopRest();
        stopWork();
        void nav({ to: "/home" });
      },
    });

  return (
    <>
      <div className="mx-auto max-w-140">
        <WorkoutSessionHeader
          name={A.name}
          start={A.start}
          done={done}
          total={total}
          onDiscard={requestDiscard}
          onFinish={requestFinish}
        />
        <div className="mb-4 h-1 overflow-hidden rounded-full bg-muted">
          <i
            className="block h-full rounded-full bg-primary transition-all duration-220 ease-out"
            style={{ width: `${total ? (done / total) * 100 : 0}%` }}
          />
        </div>

        <WorkoutExerciseList
          activeWorkout={A}
          currentEntry={cur}
          unit={unit}
          unitIndex={unitIdx}
          unitCount={units.length}
          isSuperset={isSuperset}
          setField={setField}
          addSet={addSet}
          removeSet={removeSet}
          toggleWarmup={toggleWarmup}
          startTimed={startTimed}
          toggle={toggle}
          setWorkoutSheet={setWorkoutSheet}
        />

        <SpaceBetween size="s" className="pt-3 pb-10">
          <SpaceBetween direction="horizontal" size="s" alignItems="center" className="flex-nowrap">
            <Button
              className="w-0 flex-1 shrink"
              disabled={unitIdx <= 0}
              onClick={() =>
                update((s) => {
                  if (s.active) s.active.cur = units[unitIdx - 1][0];
                })
              }
            >
              <Icon name="chevronLeft" />
              {t("common.previous", "Prev")}
            </Button>
            <Button
              className="w-0 flex-1 shrink"
              disabled={unitIdx < 0 || unitIdx >= units.length - 1}
              onClick={() =>
                update((s) => {
                  if (s.active) s.active.cur = units[unitIdx + 1][0];
                })
              }
            >
              {t("common.next", "Next")}
              <Icon name="chevronRight" />
            </Button>
          </SpaceBetween>
          <Button
            className="w-full"
            onClick={() =>
              setWorkoutSheet({
                type: "picker",
                onPick: (exercise) =>
                  setWorkoutSheet({
                    type: "config",
                    exercise,
                    existing: null,
                    onSave: (config) =>
                      update((s) => {
                        const act = s.active;
                        if (!act) return;
                        const full = { ...config, id: exercise.id };
                        const plan = nextPrescription(
                          s,
                          full,
                          s.routines.find((r) => r.id === act.routineId) ?? null,
                        );
                        act.entries.push({
                          id: exercise.id,
                          target: { ...config },
                          plan,
                          sets: applyPrescription(buildSets(s, full), plan),
                        });
                        act.cur = act.entries.length - 1;
                      }),
                    onDelete: null,
                    routine:
                      appState.routines.find((routine) => routine.id === A.routineId) ?? null,
                  }),
              })
            }
          >
            <Icon name="plus" />
            {t("exercise.addExercise", "Add exercise")}
          </Button>
          {(() => {
            const exDone = A.entries.filter(
              (e) => e.sets.length && e.sets.every((s) => s.done),
            ).length;
            const allDone = A.entries.length > 0 && exDone === A.entries.length;
            return (
              <Button
                variant={allDone ? "default" : "ghost"}
                className={cn("w-full", !allDone && "text-muted-foreground")}
                onClick={requestFinish}
              >
                {allDone
                  ? t("workout.completion.finishWorkout", "Finish workout")
                  : t(
                      "workout.finishWorkoutEarlyProgress",
                      "Finish workout early · {{progress}} exercises",
                      { progress: exDone + "/" + A.entries.length },
                    )}
              </Button>
            );
          })()}
        </SpaceBetween>
      </div>
      {workoutSheet?.type === "top-weight" && (
        <TopWeightSheet
          state={workoutSheet}
          close={closeWorkoutSheet}
          setWorkoutSheet={setWorkoutSheet}
        />
      )}
      {workoutSheet?.type === "workout-complete" && (
        <WorkoutCompleteSheet
          state={workoutSheet}
          close={closeWorkoutSheet}
          setWorkoutSheet={setWorkoutSheet}
          onComplete={completeActiveWorkout}
        />
      )}
      {workoutSheet?.type === "detail" && (
        <DetailSheet
          state={workoutSheet}
          close={closeWorkoutSheet}
          setWorkoutSheet={setWorkoutSheet}
        />
      )}
      {workoutSheet?.type === "picker" && (
        <PickerSheet
          state={workoutSheet}
          close={closeWorkoutSheet}
          setWorkoutSheet={setWorkoutSheet}
        />
      )}
      {workoutSheet?.type === "add-to-routine" && (
        <AddToRoutineSheet
          state={workoutSheet}
          close={closeWorkoutSheet}
          setWorkoutSheet={setWorkoutSheet}
        />
      )}
      {workoutSheet?.type === "config" && (
        <ConfigSheet
          state={workoutSheet}
          close={closeWorkoutSheet}
          setWorkoutSheet={setWorkoutSheet}
        />
      )}
      {workoutSheet?.type === "custom" && (
        <CustomSheet
          state={workoutSheet}
          close={closeWorkoutSheet}
          setWorkoutSheet={setWorkoutSheet}
        />
      )}
      <ConfirmationAlertDialog confirmation={confirmation} onClose={() => setConfirmation(null)} />
    </>
  );
}

function isCustomExercise(exercise: SheetEx): exercise is CustomEx {
  return !("img" in exercise);
}

function ConfirmationAlertDialog({
  confirmation,
  onClose,
}: {
  confirmation: WorkoutConfirmation | null;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  return (
    <AlertDialog
      open={confirmation !== null}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>
            {confirmation?.title || t("common.confirm", "Confirm")}
          </AlertDialogTitle>
          <AlertDialogDescription>{confirmation?.message}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>{t("common.cancel", "Cancel")}</AlertDialogCancel>
          <AlertDialogAction
            variant={confirmation?.danger ? "destructive" : "default"}
            onClick={() => {
              const onConfirm = confirmation?.onConfirm;
              onClose();
              onConfirm?.();
            }}
          >
            {confirmation?.confirmText || t("common.confirm", "Confirm")}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

type WorkoutSheetProps = {
  close: SheetClose;
  setWorkoutSheet: SetWorkoutSheet;
};

function TopWeightSheet({
  state,
  close,
  setWorkoutSheet,
}: WorkoutSheetProps & { state: Extract<WorkoutSheetState, { type: "top-weight" }> }) {
  const { t } = useTranslation();
  return (
    <Sheet
      open
      onOpenChange={(open) => {
        if (!open) void close();
      }}
    >
      <SheetContent
        side="bottom"
        showCloseButton={false}
        className="max-h-screen touch-pan-y overflow-y-auto overscroll-contain rounded-2xl bg-sheet p-2 px-4.5 pb-5 lg:inset-x-auto lg:left-1/2 lg:w-160 lg:-translate-x-1/2"
      >
        <SheetTitle className="sr-only">
          {t("workout.adjustTopWeight", "Adjust top weight")}
        </SheetTitle>
        <div className="mx-auto mt-1.5 mb-3.5 h-1 w-9 rounded-full bg-foreground/20" />
        <TopWeight entryIdx={state.entryIdx} close={close} setWorkoutSheet={setWorkoutSheet} />
      </SheetContent>
    </Sheet>
  );
}

function WorkoutCompleteSheet({
  close,
  onComplete,
}: WorkoutSheetProps & {
  onComplete: () => void;
  state: Extract<WorkoutSheetState, { type: "workout-complete" }>;
}) {
  const { t } = useTranslation();
  return (
    <Sheet
      open
      onOpenChange={(open) => {
        if (!open) void close();
      }}
    >
      <SheetContent
        side="bottom"
        showCloseButton={false}
        className="max-h-screen touch-pan-y overflow-y-auto overscroll-contain rounded-2xl bg-sheet p-2 px-4.5 pb-5 lg:inset-x-auto lg:left-1/2 lg:w-160 lg:-translate-x-1/2"
      >
        <SheetTitle className="sr-only">
          {t("workout.completion.sWholeWorkout", "That's the whole workout!")}
        </SheetTitle>
        <div className="mx-auto mt-1.5 mb-3.5 h-1 w-9 rounded-full bg-foreground/20" />
        <WorkoutComplete close={close} onFinish={onComplete} />
      </SheetContent>
    </Sheet>
  );
}

function DetailSheet({
  state,
  close,
  setWorkoutSheet,
}: WorkoutSheetProps & { state: Extract<WorkoutSheetState, { type: "detail" }> }) {
  const { t } = useTranslation();
  const [confirmation, setConfirmation] = useState<WorkoutConfirmation | null>(null);
  const customExercise = isCustomExercise(state.exercise) ? state.exercise : null;
  const openCustom = (
    existingExercise: CustomEx | null,
    onDone?: (exercise: SheetEx | null) => void,
    prefillName?: string,
  ) => setWorkoutSheet({ type: "custom", existingExercise, onDone, prefillName });
  return (
    <>
      <Sheet
        open
        onOpenChange={(open) => {
          if (!open) void close();
        }}
      >
        <SheetContent
          side="bottom"
          showCloseButton={false}
          className="max-h-screen touch-pan-y overflow-y-auto overscroll-contain rounded-2xl bg-sheet p-2 px-4.5 pb-5 lg:inset-x-auto lg:left-1/2 lg:w-160 lg:-translate-x-1/2"
        >
          <SheetTitle className="sr-only">{state.exercise.n}</SheetTitle>
          <div className="mx-auto mt-1.5 mb-3.5 h-1 w-9 rounded-full bg-foreground/20" />
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
                      message: t(
                        "customExercise.willRemovedRoutinesAlreadyLogged",
                        "It will be removed from your routines. Already-logged workouts keep their sets.",
                      ),
                      confirmText: t("common.delete", "Delete"),
                      danger: true,
                      onConfirm: () => {
                        removeCustomExercise(customExercise);
                        void close();
                      },
                    })
                : undefined
            }
          />
        </SheetContent>
      </Sheet>
      <ConfirmationAlertDialog confirmation={confirmation} onClose={() => setConfirmation(null)} />
    </>
  );
}

function PickerSheet({
  state,
  close,
  setWorkoutSheet,
}: WorkoutSheetProps & { state: Extract<WorkoutSheetState, { type: "picker" }> }) {
  const { t } = useTranslation();
  const openCustom = (
    existingExercise: CustomEx | null,
    onDone?: (exercise: SheetEx | null) => void,
    prefillName?: string,
  ) => setWorkoutSheet({ type: "custom", existingExercise, onDone, prefillName });
  return (
    <Sheet
      open
      onOpenChange={(open) => {
        if (!open) void close();
      }}
    >
      <SheetContent
        side="bottom"
        showCloseButton={false}
        className="max-h-screen touch-pan-y overflow-y-auto overscroll-contain rounded-2xl bg-sheet p-2 px-4.5 pb-5 lg:inset-x-auto lg:left-1/2 lg:w-160 lg:-translate-x-1/2"
      >
        <SheetTitle className="sr-only">{t("exercise.addExercise", "Add exercise")}</SheetTitle>
        <div className="mx-auto mt-1.5 mb-3.5 h-1 w-9 rounded-full bg-foreground/20" />
        <ExercisePicker onPick={state.onPick} close={close} openCustom={openCustom} />
      </SheetContent>
    </Sheet>
  );
}

function AddToRoutineSheet({
  state,
  close,
  setWorkoutSheet,
}: WorkoutSheetProps & { state: Extract<WorkoutSheetState, { type: "add-to-routine" }> }) {
  const { t } = useTranslation();
  return (
    <Sheet
      open
      onOpenChange={(open) => {
        if (!open) void close();
      }}
    >
      <SheetContent
        side="bottom"
        showCloseButton={false}
        className="max-h-screen touch-pan-y overflow-y-auto overscroll-contain rounded-2xl bg-sheet p-2 px-4.5 pb-5 lg:inset-x-auto lg:left-1/2 lg:w-160 lg:-translate-x-1/2"
      >
        <SheetTitle className="sr-only">
          {t("exercise.add", "Add “{{exercise}}”", { exercise: state.exercise.n })}
        </SheetTitle>
        <div className="mx-auto mt-1.5 mb-3.5 h-1 w-9 rounded-full bg-foreground/20" />
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
      </SheetContent>
    </Sheet>
  );
}

function ConfigSheet({
  state,
  close,
  setWorkoutSheet,
}: WorkoutSheetProps & { state: Extract<WorkoutSheetState, { type: "config" }> }) {
  return (
    <Sheet
      open
      onOpenChange={(open) => {
        if (!open) void close();
      }}
    >
      <SheetContent
        side="bottom"
        showCloseButton={false}
        className="max-h-screen touch-pan-y overflow-y-auto overscroll-contain rounded-2xl bg-sheet p-2 px-4.5 pb-5 lg:inset-x-auto lg:left-1/2 lg:w-160 lg:-translate-x-1/2"
      >
        <SheetTitle className="sr-only">{state.exercise.n}</SheetTitle>
        <div className="mx-auto mt-1.5 mb-3.5 h-1 w-9 rounded-full bg-foreground/20" />
        <ExConfigSheet
          exercise={state.exercise}
          existing={state.existing}
          onSave={state.onSave}
          onDelete={state.onDelete}
          close={close}
          routine={state.routine}
          openCustom={(exercise) => setWorkoutSheet({ type: "custom", existingExercise: exercise })}
        />
      </SheetContent>
    </Sheet>
  );
}

function CustomSheet({
  state,
  close,
}: WorkoutSheetProps & { state: Extract<WorkoutSheetState, { type: "custom" }> }) {
  const { t } = useTranslation();
  return (
    <Sheet
      open
      onOpenChange={(open) => {
        if (!open) void close();
      }}
    >
      <SheetContent
        side="bottom"
        showCloseButton={false}
        className="max-h-screen touch-pan-y overflow-y-auto overscroll-contain rounded-2xl bg-sheet p-2 px-4.5 pb-5 lg:inset-x-auto lg:left-1/2 lg:w-160 lg:-translate-x-1/2"
      >
        <SheetTitle className="sr-only">
          {state.existingExercise
            ? t("customExercise.editCustomExercise", "Edit custom exercise")
            : t("customExercise.createOwnExercise", "Create your own exercise")}
        </SheetTitle>
        <div className="mx-auto mt-1.5 mb-3.5 h-1 w-9 rounded-full bg-foreground/20" />
        <CustomExerciseForm
          existingExercise={state.existingExercise}
          prefillName={state.prefillName}
          onDone={state.onDone}
          onDelete={state.onDelete}
          close={close}
        />
      </SheetContent>
    </Sheet>
  );
}

function FinishSummarySheet({
  summary,
  close,
}: {
  summary: FinishSummaryPayload;
  close: SheetClose;
}) {
  const { t } = useTranslation();
  return (
    <Sheet
      open
      onOpenChange={(open) => {
        if (!open) void close();
      }}
    >
      <SheetContent
        side="bottom"
        showCloseButton={false}
        className="max-h-screen touch-pan-y overflow-y-auto overscroll-contain rounded-2xl bg-sheet p-2 px-4.5 pb-5 lg:inset-x-auto lg:left-1/2 lg:w-160 lg:-translate-x-1/2"
      >
        <SheetTitle className="sr-only">
          {t("workout.completion.workoutComplete", "Workout complete!")}
        </SheetTitle>
        <div className="mx-auto mt-1.5 mb-3.5 h-1 w-9 rounded-full bg-foreground/20" />
        <FinishSummary {...summary} close={close} />
      </SheetContent>
    </Sheet>
  );
}

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
        <ActiveWorkoutSession activeWorkout={active} onComplete={setFinishSummary} />
      ) : (
        <StartChooser />
      )}
      {finishSummary && <FinishSummarySheet summary={finishSummary} close={closeSummary} />}
    </>
  );
}
