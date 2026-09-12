import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "@tanstack/react-router";
import {
  ArrowLeft,
  Check,
  Clock3,
  Dumbbell,
  Info,
  Layers3,
  Minus,
  Plus,
  RotateCcw,
  Sparkles,
  Timer,
} from "lucide-react";
import { useStore } from "@/app/store/useStore";
import { useWorkoutTimer } from "@/features/workout/useWorkoutTimer";
import { estimate1RM, REP_CAP } from "@/domain/training/onerm";
import {
  COMMON_PLATES,
  defaultPlateSetup,
  effectivePlateSetup,
  platesFor,
} from "@/domain/training/plates";
import { warmupSets } from "@/domain/training/warmup";
import { fmtNum, fmtPlate } from "@/shared/lib/format";
import type { FormulaId, Unit } from "@/shared/lib/types";
import { cn } from "@/shared/lib/utils";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import { Label } from "@/shared/ui/label";
import { Segmented } from "@/shared/components/Segmented";
import {
  clampToolNumber,
  formatTimer,
  MAX_REST_SECONDS,
  MAX_TOOL_WEIGHT,
  normalizeRestSeconds,
  normalizeToolReps,
  normalizeToolWeight,
  trainingLoads,
} from "@/features/tools/tools";

function ToolNumberField({
  value,
  onChange,
  min = 0,
  max = MAX_TOOL_WEIGHT,
  integer = false,
  className,
  ...props
}: Omit<React.ComponentProps<typeof Input>, "type" | "value" | "onChange"> & {
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  integer?: boolean;
}) {
  const [draft, setDraft] = useState<string | null>(null);
  const displayValue = draft ?? String(value);

  return (
    <Input
      {...props}
      type="text"
      inputMode={integer ? "numeric" : "decimal"}
      min={min}
      max={max}
      value={displayValue}
      onFocus={(event) => event.currentTarget.select()}
      onChange={(event) => {
        const raw = event.currentTarget.value;
        setDraft(raw);
        const parsed = Number(raw.replace(",", "."));
        if (!Number.isFinite(parsed)) return;
        const bounded = clampToolNumber(parsed, min, max);
        onChange(integer ? Math.round(bounded) : bounded);
      }}
      onBlur={() => setDraft(null)}
      className={className}
    />
  );
}

function formulaLabel(
  formula: FormulaId,
  t: (key: string, defaultValue: string) => string,
): string {
  switch (formula) {
    case "epley":
      return t("tools.formulaEpley", "Epley");
    case "brzycki":
      return t("tools.formulaBrzycki", "Brzycki");
    case "lombardi":
      return t("tools.formulaLombardi", "Lombardi");
  }
}

const FORMULA_IDS: FormulaId[] = ["epley", "brzycki", "lombardi"];

function ToolIcon({ children }: { children: React.ReactNode }) {
  return (
    <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
      {children}
    </span>
  );
}

function ToolCard({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <section className={cn("rounded-xl border border-border bg-card p-4 shadow-sm", className)}>
      {children}
    </section>
  );
}

function ToolHeading({
  icon,
  title,
  description,
}: {
  icon: React.ReactNode;
  title: React.ReactNode;
  description: React.ReactNode;
}) {
  return (
    <div className="mb-5 flex items-start gap-3">
      <ToolIcon>{icon}</ToolIcon>
      <div className="min-w-0">
        <h2 className="text-lg font-semibold tracking-tight">{title}</h2>
        <p className="mt-0.5 text-sm leading-snug text-muted-foreground">{description}</p>
      </div>
    </div>
  );
}

