import { useNavigate } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { ArrowRight, HeartPulse, Plus, Target } from "lucide-react";
import { useStore } from "@/app/store/useStore";
import { effectiveRoutine, lastBW } from "@/domain/training/history";
import { useMuscleLabels } from "@/shared/hooks/use-muscle-labels";
import { useMeasurementFields } from "@/shared/hooks/use-measurement-fields";
import { fmtNum, isoOf, todayISO } from "@/shared/lib/format";
import { Button } from "@/shared/ui/button";
import { recoveryForRoutine } from "./home-insights";

export default function BodySignals() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const state = useStore((store) => store.appState);
  const labels = useMuscleLabels();
  const fields = useMeasurementFields();
  const weight = lastBW(state);
  const latestMeasures = state.measures.at(-1);
  const today = todayISO();
  const cutoff = new Date(today + "T12:00:00");
  cutoff.setDate(cutoff.getDate() - 5);
  const cutoffIso = isoOf(cutoff);
  const hasRecentTraining = state.workouts.some(
    (workout) => workout.d >= cutoffIso && workout.d <= today,
  );
  const recovery = recoveryForRoutine(
    state.workouts,
    effectiveRoutine(state, todayISO()),
    todayISO(),
  );
  return (
    <div className="body-signals">
      <section className="dashboard-panel">
        <div className="panel-heading">
          <h2>{t("home.recoveryEstimate", "Recovery estimate")}</h2>
          <HeartPulse size={18} className="text-primary" />
        </div>
        {hasRecentTraining ? (
          <div className="recovery-list">
            {recovery.map((item) => (
              <div className="recovery-row" key={item.muscle}>
                <span>{labels[item.muscle]}</span>
                <div className="recovery-track">
                  <span style={{ width: `${item.recovery}%` }} />
                </div>
                <strong>{item.recovery}%</strong>
              </div>
            ))}
          </div>
        ) : (
          <p className="body-signal-note">
            {t(
              "dashboard.noRecentRecovery",
              "Log a workout to see recent muscle load. There are no sessions recorded in the last six days.",
            )}
          </p>
        )}
        {hasRecentTraining && (
          <p className="body-signal-note">
            {t(
              "dashboard.recoveryNote",
              "Based on your logged muscle load over the last six days. An estimate, not a readiness measurement.",
            )}
          </p>
        )}
      </section>
      <section className="dashboard-panel">
        <div className="panel-heading">
          <h2>{t("dashboard.bodyAndGoals", "Body & goals")}</h2>
          <Button
            variant="plain"
            className="panel-link"
            onClick={() => void navigate({ to: "/home/goal", resetScroll: false })}
          >
            <Target size={14} />
            {t("dashboard.editGoal", "Set a goal")}
          </Button>
        </div>
        <div className="body-weight-values">
          <div>
            <small>{t("dashboard.latestWeight", "Latest weight")}</small>
            <strong>
              {weight ? fmtNum(weight.w) : "—"}
              <span>{state.unit}</span>
            </strong>
          </div>
          <ArrowRight size={20} />
          <div>
            <small>{t("dashboard.targetWeight", "Target weight")}</small>
            <strong>
              {state.targetW ? fmtNum(state.targetW) : "—"}
              <span>{state.unit}</span>
            </strong>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => void navigate({ to: "/home/bodyweight", resetScroll: false })}
          >
            <Plus size={15} />
            {t("weight.log", "Log")}
          </Button>
        </div>
        <div className="body-measure-line">
          {latestMeasures ? (
            <span>
              {fields
                .filter((field) => latestMeasures[field.key] !== undefined)
                .slice(0, 3)
                .map((field) => `${field.label} ${fmtNum(latestMeasures[field.key] ?? 0)} cm`)
                .join(" · ")}
            </span>
          ) : (
            <span>
              {t("dashboard.noMeasurements", "Capture the progress the scale can't show.")}
            </span>
          )}
          <Button
            variant="plain"
            className="panel-link"
            onClick={() => void navigate({ to: "/home/measures", resetScroll: false })}
          >
            {t("dashboard.measure", "Measure")}
            <ArrowRight size={13} />
          </Button>
        </div>
      </section>
    </div>
  );
}
