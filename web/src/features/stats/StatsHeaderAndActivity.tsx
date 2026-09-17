import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "@tanstack/react-router";
import { lastBW, streakWeeks } from "@/domain/training/history";
import { fmtNum, todayISO } from "@/shared/lib/format";
import Heatmap from "@/shared/components/Heatmap";
import { Header } from "@/shared/components/Header";
import Icon from "@/shared/components/Icon";
import { Button } from "@/shared/ui/button";
import { Grid } from "@/shared/components/Grid";
import { MetricCard } from "@/shared/components/MetricCard";
import type { AppState } from "@/shared/lib/types";
import { weightDeltaColor, type StatsSheet } from "@/features/stats/stats-types";

export function StatsHeaderAndActivity({
  appState,
  onSheet,
}: {
  appState: AppState;
  onSheet: (sheet: StatsSheet) => void;
}) {
  const { t } = useTranslation();
  const nav = useNavigate();
  const [now] = useState(() => Date.now());
  const recentBodyweight = appState.bodyweight.filter(
    (bodyweight) => (bodyweight.t || new Date(bodyweight.d).getTime()) > now - 30 * 86400000,
  );
  const firstRecentBodyweight = recentBodyweight[0];
  const lastRecentBodyweight = recentBodyweight.at(-1);
  const bodyweightDelta =
    firstRecentBodyweight && lastRecentBodyweight
      ? lastRecentBodyweight.w - firstRecentBodyweight.w
      : null;
  const monthWorkouts = appState.workouts.filter(
    (workout) => workout.d.slice(0, 7) === todayISO().slice(0, 7),
  ).length;
  return (
    <>
      <Header
        variant="h1"
        className="mt-2 mb-4.5"
        description={t("stats.progressHistory", "Progress & history")}
        actions={
          <Button
            variant="plain"
            className="flex size-9 flex-none items-center justify-center rounded-full bg-card text-lg text-foreground transition duration-140 active:scale-95 active:bg-muted"
            onClick={() => void nav({ to: "/history" })}
            aria-label={t("navigation.history", "History")}
          >
            <Icon name="history" />
          </Button>
        }
      >
        {t("navigation.stats", "Stats")}
      </Header>
      <Grid columns={{ default: 2, lg: 4 }} className="mb-3">
        <StatsTile
          icon="dumbbell"
          label={t("stats.workouts", "Workouts")}
          value={appState.workouts.length}
        />
        <StatsTile
          icon="calendar"
          label={t("stats.thisMonth", "This month")}
          value={monthWorkouts}
        />
        <StatsTile
          icon="flame"
          label={t("stats.weekStreak", "Week streak")}
          value={streakWeeks(appState)}
        />
        <StatsTile
          icon="scale"
          label={t("stats.weight30d", "Weight 30d")}
          value={
            bodyweightDelta === null
              ? "—"
              : (bodyweightDelta > 0 ? "+" : "") + fmtNum(bodyweightDelta) + " " + appState.unit
          }
          valueColor={
            bodyweightDelta === null
              ? "inherit"
              : weightDeltaColor(bodyweightDelta, lastBW(appState)?.w || 0, appState.targetW)
          }
        />
      </Grid>
      <div className="mb-3 rounded-lg bg-card p-4">
        <h2 className="m-0 mb-3 text-sm font-normal tracking-tight text-foreground/60">
          {t("stats.activityLast12Months", "Activity — last 12 months")}{" "}
          <span className="text-sm font-normal tracking-normal text-muted-foreground">
            · {t("stats.timeTrained", "by time trained")}
          </span>
        </h2>
        <Heatmap
          appState={appState}
          onDay={(iso) => {
            const workouts = appState.workouts.filter((workout) => workout.d === iso);
            if (workouts.length === 1) onSheet({ kind: "workout", workout: workouts[0] });
            else if (workouts.length > 0) onSheet({ kind: "calendar", start: iso });
          }}
        />
      </div>
    </>
  );
}

function StatsTile({
  icon,
  label,
  value,
  valueColor,
}: {
  icon: "dumbbell" | "calendar" | "flame" | "scale";
  label: string;
  value: string | number;
  valueColor?: string;
}) {
  return (
    <MetricCard>
      <div className="flex items-center gap-1.5 text-sm text-foreground/60">
        <Icon name={icon} />
        {label}
      </div>
      <div
        className="mt-1 text-3xl leading-tight font-semibold tracking-tight"
        style={{ color: valueColor }}
      >
        {value}
      </div>
    </MetricCard>
  );
}
