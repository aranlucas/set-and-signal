import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Controller, useForm } from "react-hook-form";
import { valibotResolver } from "@hookform/resolvers/valibot";
import { lastBW } from "@/domain/training/history";
import { fmtDate, fmtNum, todayISO } from "@/shared/lib/format";
import { toast } from "@/shared/lib/toast";
import { Button } from "@/shared/ui/button";
import { Field } from "@/shared/ui/field";
import { Slider } from "@/shared/ui/slider";
import Icon from "@/shared/components/Icon";
import type { SheetClose, Unit } from "@/shared/lib/types";
import { getAppState, updateAppState } from "@/features/exercises/sheet-shared";
import { useStore } from "@/app/store/useStore";
import { createWeightFormSchema } from "@/shared/lib/form-schemas";

const W_LO = 1;
const wHi = (unit: Unit) => (unit === "lb" ? 660 : 300);
const defaultBodyweight = (unit: Unit) => (unit === "lb" ? 155 : 70);
const weightStep = (unit: Unit) => (unit === "lb" ? 0.2 : 0.1);
const weightRange = (unit: Unit) => (unit === "lb" ? 50 : 20);
const weightJumps = (unit: Unit) => (unit === "lb" ? [-5, -1, 1, 5] : [-1, -0.5, 0.5, 1]);

function sliderBounds(value: number, unit: Unit) {
  const radius = weightRange(unit) / 2;
  const min = Math.max(W_LO, Math.round((value - radius) * 10) / 10);
  const max = Math.min(wHi(unit), Math.round((value + radius) * 10) / 10);
  return { min, max };
}

export function WeightInput({
  value,
  setValue,
  unit,
}: {
  value: number;
  setValue: (v: number) => void;
  unit: Unit;
}) {
  const W_HI = wHi(unit);
  const step = weightStep(unit);
  const clamp = (x: number) => Math.max(W_LO, Math.min(W_HI, Math.round((x || 0) * 10) / 10));
  const [bounds, setBounds] = useState(() => sliderBounds(value, unit));
  const onSlide = (x: number) => {
    const nextValue = clamp(x);
    setValue(nextValue);
    if (nextValue <= bounds.min || nextValue >= bounds.max) {
      setBounds(sliderBounds(nextValue, unit));
    }
  };
  const sliderValue = Math.max(bounds.min, Math.min(bounds.max, value));
  return (
    <>
      <div className="my-3.5 mb-1.5 flex items-center justify-center gap-4.5">
        <Button
          variant="plain"
          type="button"
          className="flex size-11.5 shrink-0 items-center justify-center rounded-full bg-card text-xl text-foreground transition active:scale-95 active:bg-muted"
          onClick={() => onSlide(value - step)}
          aria-label={`minus ${step} ${unit}`}
        >
          <Icon name="minus" />
        </Button>
        <div className="min-w-39.5 text-center text-6xl leading-none font-semibold tracking-tight tabular-nums">
          {fmtNum(value)}
          <span className="text-xl font-normal tracking-tight text-foreground/60"> {unit}</span>
        </div>
        <Button
          variant="plain"
          type="button"
          className="flex size-11.5 shrink-0 items-center justify-center rounded-full bg-card text-xl text-foreground transition active:scale-95 active:bg-muted"
          onClick={() => onSlide(value + step)}
          aria-label={`plus ${step} ${unit}`}
        >
          <Icon name="plus" />
        </Button>
      </div>
      <div className="my-2 flex scrollbar-none justify-center gap-2 overflow-x-auto pb-0.5">
        {weightJumps(unit).map((increment) => (
          <Button
            variant="plain"
            type="button"
            key={increment}
            className="shrink-0 rounded-full bg-card px-3 py-1.5 text-sm tracking-tight text-foreground transition-colors active:bg-muted"
            onClick={() => onSlide(value + increment)}
          >
            {increment > 0 ? "+" : "−"}
            {Math.abs(increment)}
          </Button>
        ))}
      </div>
      <Slider
        value={[sliderValue]}
        min={bounds.min}
        max={bounds.max}
        step={step}
        aria-label={`Weight in ${unit}`}
        onValueChange={(values: unknown) => {
          const firstValue: unknown = Array.isArray(values) ? values[0] : values;
          if (typeof firstValue === "number") onSlide(firstValue);
        }}
      />
    </>
  );
}

