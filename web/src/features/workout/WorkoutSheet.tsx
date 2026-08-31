import { useEffect, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { Controller, useForm, useWatch } from "react-hook-form";
import { valibotResolver } from "@hookform/resolvers/valibot";
import { useStore } from "@/app/store/useStore";
import { EXIDX } from "@/domain/exercises/exercises";
import { todayISO, fmtNum, fmtDur, fmtVol } from "@/shared/lib/format";
import {
  bestWeightFor,
  setsDone,
  supersetUnits,
  unitOf,
  isWarmup,
} from "@/domain/training/history";
import { toast } from "@/shared/lib/toast";
import { Button } from "@/shared/ui/button";
import { Field } from "@/shared/ui/field";
import Icon from "@/shared/components/Icon";
import { SpaceBetween } from "@/shared/components/SpaceBetween";
import { Grid } from "@/shared/components/Grid";
import BodyMap from "@/shared/components/BodyMap";
import { PlateRow } from "@/shared/components/PlateRow";
import { Textarea } from "@/shared/ui/textarea";
import { loadOfWorkouts } from "@/domain/exercises/muscles";
import type { Id, SheetClose, Workout } from "@/shared/lib/types";
import { getAppState, getSetWeight, updateAppState } from "@/features/exercises/sheet-shared";
import { WeightInput } from "@/features/account/AccountSheet";
import type { SetWorkoutSheet } from "@/features/workout/workout-state";
import { createTopWeightFormSchema } from "@/shared/lib/form-schemas";

export function TopWeight({
  entryIdx,
  close,
  setWorkoutSheet,
}: {
  entryIdx: number;
  close: SheetClose;
  setWorkoutSheet: SetWorkoutSheet;
}) {
  const { t } = useTranslation();
  const st = useStore((store) => store.appState);
  const A = st.active;
  const entry = A ? A.entries[entryIdx] || null : null;
  const ex = entry ? EXIDX[entry.id] : undefined;
  // Warm-up ramp sets never define your working weight.
  const maxSet = entry
    ? entry.sets.reduce(
        (max, set) => (set.done && !isWarmup(set) ? Math.max(max, getSetWeight(set)) : max),
        0,
      )
    : 0;
  const prevBest = entry
    ? Math.max(st.exWeights[entry.id]?.w || 0, bestWeightFor(st, entry.id))
    : 0;
  const invalidWeightMessage = t("weight.enterValidWeight", "Enter a valid weight");
  const { control, handleSubmit } = useForm<{ weight: number }>({
    defaultValues: {
      weight: entry ? Math.max(maxSet, prevBest) || entry.target.weight || 0 : 0,
    },
    resolver: valibotResolver(createTopWeightFormSchema(t)),
  });
  const weightValue = useWatch({ control, name: "weight" });
  useEffect(() => {
    if (!entry) void close();
  }, [entry, close]);
  const units = supersetUnits(A ? A.entries : []);
  const unit: number[] = entry ? unitOf(units, entryIdx) : [];
  const unitDone = !!entry && unit.every((i) => A?.entries[i]?.sets.every((s) => s.done) ?? false);
  const unitIdx = units.findIndex((u) => u === unit);
  const isLastUnit = unitIdx === units.length - 1;
  if (!entry || !ex) return null;
  const commit = async ({ weight: rawWeight }: { weight: number }, advance: boolean) => {
    const weight = Math.round((rawWeight || 0) * 10) / 10;
    updateAppState((state) => {
      const activeWorkout = state.active;
      if (!activeWorkout) return;
      activeWorkout.entries[entryIdx].topW = weight;
      const currentWeight = state.exWeights[entry.id];
      state.exWeights[entry.id] = {
        w: Math.max(weight, currentWeight ? currentWeight.w : 0),
        d: todayISO(),
      };
    });
    await close();
    if (advance && unitDone) {
      if (isLastUnit) setWorkoutSheet({ type: "workout-complete" });
      else
        updateAppState((state) => {
          const activeWorkout = state.active;
          if (activeWorkout) activeWorkout.cur = units[unitIdx + 1][0];
        });
    } else
      toast(
        t("workout.completion.trackedNextTimeStarts", "Tracked — next time starts at {{weight}}", {
          weight: fmtNum(getAppState().exWeights[entry.id].w) + " " + st.unit,
        }),
      );
  };
  return (
    <>
      <h3 className="flex items-center gap-2 capitalize">
        <Icon name="checkCircle" className="text-primary" />
        {t("workout.completion.done", "{{progress}} done", { progress: ex.n })}
      </h3>
      <div className="text-sm leading-snug text-foreground/60">
        {t(
          "workout.completion.confirmWeightWorkedHighestBecomes",
          "Confirm the weight you worked with — your highest becomes the default next time.",
        )}
        {!unitDone && unit.length > 1
          ? " " + t("workout.completion.finishSupersetPartner", "Then finish the superset partner.")
          : ""}
      </div>
      <form
        onSubmit={handleSubmit(
          (values) => commit(values, unitDone),
          () => toast(invalidWeightMessage),
        )}
      >
        <Controller
          control={control}
          name="weight"
          render={({ field }) => (
            <WeightInput value={field.value} setValue={field.onChange} unit={st.unit} />
          )}
        />
        <PlateRow weight={weightValue} />
        <div className="h-2.5" />
        {prevBest > 0 ? (
          <div className="mb-3 text-center text-sm leading-snug text-muted-foreground">
            {t("workout.completion.previousBest", "Previous best:")} {fmtNum(prevBest)} {st.unit}
            {maxSet > prevBest && (
              <span className="text-warning">
                {" "}
                — {t("workout.completion.newRecord", "new record!")}
              </span>
            )}
          </div>
        ) : (
          <div className="h-1" />
        )}
        {unitDone ? (
          <Field>
            <Button type="submit" variant="default">
              {isLastUnit
                ? t("workout.completion.save", "Save")
                : t("workout.completion.saveNextExercise", "Save & next exercise")}
              {!isLastUnit && <Icon name="chevronRight" />}
            </Button>
            <Button
              type="button"
              variant="ghost"
              className="text-muted-foreground"
              onClick={() =>
                void handleSubmit(
                  (values) => commit(values, false),
                  () => toast(invalidWeightMessage),
                )()
              }
            >
              {t("workout.completion.justClose", "Just close")}
            </Button>
          </Field>
        ) : (
          <Field>
            <Button type="submit" variant="default">
              {t("workout.completion.saveWeight", "Save weight")}
            </Button>
          </Field>
        )}
      </form>
    </>
  );
}
export function WorkoutComplete({ close, onFinish }: { close: SheetClose; onFinish: () => void }) {
  const { t } = useTranslation();
  return (
    <div className="py-2 text-center">
      <div className="flex justify-center text-5xl text-primary">
        <Icon name="checkCircle" />
      </div>
      <h3 className="my-2 text-xl font-semibold">
        {t("workout.completion.sWholeWorkout", "That's the whole workout!")}
      </h3>
      <div className="mb-4 text-sm leading-snug text-foreground/60">
        {t(
          "workout.completion.everyExerciseDoneGreatWork",
          "Every exercise done — great work. Finish up, or keep going and add another exercise.",
        )}
      </div>
      <SpaceBetween size="xs">
        <Button
          className="w-full"
          variant="default"
          onClick={async () => {
            await close();
            onFinish();
          }}
        >
          <Icon name="flag" />
          {t("workout.completion.finishWorkout", "Finish workout")}
        </Button>
        <Button
          className="w-full"
          onClick={async () => {
            await close();
            toast(
              t(
                "workout.completion.keepGoingTapAddExercise",
                "Keep going — tap “+ Add exercise” below",
              ),
            );
          }}
        >
          {t("workout.completion.continueWorkout", "Continue workout")}
        </Button>
      </SpaceBetween>
    </div>
  );
}
interface E1PrRec {
  est: number;
  w: number;
  r: number;
  prev?: number;
}
type E1Pr = E1PrRec & { id: Id };
const EMPTY_E1PRS: E1Pr[] = [];
export function FinishSummary({
  workout,
  prs,
  e1prs = EMPTY_E1PRS,
  close,
}: {
  workout: Workout;
  prs: Id[];
  e1prs?: E1Pr[];
  close: SheetClose;
}) {
  const { t } = useTranslation();
  const nav = useNavigate();
  const appState = useStore((store) => store.appState);
  // Session notes (Hevy-style): how the session felt, aches, cues worth remembering.
  // Saved straight into the finished workout on every keystroke — persistence debounces.
  const [note, setNote] = useState(workout.note ?? "");
  const saveNote = (text: string) => {
    setNote(text);
    updateAppState((draft) => {
      const saved = draft.workouts.find((candidate) => candidate.id === workout.id);
      if (!saved) return;
      if (text.trim()) saved.note = text;
      else delete saved.note;
    });
  };
  return (
    <div className="py-2 text-center">
      <div className="flex justify-center text-5xl text-primary">
        <Icon name="trophy" />
      </div>
      <h3 className="my-2 text-xl font-semibold">
        {t("workout.completion.workoutComplete", "Workout complete!")}
      </h3>
      <Grid columns={2} className="mb-3 text-left">
        <div className="rounded-lg bg-card p-3.5">
          <div className="text-sm tracking-tight text-foreground/60">
            {t("workout.completion.duration", "Duration")}
          </div>
          <div className="mt-1.5 text-lg leading-tight font-semibold tracking-tight">
            {fmtDur(workout.end - workout.start)}
          </div>
        </div>
        <div className="rounded-lg bg-card p-3.5">
          <div className="text-sm tracking-tight text-foreground/60">
            {t("workout.completion.volume", "Volume")}
          </div>
          <div className="mt-1.5 text-lg leading-tight font-semibold tracking-tight">
            {fmtVol(workout.vol, appState.unit)}
          </div>
        </div>
        <div className="rounded-lg bg-card p-3.5">
          <div className="text-sm tracking-tight text-foreground/60">
            {t("exercise.sets", "Sets")}
          </div>
          <div className="mt-1.5 text-lg leading-tight font-semibold tracking-tight">
            {setsDone(workout)}
          </div>
        </div>
        <div className="rounded-lg bg-card p-3.5">
          <div className="text-sm tracking-tight text-foreground/60">
            {t("workout.completion.prs", "PRs")}
          </div>
          <div className="mt-1.5 text-xl leading-tight font-semibold tracking-tight">
            {prs.length || "—"}
          </div>
        </div>
      </Grid>
      {(prs.length > 0 || e1prs.length > 0) && (
        <div className="mb-3 text-left">
          {prs.map((id) => (
            <div
              key={id}
              className="flex items-center gap-1.5 text-sm leading-snug text-primary capitalize"
            >
              <Icon name="trophy" className="text-sm" />
              {t("workout.completion.newPr", "New PR:")} {EXIDX[id]?.n || id}
            </div>
          ))}
          {e1prs.map((p) => (
            <div
              key={p.id}
              className="flex items-center gap-1.5 text-sm leading-snug text-primary capitalize"
            >
              <Icon name="chartLine" className="text-sm" />
              {t("progression.bestEstimated1rm", "Best estimated 1RM:")} {EXIDX[p.id]?.n || p.id} ·{" "}
              {fmtNum(p.est)} {appState.unit}
            </div>
          ))}
        </div>
      )}
      <h4 className="mt-5.5 mb-2 px-1 text-left text-sm font-normal tracking-tight text-foreground/60">
        {t("workout.notes.title", "Notes")}
      </h4>
      <Textarea
        value={note}
        onChange={(event) => saveNote(event.target.value)}
        placeholder={t(
          "workout.notes.placeholder",
          "How did it go? Aches, cues, what to try next time…",
        )}
        className="min-h-20 resize-none bg-card text-base"
        aria-label={t("workout.notes.title", "Notes")}
      />
      <h4 className="mt-5.5 mb-2 px-1 text-left text-sm font-normal tracking-tight text-foreground/60">
        {t("muscleMap.whatJustTrained", "What you just trained")}
      </h4>
      <BodyMap load={loadOfWorkouts([workout])} body={appState.body} />
      <Button
        className="mt-4 w-full"
        variant="default"
        onClick={async () => {
          await close();
          void nav({ to: "/home" });
        }}
      >
        {t("workout.completion.nice", "Nice!")}
      </Button>
    </div>
  );
}
