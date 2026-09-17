import type { TFunction } from "i18next";
import { useStore } from "@/app/store/useStore";
import { useWorkoutTimer } from "@/features/workout/useWorkoutTimer";
import { exOr } from "@/domain/exercises/exercises";
import { setsDoneActive, modeOf, isBw, isWarmup } from "@/domain/training/history";
import { beep, vibrate } from "@/shared/lib/sound";
import { warmupSets } from "@/domain/training/warmup";
import type { AppState, ActiveWorkout } from "@/shared/lib/types";
import { toast } from "@/shared/lib/toast";
import type { ConfirmDialogOptions } from "@/shared/components/ConfirmDialog";
import type { SetWorkoutSheet } from "@/features/workout/workout-state";
import {
  hasWeight,
  setFieldValue,
  weightOf,
  type SetField,
} from "@/features/workout/workout-set-fields";

export function useWorkoutSessionActions({
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
  setConfirmation: (confirmation: ConfirmDialogOptions | null) => void;
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
    const removing = activeWorkout.entries[idx]?.sets.some(isWarmup) ?? false;
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
        description: t(
          "workout.completion.havenTCheckedOffAny",
          "You haven’t checked off any sets. Finish the workout anyway?",
        ),
        confirmLabel: t("workout.completion.finishAnyway", "Finish anyway"),
        onConfirm: completeSession,
      });
      return;
    }
    if (done < total) {
      const remaining = total - done;
      setConfirmation({
        title: t("workout.completion.finishEarly", "Finish early?"),
        description: t(
          "workout.completion.uncheckedSetWarning",
          "{{count}} set still unchecked. Finish the workout now?",
          { count: remaining },
        ),
        confirmLabel: t("workout.completion.finishWorkout", "Finish workout"),
        onConfirm: completeSession,
      });
      return;
    }
    completeSession();
  };
  return { setField, addSet, removeSet, toggleWarmup, startTimed, toggle, requestFinish };
}
