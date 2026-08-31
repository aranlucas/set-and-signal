import { useEffect, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { Controller, useForm, useWatch } from "react-hook-form";
import { valibotResolver } from "@hookform/resolvers/valibot";
import Icon from "../../components/Icon";
import { NumberField } from "../../components/NumField";
import { Button } from "../../components/ui/button";
import { Sheet, SheetContent, SheetTitle } from "../../components/ui/sheet";
import { todayISO } from "../../lib/format";
import { createStartingStrengthFormSchema } from "../../lib/form-schemas";
import {
  createStartingStrengthPlan,
  STARTING_STRENGTH_LIFTS,
  suggestedStartingWeights,
  type StartingStrengthWeights,
  type StrengthExperience,
} from "../../lib/starting-strength";
import { toast } from "../../lib/toast";
import type { IconName } from "../../components/icon-names";
import type { Unit } from "../../lib/types";
import { cn } from "../../lib/utils";
import { updateAppState } from "../../sheets/shared";
import { useStore } from "../../store/useStore";

type SetupStep = 0 | 1 | 2;

type StartingStrengthFormValues = {
  experience: StrengthExperience;
  unit: Unit;
  weights: StartingStrengthWeights;
};

const EXPERIENCE_OPTIONS: Array<{
  value: StrengthExperience;
  icon: IconName;
}> = [
  {
    value: "new",
    icon: "sparkles",
  },
  {
    value: "some",
    icon: "history",
  },
  {
    value: "confident",
    icon: "figureStrength",
  },
];

function StepProgress({ step }: { step: SetupStep }) {
  return (
    <div className="flex gap-1.5" aria-hidden="true">
      {[0, 1, 2].map((index) => (
        <span
          key={index}
          className={cn(
            "h-1 flex-1 rounded-full transition-colors",
            index <= step ? "bg-primary" : "bg-foreground/15",
          )}
        />
      ))}
    </div>
  );
}

const previousStep = (step: SetupStep): SetupStep => (step === 2 ? 1 : 0);

export default function HomeStrengthSetupSheet() {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const savedUnit = useStore((state) => state.appState.unit);
  const hasRoutines = useStore((state) => state.appState.routines.length > 0);
  const [step, setStep] = useState<SetupStep>(0);
  const { control, handleSubmit, setValue, trigger } = useForm<StartingStrengthFormValues>({
    defaultValues: {
      experience: "new",
      unit: savedUnit,
      weights: suggestedStartingWeights("new", savedUnit),
    },
    resolver: valibotResolver(createStartingStrengthFormSchema(t)),
  });
  const experience = useWatch({ control, name: "experience" });
  const unit = useWatch({ control, name: "unit" });

  const close = () => navigate({ to: "/home", replace: true, resetScroll: false });
  const stepLabel = t("startingSetup.step", "Step {{current}} of 3", { current: step + 1 });
  const experienceOptions = [
    {
      ...EXPERIENCE_OPTIONS[0],
      title: t("startingSetup.experience.newTitle", "New to barbell lifting"),
      description: t(
        "startingSetup.experience.newDescription",
        "Start light, learn the movements, and leave room to progress.",
      ),
    },
    {
      ...EXPERIENCE_OPTIONS[1],
      title: t("startingSetup.experience.someTitle", "I’ve lifted before"),
      description: t(
        "startingSetup.experience.someDescription",
        "Use a conservative baseline near the bottom of common starting ranges.",
      ),
    },
    {
      ...EXPERIENCE_OPTIONS[2],
      title: t("startingSetup.experience.confidentTitle", "I know my current numbers"),
      description: t(
        "startingSetup.experience.confidentDescription",
        "Replace the suggestions with loads you could lift for 10 clean reps.",
      ),
    },
  ];
  const liftRows = [
    {
      ...STARTING_STRENGTH_LIFTS[0],
      label: t("startingSetup.lift.squat", "Squat"),
    },
    {
      ...STARTING_STRENGTH_LIFTS[1],
      label: t("startingSetup.lift.bench", "Bench press"),
    },
    {
      ...STARTING_STRENGTH_LIFTS[2],
      label: t("startingSetup.lift.row", "Barbell row"),
    },
    {
      ...STARTING_STRENGTH_LIFTS[3],
      label: t("startingSetup.lift.press", "Overhead press"),
    },
    {
      ...STARTING_STRENGTH_LIFTS[4],
      label: t("startingSetup.lift.deadlift", "Deadlift"),
    },
  ];
  const firstWeek = [
    {
      day: t("startingSetup.day.monday", "Monday"),
      workout: "A",
      exercises: t("startingSetup.workoutAExercises", "Squat · Bench · Row"),
    },
    {
      day: t("startingSetup.day.wednesday", "Wednesday"),
      workout: "B",
      exercises: t("startingSetup.workoutBExercises", "Squat · Press · Deadlift"),
    },
    {
      day: t("startingSetup.day.friday", "Friday"),
      workout: "A",
      exercises: t("startingSetup.workoutAExercises", "Squat · Bench · Row"),
    },
  ];

  useEffect(() => {
    if (hasRoutines) void navigate({ to: "/home", replace: true, resetScroll: false });
  }, [hasRoutines, navigate]);

  const chooseExperience = (nextExperience: StrengthExperience) => {
    setValue("experience", nextExperience);
    setValue("weights", suggestedStartingWeights(nextExperience, unit), { shouldValidate: true });
  };

  const chooseUnit = (nextUnit: Unit) => {
    setValue("unit", nextUnit);
    setValue("weights", suggestedStartingWeights(experience, nextUnit), { shouldValidate: true });
  };

  const reviewFirstWeek = async () => {
    if (await trigger("weights")) setStep(2);
    else toast(t("startingSetup.validWeights", "Enter a starting weight for every lift"));
  };

  const finish = ({ unit: selectedUnit, weights }: StartingStrengthFormValues) => {
    const plan = createStartingStrengthPlan(weights);
    updateAppState((appState) => {
      appState.unit = selectedUnit;
      appState.routines.push(...plan.routines);
      appState.week = { ...appState.week, ...plan.week };
      for (const [exerciseId, weight] of Object.entries(weights)) {
        appState.exWeights[exerciseId] = { w: weight, d: todayISO() };
      }
    });
    void close();
    toast(t("startingSetup.created", "Your first week is ready"));
  };

  return (
    <Sheet
      open
      onOpenChange={(open) => {
        if (!open) void close();
      }}
    >
      <SheetContent
        side="bottom"
        className="h-dvh max-h-dvh touch-pan-y overflow-y-auto overscroll-contain rounded-none bg-popover px-4.5 pt-3 pb-5 in-data-[theme='light']:bg-background lg:inset-x-auto lg:left-1/2 lg:h-auto lg:max-h-screen lg:w-160 lg:-translate-x-1/2 lg:rounded-2xl"
        showCloseButton={false}
      >
        <SheetTitle className="sr-only">
          {t("startingSetup.title", "Set up your first plan")}
        </SheetTitle>
        <form
          className="flex min-h-full flex-col"
          onSubmit={handleSubmit(finish, () =>
            toast(t("startingSetup.validWeights", "Enter a starting weight for every lift")),
          )}
        >
          <div className="mb-5 flex items-center justify-between gap-3">
            <button
              type="button"
              className="flex size-9 items-center justify-center rounded-full text-lg transition-colors hover:bg-muted active:bg-muted"
              onClick={() => {
                if (step === 0) void close();
                else setStep(previousStep(step));
              }}
              aria-label={step === 0 ? t("common.close", "Close") : t("common.previous", "Prev")}
            >
              <Icon name={step === 0 ? "xmark" : "chevronLeft"} />
            </button>
            <div className="text-sm font-medium text-foreground/60">{stepLabel}</div>
            <span className="size-9" />
          </div>
          <StepProgress step={step} />

          <div className="grow py-6">
            {step === 0 && (
              <section>
                <div className="mb-5 flex size-12 items-center justify-center rounded-lg bg-primary/15 text-2xl text-primary">
                  <Icon name="figureStrength" />
                </div>
                <h2 className="text-3xl leading-tight font-semibold tracking-tight">
                  {t("startingSetup.howStrong", "How strong are you right now?")}
                </h2>
                <p className="mt-2 mb-5 text-base leading-snug text-foreground/60">
                  {t(
                    "startingSetup.howStrongDescription",
                    "Pick the closest match. You’ll review every suggested weight before anything is saved.",
                  )}
                </p>
                <div className="grid gap-2">
                  {experienceOptions.map((option) => {
                    const selected = experience === option.value;
                    return (
                      <button
                        type="button"
                        key={option.value}
                        aria-pressed={selected}
                        className={cn(
                          "flex w-full items-start gap-3 rounded-xl bg-card p-4 text-left transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring",
                          selected && "bg-primary/15 ring-1 ring-primary/40",
                        )}
                        onClick={() => chooseExperience(option.value)}
                      >
                        <span
                          className={cn(
                            "mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-md bg-muted text-lg text-foreground/60",
                            selected && "bg-primary text-primary-foreground",
                          )}
                        >
                          <Icon name={option.icon} />
                        </span>
                        <span>
                          <span className="block text-lg leading-tight font-medium tracking-tight">
                            {option.title}
                          </span>
                          <span className="mt-1 block text-sm leading-snug text-foreground/60">
                            {option.description}
                          </span>
                        </span>
                      </button>
                    );
                  })}
                </div>
              </section>
            )}

            {step === 1 && (
              <section>
                <h2 className="text-3xl leading-tight font-semibold tracking-tight">
                  {t("startingSetup.startingWeights", "Your starting weights")}
                </h2>
                <p className="mt-2 text-base leading-snug text-foreground/60">
                  {experience === "confident"
                    ? t(
                        "startingSetup.knownWeightsDescription",
                        "Enter a load you could lift for 10 clean reps. The total includes the bar.",
                      )
                    : t(
                        "startingSetup.suggestedWeightsDescription",
                        "These are intentionally easy first-session loads. The total includes the bar.",
                      )}
                </p>

                <div className="my-5 grid grid-cols-2 rounded-lg bg-card p-1">
                  {(["lb", "kg"] as const).map((candidate) => (
                    <button
                      type="button"
                      key={candidate}
                      aria-pressed={unit === candidate}
                      className={cn(
                        "rounded-md py-2 text-base font-medium transition-colors",
                        unit === candidate
                          ? "bg-primary text-primary-foreground"
                          : "text-foreground/60",
                      )}
                      onClick={() => chooseUnit(candidate)}
                    >
                      {candidate}
                    </button>
                  ))}
                </div>

                <div className="overflow-hidden rounded-xl bg-card">
                  {liftRows.map((lift, index) => (
                    <label
                      key={lift.id}
                      className={cn(
                        "flex min-h-15 items-center gap-3 px-4 py-2",
                        index > 0 && "border-t border-border/60",
                      )}
                    >
                      <span className="grow text-base font-medium tracking-tight">
                        {lift.label}
                      </span>
                      <span className="flex w-28 items-center gap-2 rounded-lg bg-muted px-3 py-2">
                        <Controller
                          control={control}
                          name={`weights.${lift.id}`}
                          render={({ field, fieldState }) => (
                            <NumberField
                              value={field.value}
                              onChange={(value) => field.onChange(value ?? 0)}
                              decimal={unit === "kg"}
                              aria-invalid={fieldState.invalid}
                              aria-label={t(
                                "startingSetup.weightFor",
                                "Starting weight for {{lift}}",
                                { lift: lift.label },
                              )}
                            />
                          )}
                        />
                        <span className="text-sm font-medium text-foreground/60">{unit}</span>
                      </span>
                    </label>
                  ))}
                </div>
                <p className="mt-3 flex gap-2 text-sm leading-snug text-foreground/60">
                  <Icon name="info" className="mt-0.5 shrink-0" />
                  <span>
                    {t(
                      "startingSetup.adjustAnytime",
                      "Not sure? Start lighter. You can change any load during the workout.",
                    )}
                  </span>
                </p>
              </section>
            )}

            {step === 2 && (
              <section>
                <div className="mb-5 flex size-12 items-center justify-center rounded-lg bg-primary/15 text-2xl text-primary">
                  <Icon name="calendar" />
                </div>
                <h2 className="text-3xl leading-tight font-semibold tracking-tight">
                  {t("startingSetup.firstWeekReady", "Your first week")}
                </h2>
                <p className="mt-2 mb-5 text-base leading-snug text-foreground/60">
                  {t(
                    "startingSetup.firstWeekDescription",
                    "Two simple workouts alternate across Monday, Wednesday, and Friday.",
                  )}
                </p>

                <div className="overflow-hidden rounded-xl bg-card">
                  {firstWeek.map(({ day, workout, exercises }, index) => (
                    <div
                      key={day}
                      className={cn(
                        "flex items-center gap-3 px-4 py-3.5",
                        index > 0 && "border-t border-border/60",
                      )}
                    >
                      <span className="flex size-9 shrink-0 items-center justify-center rounded-md bg-primary/15 font-semibold text-primary">
                        {workout}
                      </span>
                      <span className="grow">
                        <span className="block text-base font-medium">
                          {day} · {t("startingSetup.workout", "Workout {{workout}}", { workout })}
                        </span>
                        <span className="block text-sm text-foreground/60">{exercises}</span>
                      </span>
                    </div>
                  ))}
                </div>

                <div className="mt-3 rounded-xl bg-primary/10 p-4">
                  <div className="flex items-center gap-2 font-medium text-primary">
                    <Icon name="sparkles" />
                    {t("startingSetup.noMath", "No workout math")}
                  </div>
                  <p className="mt-1 text-sm leading-snug text-foreground/60">
                    {t(
                      "startingSetup.noMathDescription",
                      "Your working weights are already set. Complete the reps and Set & Signal will handle the next session.",
                    )}
                  </p>
                </div>
              </section>
            )}
          </div>

          <div className="pt-3">
            {step < 2 ? (
              <Button
                type="button"
                variant="default"
                onClick={() => {
                  if (step === 0) setStep(1);
                  else void reviewFirstWeek();
                }}
              >
                {step === 0
                  ? t("startingSetup.showWeights", "Show my starting weights")
                  : t("startingSetup.reviewWeek", "Review my first week")}
                <Icon name="chevronRight" />
              </Button>
            ) : (
              <Button type="submit" variant="default">
                <Icon name="checkCircle" />
                {t("startingSetup.createPlan", "Create my plan")}
              </Button>
            )}
          </div>
        </form>
      </SheetContent>
    </Sheet>
  );
}