export default function ToolsPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const appState = useStore((state) => state.appState);
  const update = useStore((state) => state.update);
  const timer = useWorkoutTimer((state) => state.timer);
  const startRest = useWorkoutTimer((state) => state.startRest);
  const stopRest = useWorkoutTimer((state) => state.stopRest);
  const addRest = useWorkoutTimer((state) => state.addRest);
  const unit = appState.unit;
  const setup = useMemo(() => {
    const saved = effectivePlateSetup(unit, appState.plates);
    return {
      ...saved,
      on: saved.on === true,
      bar: normalizeToolWeight(saved.bar),
      avail: (Array.isArray(saved.avail) ? saved.avail : [])
        .map(normalizeToolWeight)
        .filter((plate) => plate > 0),
    };
  }, [appState.plates, unit]);

  const [targetWeight, setTargetWeight] = useState(100);
  const [warmupWeight, setWarmupWeight] = useState(100);
  const [oneRmWeight, setOneRmWeight] = useState(100);
  const [oneRmReps, setOneRmReps] = useState(5);
  const [formula, setFormula] = useState<FormulaId>("epley");
  const [customRest, setCustomRest] = useState(120);

  const plateResult = useMemo(() => platesFor(targetWeight, setup), [setup, targetWeight]);
  const warmup = useMemo(() => warmupSets(warmupWeight, unit), [unit, warmupWeight]);
  const oneRm = estimate1RM(oneRmWeight, oneRmReps, formula);
  const loadTargets = oneRm === null ? [] : trainingLoads(oneRm, unit);

  const changeUnit = (nextUnit: Unit) => {
    if (nextUnit === unit) return;
    update((state) => {
      state.unit = nextUnit;
      state.plates = defaultPlateSetup(nextUnit);
    });
  };

  const togglePlate = (plate: number) => {
    update((state) => {
      if (!state.plates) state.plates = defaultPlateSetup(state.unit);
      const available = Array.isArray(state.plates.avail) ? state.plates.avail : [];
      state.plates.avail = available.includes(plate)
        ? available.filter((candidate) => candidate !== plate)
        : [...available, plate];
    });
  };

  return (
    <div className="mx-auto w-full max-w-285">
      <header className="mt-2 mb-6 flex items-center gap-3 border-b border-border pb-4">
        <Button
          variant="outline"
          size="icon"
          className="size-11 rounded-full"
          onClick={() => void navigate({ to: "/home" })}
          aria-label={t("tools.backHome", "Back to home")}
        >
          <ArrowLeft className="size-4" />
        </Button>
        <div className="min-w-0 flex-1">
          <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
            {t("tools.title", "Training Tools")}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground sm:text-base">
            {t("tools.subtitle", "Make every set count with quick, practical calculations.")}
          </p>
        </div>
        <Segmented<Unit>
          className="w-25 shrink-0 sm:w-30"
          options={[
            { value: "kg", label: "kg" },
            { value: "lb", label: "lb" },
          ]}
          value={unit}
          onChange={changeUnit}
        />
      </header>

      <div className="grid items-start gap-4 lg:grid-cols-5">
        <ToolCard className="lg:col-span-3 lg:row-span-2">
          <ToolHeading
            icon={<Layers3 className="size-5" />}
            title={t("tools.plateTitle", "Load the bar")}
            description={t("tools.plateDescription", "See exactly what to put on each side.")}
          />
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="sm:col-span-2">
              <Label htmlFor="tools-target-weight" className="mb-2 text-muted-foreground">
                {t("tools.targetWeight", "Target weight")}
              </Label>
              <div className="relative">
                <ToolNumberField
                  id="tools-target-weight"
                  min={0}
                  step={unit === "lb" ? 5 : 2.5}
                  value={targetWeight}
                  onChange={setTargetWeight}
                  className="h-14 rounded-lg border border-input bg-background pr-14 text-2xl font-semibold tabular-nums"
                />
                <span className="pointer-events-none absolute inset-y-0 right-4 flex items-center text-sm font-medium text-muted-foreground">
                  {unit}
                </span>
              </div>
            </div>
            <div>
              <Label htmlFor="tools-bar-weight" className="mb-2 text-muted-foreground">
                {t("tools.barWeight", "Bar weight")}
              </Label>
              <ToolNumberField
                id="tools-bar-weight"
                min={0}
                step={unit === "lb" ? 5 : 2.5}
                value={setup.bar}
                onChange={(bar) => {
                  update((state) => {
                    if (!state.plates) state.plates = defaultPlateSetup(state.unit);
                    state.plates.bar = normalizeToolWeight(bar);
                  });
                }}
                className="h-14 rounded-lg border border-input bg-background text-2xl font-semibold tabular-nums"
              />
            </div>
          </div>

          <div className="mt-5 border-t border-border pt-4">
            <div className="mb-2 flex items-center justify-between gap-3">
              <Label className="text-muted-foreground">
                {t("tools.availablePlates", "Available plates per side")}
              </Label>
              <span className="text-xs text-muted-foreground">
                {t("tools.tapToToggle", "Tap to toggle")}
              </span>
            </div>
            <div className="flex flex-wrap gap-2">
              {COMMON_PLATES[unit].map((plate) => {
                const active = setup.avail.includes(plate);
                return (
                  <Button
                    key={plate}
                    type="button"
                    variant="plain"
                    aria-pressed={active}
                    onClick={() => togglePlate(plate)}
                    className={cn(
                      "min-h-11 min-w-14 rounded-lg border px-3 py-2 text-sm font-semibold tabular-nums transition-colors",
                      active
                        ? "border-primary bg-primary text-primary-foreground"
                        : "border-border bg-muted text-muted-foreground hover:text-foreground",
                    )}
                  >
                    {fmtPlate(plate)}
                  </Button>
                );
              })}
            </div>
          </div>

          <div className="mt-5 rounded-lg bg-muted p-4">
            {plateResult ? (
              <>
                <div className="flex flex-wrap items-end justify-between gap-3">
                  <div>
                    <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
                      {t("tools.eachSide", "Each side")}
                    </p>
                    <p className="mt-1 text-3xl font-bold tracking-tight tabular-nums">
                      {fmtPlate(Math.max(0, (plateResult.achieved - setup.bar) / 2))} {unit}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-muted-foreground">
                      {t("tools.builtTotal", "Built total")}
                    </p>
                    <p
                      className={cn(
                        "mt-1 text-lg font-semibold tabular-nums",
                        !plateResult.exact && "text-amber-600 dark:text-amber-400",
                      )}
                    >
                      {plateResult.exact ? "" : "≈ "}
                      {fmtPlate(plateResult.achieved)} {unit}
                    </p>
                  </div>
                </div>
                <div className="mt-4 flex flex-wrap items-center gap-2">
                  <span className="rounded-md bg-background px-2.5 py-1.5 text-xs font-medium text-muted-foreground">
                    {fmtPlate(setup.bar)} {unit} {t("tools.bar", "bar")}
                  </span>
                  <span className="text-muted-foreground">+</span>
                  {plateResult.perSide.length > 0 ? (
                    plateResult.perSide.map(({ w, count }) => (
                      <span
                        key={w}
                        className="inline-flex items-center gap-1.5 rounded-md bg-background px-2.5 py-1.5 text-sm font-semibold tabular-nums"
                      >
                        <span className="flex items-end gap-0.5" aria-hidden="true">
                          {Array.from({ length: Math.min(count, 4) }, (_, index) => (
                            <i
                              key={index}
                              className="block w-1.5 rounded-sm bg-primary"
                              style={{
                                height: `${12 + Math.round((w / Math.max(...plateResult.perSide.map((plate) => plate.w))) * 10)}px`,
                              }}
                            />
                          ))}
                        </span>
                        {fmtPlate(w)}
                        {count > 1 ? ` ×${count}` : ""}
                      </span>
                    ))
                  ) : (
                    <span className="text-sm text-muted-foreground">
                      {t("tools.noPlates", "No plates needed")}
                    </span>
                  )}
                </div>
                {!plateResult.exact && (
                  <p className="mt-3 flex items-start gap-1.5 text-xs leading-snug text-amber-700 dark:text-amber-300">
                    <Info className="mt-0.5 size-3.5 shrink-0" />
                    {t(
                      "tools.closestLoad",
                      "Your available plates cannot build that exact target, so this is the closest load.",
                    )}
                  </p>
                )}
              </>
            ) : (
              <div className="py-5 text-center">
                <p className="font-medium">
                  {t("tools.plateCalculatorOff", "Plate calculator unavailable")}
                </p>
                <p className="mt-1 text-sm text-muted-foreground">
                  {t(
                    "tools.plateCalculatorOffDescription",
                    "Add a target above the bar weight to see a loading plan.",
                  )}
                </p>
              </div>
            )}
          </div>
        </ToolCard>

        <ToolCard className="lg:col-span-2">
          <ToolHeading
            icon={<Sparkles className="size-5" />}
            title={t("tools.warmupTitle", "Warm-up builder")}
            description={t("tools.warmupDescription", "A simple ramp into your working sets.")}
          />
          <Label htmlFor="tools-warmup-weight" className="mb-2 text-muted-foreground">
            {t("tools.workingWeight", "Working weight")}
          </Label>
          <div className="relative">
            <ToolNumberField
              id="tools-warmup-weight"
              min={0}
              step={unit === "lb" ? 5 : 2.5}
              value={warmupWeight}
              onChange={setWarmupWeight}
              className="h-12 rounded-lg border border-input bg-background pr-14 text-xl font-semibold tabular-nums"
            />
            <span className="pointer-events-none absolute inset-y-0 right-4 flex items-center text-sm font-medium text-muted-foreground">
              {unit}
            </span>
          </div>
          <div className="mt-4 overflow-hidden rounded-lg border border-border">
            {warmup.length > 0 ? (
              warmup.map((set, index) => (
                <div
                  key={set.w}
                  className="flex items-center gap-3 border-b border-border px-3 py-2.5 last:border-0"
                >
                  <span className="flex size-7 shrink-0 items-center justify-center rounded-md bg-primary/10 text-xs font-bold text-primary">
                    {Math.round((set.w / warmupWeight) * 100)}%
                  </span>
                  <span className="min-w-0 flex-1 text-sm font-medium">
                    {t("tools.warmupSet", "Warm-up set")} {index + 1}
                  </span>
                  <span className="text-sm font-semibold tabular-nums">
                    {fmtNum(set.w)} {unit} × {set.r}
                  </span>
                </div>
              ))
            ) : (
              <p className="px-3 py-4 text-sm leading-snug text-muted-foreground">
                {t("tools.warmupEmpty", "This weight is light enough to start without a ramp.")}
              </p>
            )}
          </div>
        </ToolCard>

        <ToolCard className="lg:col-span-2">
          <ToolHeading
            icon={<Dumbbell className="size-5" />}
            title={t("tools.oneRmTitle", "Estimated 1RM")}
            description={t("tools.oneRmDescription", "Turn a hard set into a useful training max.")}
          />
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label htmlFor="tools-onerm-weight" className="mb-2 text-muted-foreground">
                {t("tools.setWeight", "Set weight")}
              </Label>
              <ToolNumberField
                id="tools-onerm-weight"
                min={0}
                step={unit === "lb" ? 5 : 2.5}
                value={oneRmWeight}
                onChange={setOneRmWeight}
                className="h-12 rounded-lg border border-input bg-background text-lg font-semibold tabular-nums"
              />
            </div>
            <div>
              <Label htmlFor="tools-onerm-reps" className="mb-2 text-muted-foreground">
                {t("tools.reps", "Reps")}
              </Label>
              <ToolNumberField
                id="tools-onerm-reps"
                min={1}
                max={REP_CAP}
                integer
                value={oneRmReps}
                onChange={(reps) => setOneRmReps(normalizeToolReps(reps))}
                className="h-12 rounded-lg border border-input bg-background text-lg font-semibold tabular-nums"
              />
            </div>
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            {FORMULA_IDS.map((formulaId) => (
              <Button
                key={formulaId}
                type="button"
                variant="plain"
                onClick={() => setFormula(formulaId)}
                aria-pressed={formula === formulaId}
                className={cn(
                  "min-h-10 rounded-md px-3 text-xs font-medium",
                  formula === formulaId
                    ? "bg-primary/10 text-primary"
                    : "bg-muted text-muted-foreground",
                )}
              >
                {formulaLabel(formulaId, t)}
              </Button>
            ))}
          </div>
          <div className="mt-4 flex items-end justify-between gap-3 rounded-lg bg-muted p-3">
            <div>
              <p className="text-xs text-muted-foreground">
                {t("tools.yourEstimate", "Your estimate")}
              </p>
              <p className="mt-0.5 text-3xl font-bold tracking-tight tabular-nums">
                {oneRm === null ? "—" : `${fmtNum(oneRm)} ${unit}`}
              </p>
            </div>
            {oneRm !== null && (
              <Check className="mb-1 size-5 text-emerald-600 dark:text-emerald-400" />
            )}
          </div>
          {oneRm !== null ? (
            <div className="mt-4">
              <p className="mb-2 text-xs font-medium tracking-wide text-muted-foreground uppercase">
                {t("tools.trainingTargets", "Training targets")}
              </p>
              <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-5">
                {loadTargets.map(({ pct, weight }) => (
                  <div key={pct} className="rounded-md bg-muted px-1 py-2 text-center">
                    <div className="text-xs text-muted-foreground">{pct}%</div>
                    <div className="mt-0.5 text-xs font-semibold tabular-nums">
                      {fmtNum(weight)}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <p className="mt-3 text-xs text-muted-foreground">
              {t("tools.oneRmCap", "Use 1–{{maxReps}} reps for a reliable estimate.", {
                maxReps: REP_CAP,
              })}
            </p>
          )}
        </ToolCard>
      </div>

      <ToolCard className="mt-4">
        <div className="flex flex-wrap items-center gap-3">
          <ToolIcon>
            <Timer className="size-5" />
          </ToolIcon>
          <div className="min-w-0 flex-1">
            <h2 className="text-lg font-semibold tracking-tight">
              {t("tools.restTitle", "Rest timer")}
            </h2>
            <p className="mt-0.5 text-sm text-muted-foreground">
              {t(
                "tools.restDescription",
                "Start a countdown between sets. It stays visible while you move around the app.",
              )}
            </p>
          </div>
          {timer && (
            <span
              className="text-2xl font-bold tracking-tight tabular-nums"
              role="timer"
              aria-live="polite"
            >
              {formatTimer(timer.left)}
            </span>
          )}
          {timer ? (
            <Button
              size="sm"
              variant="outline"
              onClick={stopRest}
              aria-label={t("tools.stopTimer", "Stop timer")}
            >
              <RotateCcw className="size-4" />
              {t("tools.stopTimerLabel", "Stop")}
            </Button>
          ) : null}
        </div>
        <div className="mt-4 grid grid-cols-2 gap-2 sm:flex sm:flex-wrap sm:items-center">
          {[60, 90, 120, 180].map((seconds) => (
            <Button
              key={seconds}
              type="button"
              size="sm"
              variant={timer?.total === seconds ? "default" : "secondary"}
              onClick={() => startRest(seconds)}
            >
              <Clock3 className="size-4" />
              {formatTimer(seconds)}
            </Button>
          ))}
          <div className="col-span-2 flex min-w-0 items-center gap-2 sm:ml-auto sm:w-auto">
            <ToolNumberField
              aria-label={t("tools.customRest", "Custom rest seconds")}
              min={1}
              max={MAX_REST_SECONDS}
              integer
              step={15}
              value={customRest}
              onChange={(seconds) => setCustomRest(normalizeRestSeconds(seconds))}
              className="h-11 min-w-0 flex-1 rounded-lg border border-input bg-background text-sm tabular-nums sm:w-25 sm:flex-none"
            />
            <Button
              type="button"
              size="sm"
              className="min-h-11"
              onClick={() => startRest(customRest)}
            >
              {t("tools.startTimer", "Start")}
            </Button>
          </div>
        </div>
        {timer && (
          <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            <Button
              variant="plain"
              size="sm"
              className="min-h-10 rounded-md bg-muted px-2"
              onClick={() => addRest(-15)}
              aria-label={t("tools.decreaseTimer", "Decrease timer by 15 seconds")}
            >
              <Minus className="size-3" />
              {t("tools.minusSeconds", "−15s")}
            </Button>
            <Button
              variant="plain"
              size="sm"
              className="min-h-10 rounded-md bg-muted px-2"
              onClick={() => addRest(15)}
              aria-label={t("tools.increaseTimer", "Increase timer by 15 seconds")}
            >
              <Plus className="size-3" />
              {t("tools.plusSeconds", "+15s")}
            </Button>
            <span>
              {t("tools.timerHint", "Adjust the countdown from here or use the floating timer.")}
            </span>
          </div>
        )}
      </ToolCard>
    </div>
  );
}
