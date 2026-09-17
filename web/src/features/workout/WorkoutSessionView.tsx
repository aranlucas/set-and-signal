import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "@tanstack/react-router";
import { useStore } from "@/app/store/useStore";
import { useWorkoutTimer } from "@/features/workout/useWorkoutTimer";
import { exOr } from "@/domain/exercises/exercises";
import {
  buildSets,
  setsDoneActive,
  supersetUnits,
  unitOf,
  isWarmup,
  workoutVolume,
} from "@/domain/training/history";
import { fmtNum } from "@/shared/lib/format";
import { api } from "@/shared/lib/api";
import { completeWorkout, type FinishSummaryPayload } from "@/features/workout/workout-actions";
import Icon from "@/shared/components/Icon";
import { SpaceBetween } from "@/shared/components/SpaceBetween";
import { Button } from "@/shared/ui/button";
import { Progress } from "@/shared/ui/progress";
import { nextPrescription, applyPrescription } from "@/domain/training/progression";
import type { ActiveWorkout, SheetClose } from "@/shared/lib/types";
import { cn } from "@/shared/lib/utils";
import ConfirmDialog from "@/shared/components/ConfirmDialog";
import type { ConfirmDialogOptions } from "@/shared/components/ConfirmDialog";
import type { SetWorkoutSheet, WorkoutSheetState } from "@/features/workout/workout-state";
import { ExerciseBlock } from "@/features/workout/ExerciseBlock";
import { useWorkoutSessionActions } from "@/features/workout/useWorkoutSessionActions";
import { WorkoutSheetHost } from "@/features/workout/WorkoutSheets";
import type { SetField } from "@/features/workout/workout-set-fields";

function Elapsed({ start }: { start: number }) {
  const { t } = useTranslation();
  const [elapsedText, setElapsedText] = useState("0:00");
  useEffect(() => {
    const tick = () => {
      const seconds = Math.max(0, Math.floor((Date.now() - start) / 1000));
      const hours = Math.floor(seconds / 3600);
      const minutes = Math.floor((seconds % 3600) / 60);
      setElapsedText(
        hours >= 24
          ? t("workout.sessionSummary.elapsedDays", "{{days}}d {{hours}}h", {
              days: Math.floor(hours / 24),
              hours: hours % 24,
            })
          : `${hours ? `${hours}:` : ""}${hours ? String(minutes).padStart(2, "0") : minutes}:${String(seconds % 60).padStart(2, "0")}`,
      );
    };
    tick();
    const iv = setInterval(tick, 1000);
    return () => clearInterval(iv);
  }, [start, t]);
  return <span>{elapsedText}</span>;
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
  const hosted = useStore((state) => !!state.user);
  return (
    <div className="mt-2 mb-4.5 flex items-end justify-between gap-3">
      <Button
        variant="plain"
        className="flex size-11 flex-none items-center justify-center rounded-full bg-card text-lg text-foreground transition duration-140 active:scale-95 active:bg-muted sm:size-9"
        aria-label={t("common.discard", "Discard")}
        onClick={onDiscard}
      >
        <Icon name="xmark" />
      </Button>
      <div className="min-w-0 text-center">
        <h1 className="text-2xl font-semibold wrap-anywhere">{name}</h1>
        <p className="mt-1 text-xs text-muted-foreground">
          {hosted
            ? t("sync.workoutDevice", "Saved here · syncs when you finish")
            : t("sync.deviceOnly", "Saved on this device")}
        </p>
        <div className="mt-1 text-base tracking-tight text-foreground/60">
          <Elapsed start={start} /> ·{" "}
          {t("workout.completion.setProgress", "{{progress}} sets", {
            progress: done + "/" + total,
          })}
        </div>
      </div>
      <Button
        variant="plain"
        className="flex size-11 flex-none items-center justify-center rounded-full bg-card text-lg text-primary transition duration-140 active:scale-95 active:bg-muted sm:size-9"
        aria-label={t("common.finish", "Finish")}
        onClick={onFinish}
      >
        <Icon name="check" />
      </Button>
    </div>
  );
}

