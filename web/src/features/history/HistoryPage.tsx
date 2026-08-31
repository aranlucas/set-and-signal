import { useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useStore } from "@/app/store/useStore";
import { WorkoutDetail, WorkoutRow } from "@/features/history/HistorySheet";
import type { Workout } from "@/shared/lib/types";
import { Sheet, SheetContent, SheetTitle } from "@/shared/ui/sheet";
import Icon from "@/shared/components/Icon";
import { Button } from "@/shared/ui/button";

export default function History() {
  const { t } = useTranslation();
  const nav = useNavigate();
  const state = useStore((store) => store.appState);
  const [workout, setWorkout] = useState<Workout | null>(null);
  const closeSheet = () => {
    setWorkout(null);
    return Promise.resolve();
  };
  return (
    <>
      <div className="mt-2 mb-4.5 flex items-end justify-between gap-3">
        <Button
          variant="plain"
          className="flex size-9 flex-none items-center justify-center rounded-full bg-card text-lg text-foreground transition duration-140 active:scale-95 active:bg-muted"
          onClick={() => nav({ to: "/stats" })}
          aria-label={t("navigation.stats", "Stats")}
        >
          <Icon name="chevronLeft" />
        </Button>
        <div className="ml-3 min-w-0 flex-1">
          <h1 className="text-4xl leading-none font-bold tracking-tight">
            {t("navigation.history", "History")}
          </h1>
          <div className="mt-1 text-base tracking-tight text-foreground/60">
            {t("common.workoutCount", "{{count}} workout", { count: state.workouts.length })}
          </div>
        </div>
      </div>
      {state.workouts.length > 0 ? (
        <div className="flex flex-col gap-2">
          {[...state.workouts].reverse().map((workoutRecord) => (
            <WorkoutRow
              key={workoutRecord.id}
              workout={workoutRecord}
              onClick={() => setWorkout(workoutRecord)}
            />
          ))}
        </div>
      ) : (
        <div className="px-5 py-11 text-center text-base leading-normal text-foreground/60">
          <div className="mb-3 flex justify-center text-4xl text-foreground/60">
            <Icon name="history" />
          </div>
          {t("library.noWorkoutsYet", "No workouts yet.")}
        </div>
      )}
      <Sheet
        open={workout !== null}
        onOpenChange={(open) => {
          if (!open) setWorkout(null);
        }}
      >
        <SheetContent
          side="bottom"
          className="max-h-screen touch-pan-y overflow-y-auto overscroll-contain rounded-2xl bg-sheet p-2 px-4.5 pb-5 lg:inset-x-auto lg:left-1/2 lg:w-160 lg:-translate-x-1/2"
          showCloseButton={false}
        >
          <SheetTitle className="sr-only">
            {workout?.name || t("history.workoutDetails", "Workout details")}
          </SheetTitle>
          <div className="mx-auto mt-1.5 mb-3.5 h-1 w-9 rounded-full bg-foreground/20" />
          {workout && <WorkoutDetail workoutId={workout.id} close={closeSheet} />}
        </SheetContent>
      </Sheet>
    </>
  );
}