const delEntry = (d: string) =>
  updateAppState((appState) => {
    appState.bodyweight = appState.bodyweight.filter((bodyweight) => bodyweight.d !== d);
  });

const saveBodyweight = (weight: number) =>
  updateAppState((state) => {
    const date = todayISO();
    const existingEntry = state.bodyweight.find((entry) => entry.d === date);
    if (existingEntry) {
      existingEntry.w = weight;
      existingEntry.t = Date.now();
    } else state.bodyweight.push({ d: date, w: weight, t: Date.now() });
    state.bodyweight.sort((left, right) => (left.d < right.d ? -1 : 1));
  });

function BodyweightEntryForm({
  defaultValue,
  unit,
  submitLabel,
  onSubmit,
}: {
  defaultValue: number;
  unit: Unit;
  submitLabel: string;
  onSubmit: (weight: number) => void | Promise<void>;
}) {
  const { t } = useTranslation();
  const invalidWeightMessage = t("weight.enterValidWeight", "Enter a valid weight");
  const { control, handleSubmit } = useForm<{ weight: number }>({
    defaultValues: { weight: defaultValue },
    resolver: valibotResolver(createWeightFormSchema(t)),
  });
  const submit = async ({ weight: rawWeight }: { weight: number }) => {
    const weight = Math.round((rawWeight || 0) * 10) / 10;
    await onSubmit(weight);
  };

  return (
    <form onSubmit={handleSubmit(submit, () => toast(invalidWeightMessage))}>
      <Controller
        control={control}
        name="weight"
        render={({ field }) => (
          <WeightInput value={field.value} setValue={field.onChange} unit={unit} />
        )}
      />
      <Field className="mt-3.5">
        <Button type="submit" variant="default">
          {submitLabel}
        </Button>
      </Field>
    </form>
  );
}

export function PreWorkoutBodyweightSheet({
  onDone,
  onChooseDifferentWorkout,
}: {
  onDone: (bodyweight: number | null) => void | Promise<void>;
  onChooseDifferentWorkout: () => void | Promise<void>;
}) {
  const { t } = useTranslation();
  const state = useStore((store) => store.appState);
  const previousBodyweight = lastBW(state);
  const defaultValue = previousBodyweight?.w ?? state.targetW ?? defaultBodyweight(state.unit);
  return (
    <>
      <h3>{t("weight.quickCheck", "Quick check-in")}</h3>
      <div className="text-sm leading-snug text-foreground/60">
        {t(
          "weight.slideTapSetWeightTracked",
          "Slide or tap to set your weight — tracked before every workout so your curve stays honest.",
        )}
      </div>
      <BodyweightEntryForm
        defaultValue={defaultValue}
        unit={state.unit}
        submitLabel={t("weight.saveStartWorkout", "Save & start workout")}
        onSubmit={async (weight) => {
          saveBodyweight(weight);
          await onDone(weight);
        }}
      />
      <div className="mt-2 flex flex-col gap-0.5">
        <Button variant="ghost" className="text-muted-foreground" onClick={() => onDone(null)}>
          {t("weight.startWithoutWeighing", "Start without weighing in")}
        </Button>
        <Button
          variant="ghost"
          className="text-muted-foreground"
          onClick={onChooseDifferentWorkout}
        >
          <Icon name="reset" />
          {t("weight.chooseDifferentWorkout", "Choose a different workout")}
        </Button>
      </div>
    </>
  );
}