function WorkoutProgressSummary({
  activeWorkout,
  units,
  currentUnit,
  done,
  total,
}: {
  activeWorkout: ActiveWorkout;
  units: number[][];
  currentUnit: number;
  done: number;
  total: number;
}) {
  const { t } = useTranslation();
  const appState = useStore((state) => state.appState);
  const completedExercises = activeWorkout.entries.filter((entry) => {
    const workingSets = entry.sets.filter((set) => !isWarmup(set));
    return workingSets.length > 0 && workingSets.every((set) => set.done);
  }).length;
  const percentage = total > 0 ? Math.round((done / total) * 100) : 0;
  const volume = workoutVolume(activeWorkout);
  const currentLabel =
    currentUnit >= 0 && units[currentUnit]
      ? units[currentUnit].map((index) => exOr(activeWorkout.entries[index].id).n).join(" + ")
      : t("workout.sessionSummary.readyToStart", "Ready to start");
  const progressLabel = t("workout.sessionSummary.sessionProgress", "Session progress");
  const completeLabel = t("workout.sessionSummary.complete", "complete");
  const setsLabel = t("workout.sessionSummary.sets", "sets");
  const exercisesLabel = t("workout.sessionSummary.exercises", "Exercises");
  const volumeLabel = t("workout.sessionSummary.volume", "Volume");
  const currentBlockLabel = t("workout.sessionSummary.currentBlock", "Current block");
  const setProgressLabel = t("workout.sessionSummary.setProgress", "Set progress");

  return (
    <section
      aria-label={progressLabel}
      className="mb-4 rounded-xl border border-primary/15 bg-card p-4 shadow-sm"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-1.5 text-xs font-semibold tracking-wider text-primary uppercase">
            <Icon name="target" className="text-base" />
            {progressLabel}
          </div>
          <div className="mt-1.5 flex items-baseline gap-2">
            <span className="text-3xl leading-none font-semibold tracking-tight tabular-nums">
              {percentage}%
            </span>
            <span className="text-sm text-muted-foreground">{completeLabel}</span>
          </div>
        </div>
        <div className="rounded-lg bg-primary/10 px-3 py-2 text-right">
          <div className="text-lg leading-none font-semibold tracking-tight text-primary tabular-nums">
            {done}/{total}
          </div>
          <div className="mt-1 text-xs font-medium tracking-wide text-primary/70 uppercase">
            {setsLabel}
          </div>
        </div>
      </div>
      <Progress
        className="mt-4 block h-2 w-full overflow-hidden rounded-full bg-muted accent-primary"
        value={percentage}
        aria-label={setProgressLabel}
      />
      <div className="mt-4 grid grid-cols-3 divide-x divide-border/70">
        <div className="pr-3">
          <div className="text-base font-semibold tracking-tight tabular-nums">
            {completedExercises}/{activeWorkout.entries.length}
          </div>
          <div className="mt-0.5 text-xs text-muted-foreground">{exercisesLabel}</div>
        </div>
        <div className="px-3">
          <div className="text-base font-semibold tracking-tight tabular-nums">
            {fmtNum(volume)}
          </div>
          <div className="mt-0.5 text-xs text-muted-foreground">
            {volumeLabel} · {appState.unit}
          </div>
        </div>
        <div className="min-w-0 pl-3">
          <div className="line-clamp-2 text-sm font-semibold tracking-tight capitalize">
            {currentLabel}
          </div>
          <div className="mt-0.5 text-xs text-muted-foreground">{currentBlockLabel}</div>
        </div>
      </div>
    </section>
  );
}

