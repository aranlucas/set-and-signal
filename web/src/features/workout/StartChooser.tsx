import { useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useDateLabels } from "@/shared/hooks/use-date-labels";
import { useNavigate } from "@tanstack/react-router";
import { useStore } from "@/app/store/useStore";
import { sessionProgress } from "@/domain/training/schedule";
import { PlannedSessions } from "./PlannedSessions";
import { todayISO, exCount } from "@/shared/lib/format";
import { Header } from "@/shared/components/Header";
import Icon from "@/shared/components/Icon";
import { SpaceBetween } from "@/shared/components/SpaceBetween";
import { Button } from "@/shared/ui/button";
import { glyphOf } from "@/domain/exercises/glyphs";
import { PreWorkoutBodyweightSheet } from "@/features/account/AccountSheet";
import { beginWorkout } from "@/features/workout/workout-actions";
import { RouteBottomSheet } from "@/shared/components/RouteBottomSheet";
import type { Id } from "@/shared/lib/types";

export function StartChooser() {
  const { t } = useTranslation();
  const { weekdays } = useDateLabels();
  const nav = useNavigate();
  const appState = useStore((state) => state.appState);
  const sessions = sessionProgress(appState, todayISO());
  const routineIdRef = useRef<Id | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const openStart = (nextRoutineId: Id | null) => {
    routineIdRef.current = nextRoutineId;
    setSheetOpen(true);
  };
  const todayOvr = appState.dayPlan[todayISO()] !== undefined;
  const others = appState.routines.filter(
    (r) => !sessions.some((session) => session.routineId === r.id),
  );
  return (
    <div className="mx-auto max-w-140">
      <Header
        variant="h1"
        className="mt-2 mb-4.5"
        description={
          <>
            {weekdays[new Date().getDay()]} —{" "}
            {sessions.length
              ? t("workout.todayIs", "today is {{day}}", {
                  day: sessions.map(({ routine }) => routine.name).join(", "),
                })
              : t("workout.restDayNoOneS", "rest day, but no one’s stopping you")}
          </>
        }
      >
        {t("workout.startWorkout", "Start workout")}
      </Header>
      {sessions.length > 0 && (
        <section className="mb-4">
          <h2 className="mb-3 text-sm text-muted-foreground">
            {t("workout.todaySPlan", "Today's plan")}
            {todayOvr ? " · " + t("calendar.status.rescheduledLowercase", "rescheduled") : ""}
          </h2>
          <PlannedSessions sessions={sessions} onStart={openStart} />
        </section>
      )}
      {others.length > 0 && (
        <>
          <h2 className="mt-5.5 mb-2 px-1 text-sm font-normal tracking-tight text-foreground/60">
            {t("workout.otherRoutines", "Other routines")}
          </h2>
          <SpaceBetween size="xs">
            {others.map((routine) => (
              <Button
                variant="plain"
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
              </Button>
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
          <Button className="w-full" variant="default" onClick={() => void nav({ to: "/plan" })}>
            {t("workout.buildPlanFirst", "Build a plan first")}
          </Button>
        )}
      </SpaceBetween>
      <RouteBottomSheet
        open={sheetOpen}
        onOpenChange={(open) => {
          // This workflow closes only through one of its explicit start/change actions.
          if (open) setSheetOpen(true);
        }}
        title={t("weight.quickCheck", "Quick check-in")}
      >
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
      </RouteBottomSheet>
    </div>
  );
}
