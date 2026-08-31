import type { RefObject } from "react";
import type { TFunction } from "i18next";
import { useTranslation } from "react-i18next";
import { useDateLabels } from "@/shared/hooks/use-date-labels";
import { useExerciseMetadataLabels } from "@/shared/hooks/use-exercise-metadata-labels";
import { EXIDX } from "@/domain/exercises/exercises";
import { exCount, fmtDate, fmtNum, todayISO } from "@/shared/lib/format";
import { fmtSec, isBw, isPerSide, modeOf, sideReps } from "@/domain/training/history";
import type { AppState, CustomEx, ExConfig, Exercise, Routine, Weekday } from "@/shared/lib/types";
import styles from "@/shared/components/PlanPrintDocument.module.css";

const WEEK_ORDER: Weekday[] = [1, 2, 3, 4, 5, 6, 0];

type PrintableState = Pick<AppState, "customEx" | "routines" | "unit" | "week">;
type ExerciseDetails = Exercise | CustomEx;
type KeyedExercise = { config: ExConfig; key: string };
type ExerciseGroup = { exercises: KeyedExercise[]; key: string };

export interface PlanPrintDocumentProps {
  appState: PrintableState;
  contentRef: RefObject<HTMLDivElement | null>;
  owner?: string | null;
}

// One exercise's scheme, e.g. "3 × 10 · 60 kg", "3 × 0:45" or "2 × 20 min @ 8 km/h".
function scheme(t: TFunction, config: ExConfig, unit: string): string {
  const sets = config.sets || 1;
  const mode = modeOf(config);
  if (mode === "cardio") {
    const body = `${config.min || 20} min @ ${fmtNum(config.speed || 8)} km/h`;
    return sets > 1 ? `${sets} × ${body}` : body;
  }
  let summary =
    mode === "time" ? `${sets} × ${fmtSec(config.sec || 45)}` : `${sets} × ${config.reps ?? 10}`;
  if (config.weight) summary += ` · ${isBw(config) ? "+" : ""}${fmtNum(config.weight)} ${unit}`;
  if (mode !== "time" && isPerSide(config))
    summary += ` · ${t("exercise.measurement.side", "{{reps}}/side", {
      reps: fmtNum(sideReps(config.reps ?? 10)),
    })}`;
  return summary;
}

// Consecutive exercises with the same superset id must stay together on paper.
function groupedExercises(exercises: ExConfig[]): ExerciseGroup[] {
  const groups: ExerciseGroup[] = [];
  const occurrences = new Map<string, number>();
  exercises.forEach((exercise, index) => {
    const occurrence = (occurrences.get(exercise.id) || 0) + 1;
    occurrences.set(exercise.id, occurrence);
    const keyedExercise = { config: exercise, key: `${exercise.id}-${occurrence}` };
    const previousExercise = exercises[index - 1];
    if (index > 0 && exercise.sg && previousExercise?.sg === exercise.sg)
      groups.at(-1)?.exercises.push(keyedExercise);
    else
      groups.push({
        exercises: [keyedExercise],
        key: exercise.sg ? `${exercise.sg}-${keyedExercise.key}` : keyedExercise.key,
      });
  });
  return groups;
}

function ExerciseRow({
  config,
  details,
  unit,
}: {
  config: ExConfig;
  details?: ExerciseDetails;
  unit: string;
}) {
  const { t } = useTranslation();
  const metadata = useExerciseMetadataLabels();
  return (
    <div className={styles.exercise}>
      <div className={styles.exerciseName}>
        {details?.n || t("sharing.unknownExercise", "Unknown exercise")}
        {details?.bp && details.bp !== "cardio" ? (
          <span className={styles.bodyPart}>{metadata.bodyPart(details.bp)}</span>
        ) : null}
      </div>
      <div className={styles.scheme}>{scheme(t, config, unit)}</div>
    </div>
  );
}

function RoutineSection({
  exerciseIndex,
  routine,
  unit,
}: {
  exerciseIndex: ReadonlyMap<string, ExerciseDetails>;
  routine: Routine;
  unit: string;
}) {
  const { t } = useTranslation();
  return (
    <section className={styles.routine}>
      <div className={styles.routineHeader}>
        <h2>{routine.name}</h2>
        <span className={styles.routineCount}>{exCount(t, routine.ex.length)}</span>
      </div>
      <div className={styles.exerciseList}>
        {groupedExercises(routine.ex).map((group) => {
          const rows = group.exercises.map(({ config, key }) => (
            <ExerciseRow
              key={key}
              config={config}
              details={exerciseIndex.get(config.id)}
              unit={unit}
            />
          ));
          return group.exercises.length > 1 ? (
            <div className={styles.superset} key={group.key}>
              <div className={styles.supersetLabel}>{t("workout.type.superset", "Superset")}</div>
              {rows}
            </div>
          ) : (
            rows
          );
        })}
      </div>
    </section>
  );
}

export function PlanPrintDocument({ appState, contentRef, owner }: PlanPrintDocumentProps) {
  const { t } = useTranslation();
  const { weekdays } = useDateLabels();
  const exerciseIndex = new Map<string, ExerciseDetails>(Object.entries(EXIDX));
  appState.customEx.forEach((exercise) => exerciseIndex.set(exercise.id, exercise));
  const routines = appState.routines.filter((routine) => routine.ex.length > 0);
  const subtitle = [owner, fmtDate(t, todayISO())].filter(Boolean).join(" · ");

  return (
    <div className={styles.root} ref={contentRef}>
      <header className={styles.header}>
        <div className={styles.kicker}>Set &amp; Signal / Working Proof</div>
        <h1>{t("sharing.weeklyTrainingPlan", "Weekly Training Plan")}</h1>
        {subtitle ? <div className={styles.subtitle}>{subtitle}</div> : null}
      </header>

      <h3 className={styles.blockTitle}>{t("plan.weekSchedule", "Week schedule")}</h3>
      <div className={styles.week}>
        {WEEK_ORDER.map((weekday) => {
          const routine = appState.routines.find(
            (candidate) => candidate.id === appState.week[weekday],
          );
          return (
            <div className={styles.weekRow} key={weekday}>
              <div className={styles.weekday}>{weekdays[weekday]}</div>
              <div className={styles.scheduledRoutine}>
                {routine ? routine.name : <span>{t("common.rest", "Rest")}</span>}
              </div>
            </div>
          );
        })}
      </div>

      <h3 className={styles.blockTitle}>{t("plan.routines", "Routines")}</h3>
      {routines.length > 0 ? (
        routines.map((routine) => (
          <RoutineSection
            exerciseIndex={exerciseIndex}
            key={routine.id}
            routine={routine}
            unit={appState.unit || "lb"}
          />
        ))
      ) : (
        <p className={styles.none}>{t("plan.noRoutinesYet", "No routines yet.")}</p>
      )}

      <footer className={styles.footer}>
        {t("sharing.madeWithApp", "Made with Set & Signal")} ·{" "}
        {t("sharing.privateTrainingLog", "private training log")}
      </footer>
    </div>
  );
}