export function BodyweightLogSheet({ close }: { close: SheetClose }) {
  const { t } = useTranslation();
  const state = useStore((store) => store.appState);
  const previousBodyweight = lastBW(state);
  const defaultValue = previousBodyweight?.w ?? state.targetW ?? defaultBodyweight(state.unit);
  const recent = [...state.bodyweight].reverse().slice(0, 3);
  return (
    <>
      <h3>{t("weight.logBodyWeight", "Log body weight")}</h3>
      <div className="text-sm leading-snug text-foreground/60">
        {t("date.today", "Today") + ", " + fmtDate(t, todayISO(), true)}
      </div>
      <BodyweightEntryForm
        defaultValue={defaultValue}
        unit={state.unit}
        submitLabel={t("workout.completion.save", "Save")}
        onSubmit={async (weight) => {
          saveBodyweight(weight);
          await close();
          toast(t("weight.weightSaved", "Weight saved"));
        }}
      />
      {recent.length > 0 && (
        <>
          <h4 className="my-5.5 mb-2 px-1 text-sm font-normal tracking-tight text-foreground/60">
            {t("weight.recentWeighIns", "Recent weigh-ins")}
          </h4>
          <div className="flex flex-col gap-0">
            {recent.map((b) => (
              <div
                key={b.d}
                className="flex items-center justify-between border-b border-border/60 px-0.5 py-2.5"
              >
                <span className="text-sm leading-snug text-foreground/60">
                  {fmtDate(t, b.d, true)}
                </span>
                <span className="flex items-center gap-3">
                  <b>
                    {fmtNum(b.w)} {state.unit}
                  </b>
                  <Button
                    variant="plain"
                    className="flex h-7.5 w-8 shrink-0 items-center justify-center rounded-lg bg-card text-base text-destructive"
                    onClick={() => delEntry(b.d)}
                    aria-label="delete"
                  >
                    <Icon name="trash" />
                  </Button>
                </span>
              </div>
            ))}
          </div>
        </>
      )}
    </>
  );
}
export function GoalSheet({ close }: { close: SheetClose }) {
  const { t } = useTranslation();
  const st = getAppState();
  const bw = lastBW(st);
  const invalidWeightMessage = t("weight.enterValidWeight", "Enter a valid weight");
  const { control, handleSubmit } = useForm<{ weight: number }>({
    defaultValues: { weight: st.targetW ?? bw?.w ?? defaultBodyweight(st.unit) },
    resolver: valibotResolver(createWeightFormSchema(t)),
  });
  const save = ({ weight: rawWeight }: { weight: number }) => {
    const weight = Math.round((rawWeight || 0) * 10) / 10;
    updateAppState((appState) => {
      appState.targetW = weight;
    });
    void close();
    const latestBodyweight = lastBW(getAppState());
    toast(
      t("weight.goalSet", "Goal set: {{weight}}", {
        weight: fmtNum(weight) + " " + st.unit,
      }) +
        (latestBodyweight
          ? " (" +
            t("weight.toGo", "{{amount}} to go", {
              amount: fmtNum(Math.abs(weight - latestBodyweight.w)),
            }) +
            ")"
          : ""),
    );
  };
  return (
    <>
      <h3>{t("weight.targetWeight", "Target weight")}</h3>
      <div className="text-sm leading-snug text-foreground/60">
        {t(
          "weight.goalDrawnLineThroughWeight",
          "Your goal is drawn as a line through the weight charts, and gains/losses are colored by whether they move toward it.",
        )}
      </div>
      <form onSubmit={handleSubmit(save, () => toast(invalidWeightMessage))}>
        <Controller
          control={control}
          name="weight"
          render={({ field }) => (
            <WeightInput value={field.value} setValue={field.onChange} unit={st.unit} />
          )}
        />
        <Field className="mt-3.5">
          <Button type="submit" variant="default">
            {t("weight.saveGoal", "Save goal")}
          </Button>
        </Field>
      </form>
      {st.targetW && (
        <div className="mt-2 flex flex-col">
          <Button
            variant="destructive"
            onClick={() => {
              updateAppState((appState) => {
                appState.targetW = null;
              });
              void close();
              toast(t("weight.goalRemoved", "Goal removed"));
            }}
          >
            {t("weight.removeGoal", "Remove goal")}
          </Button>
        </div>
      )}
    </>
  );
}