function WorkoutExerciseNavigator({
  activeWorkout,
  units,
  currentUnit,
  onSelect,
}: {
  activeWorkout: ActiveWorkout;
  units: number[][];
  currentUnit: number;
  onSelect: (entryIndex: number) => void;
}) {
  const { t } = useTranslation();
  if (units.length < 2) return null;
  return (
    <section
      className="mb-4"
      aria-label={t("workout.sessionSummary.exerciseNavigation", "Exercise navigation")}
    >
      <div className="mb-2 flex items-center justify-between px-1">
        <h2 className="text-sm font-semibold tracking-tight">
          {t("workout.sessionSummary.exerciseFlow", "Exercise flow")}
        </h2>
        <span className="text-xs text-muted-foreground">
          {t("workout.sessionSummary.tapToJump", "Tap to jump")}
        </span>
      </div>
      <div className="-mx-1 flex snap-x snap-mandatory scrollbar-none gap-2 overflow-x-auto px-1 pb-1">
        {units.map((unit, index) => {
          const workingSets = unit.flatMap((entryIndex) =>
            activeWorkout.entries[entryIndex].sets.filter((set) => !isWarmup(set)),
          );
          const completed = workingSets.length > 0 && workingSets.every((set) => set.done);
          const started = workingSets.some((set) => set.done);
          const names = unit.map((entryIndex) => exOr(activeWorkout.entries[entryIndex].id).n);
          const label = names.join(" + ");
          return (
            <Button
              key={unit[0]}
              variant="plain"
              type="button"
              aria-current={index === currentUnit ? "step" : undefined}
              aria-label={`${t("workout.sessionSummary.exerciseLabel", "Exercise")} ${index + 1}: ${label}`}
              className={cn(
                "flex w-52 shrink-0 snap-start items-center gap-2 rounded-lg border px-3 py-2.5 text-left transition-colors duration-150",
                index === currentUnit
                  ? "border-primary bg-primary text-primary-foreground hover:bg-primary"
                  : "border-border/70 bg-card hover:bg-muted",
              )}
              onClick={() => onSelect(unit[0])}
            >
              <span
                className={cn(
                  "flex size-7 flex-none items-center justify-center rounded-full text-xs font-semibold tabular-nums",
                  index === currentUnit
                    ? "bg-primary-foreground/15 text-primary-foreground"
                    : completed
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted text-foreground/60",
                )}
              >
                {completed ? <Icon name="check" className="text-sm" /> : index + 1}
              </span>
              <span className="min-w-0">
                <span
                  className={cn(
                    "block text-xs font-semibold tracking-wide whitespace-nowrap uppercase",
                    index === currentUnit ? "text-primary-foreground/70" : "text-muted-foreground",
                  )}
                >
                  {unit.length > 1
                    ? t("workout.superset", "Superset {{current}} / {{total}}", {
                        current: index + 1,
                        total: units.length,
                      })
                    : t("workout.exercise", "Exercise {{current}} / {{total}}", {
                        current: index + 1,
                        total: units.length,
                      })}
                </span>
                <span className="mt-0.5 line-clamp-2 text-sm font-semibold capitalize">
                  {label}
                </span>
                {started && !completed && (
                  <span
                    className={cn(
                      "mt-0.5 block text-xs",
                      index === currentUnit ? "text-primary-foreground/70" : "text-primary",
                    )}
                  >
                    {t("workout.sessionSummary.inProgress", "In progress")}
                  </span>
                )}
              </span>
            </Button>
          );
        })}
      </div>
    </section>
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

export function WorkoutSessionView({
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
  const [confirmation, setConfirmation] = useState<ConfirmDialogOptions | null>(null);
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
      description: t(
        "workout.setsLoggedSessionWillLost",
        "The sets you logged in this session will be lost.",
      ),
      confirmLabel: t("common.discard", "Discard"),
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
        <WorkoutProgressSummary
          activeWorkout={A}
          units={units}
          currentUnit={unitIdx}
          done={done}
          total={total}
        />
        <WorkoutExerciseNavigator
          activeWorkout={A}
          units={units}
          currentUnit={unitIdx}
          onSelect={(entryIndex) =>
            update((state) => {
              if (state.active) state.active.cur = entryIndex;
            })
          }
        />

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
      <WorkoutSheetHost
        workoutSheet={workoutSheet}
        close={closeWorkoutSheet}
        setWorkoutSheet={setWorkoutSheet}
        onComplete={completeActiveWorkout}
      />
      {confirmation && (
        <ConfirmDialog
          {...confirmation}
          open
          onOpenChange={(open) => {
            if (!open) setConfirmation(null);
          }}
        />
      )}
    </>
  );
}
