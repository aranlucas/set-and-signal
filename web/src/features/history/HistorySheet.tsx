import { useState, type ReactElement } from "react";
import { useTranslation } from "react-i18next";
import { useForm } from "react-hook-form";
import { valibotResolver } from "@hookform/resolvers/valibot";
import { useDateLabels } from "@/shared/hooks/use-date-labels";
import { useStore } from "@/app/store/useStore";
import { EXIDX } from "@/domain/exercises/exercises";
import { fmtDate, fmtDur, fmtVol, durPart, todayISO } from "@/shared/lib/format";
import { effectiveRoutineId, setLabel, setsDone } from "@/domain/training/history";
import { toast } from "@/shared/lib/toast";
import { Button } from "@/shared/ui/button";
import { Textarea } from "@/shared/ui/textarea";
import Icon from "@/shared/components/Icon";
import { glyphOf } from "@/domain/exercises/glyphs";
import { Thumb } from "@/shared/components/Media";
import type { IsoDate, SheetClose, Workout, WorkoutEntry } from "@/shared/lib/types";
import { toCatalogExercise, updateAppState } from "@/features/exercises/sheet-shared";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/shared/ui/alert-dialog";
import { noteFormSchema } from "@/shared/lib/form-schemas";

export interface HistorySheetActions {
  onDayOverride?: (iso: IsoDate) => void;
  onWorkoutDetail?: (workout: Workout) => void;
  onCalendarDay?: (iso: IsoDate, workouts: Workout[]) => void;
}

export function WorkoutDetail({
  workoutId,
  close,
}: {
  workoutId: Workout["id"];
  close: SheetClose;
}) {
  const { t } = useTranslation();
  const workout = useStore((store) =>
    store.appState.workouts.find((candidate) => candidate.id === workoutId),
  );
  const unit = useStore((store) => store.appState.unit);
  const [confirmOpen, setConfirmOpen] = useState(false);
  // Notes stay editable after the fact — a session log you can't correct is a log
  // you stop trusting. Edits write straight into the stored workout.
  const [editingNoteFor, setEditingNoteFor] = useState<Workout["id"] | null>(null);
  const editingNote = editingNoteFor === workoutId;
  const { handleSubmit, register, reset } = useForm<{ note: string }>({
    defaultValues: { note: workout?.note ?? "" },
    values: { note: workout?.note ?? "" },
    resolver: valibotResolver(noteFormSchema),
  });
  if (!workout) return null;
  const saveNote = ({ note }: { note: string }) => {
    updateAppState((draft) => {
      const saved = draft.workouts.find((candidate) => candidate.id === workout.id);
      if (!saved) return;
      if (note.trim()) saved.note = note;
      else delete saved.note;
    });
    setEditingNoteFor(null);
  };
  const deleteWorkout = () => {
    updateAppState((draft) => {
      draft.workouts = draft.workouts.filter((savedWorkout) => savedWorkout.id !== workout.id);
    });
    void close();
    toast(t("workout.completion.workoutDeleted", "Workout deleted"));
  };
  const prSet = new Set(workout.prs);
  return (
    <>
      <h3>{workout.name}</h3>
      <div className="mb-3 text-sm leading-snug text-foreground/60">
        {[
          fmtDate(t, workout.d, true),
          ...durPart(workout.end - workout.start),
          fmtVol(workout.vol, unit),
          ...(workout.bw ? [String(workout.bw) + " " + unit] : []),
        ].join(" · ")}
      </div>
      <div className="mb-3">
        {editingNote ? (
          <form onSubmit={handleSubmit(saveNote)}>
            <Textarea
              {...register("note")}
              placeholder={t(
                "workout.notes.placeholder",
                "How did it go? Aches, cues, what to try next time…",
              )}
              className="min-h-20 resize-none bg-card text-base"
              aria-label={t("workout.notes.title", "Notes")}
            />
            <div className="mt-2 flex gap-2">
              <Button type="submit" size="sm" variant="default">
                <Icon name="check" />
                {t("workout.notes.save", "Save note")}
              </Button>
              <Button
                type="button"
                size="sm"
                onClick={() => {
                  reset({ note: workout.note ?? "" });
                  setEditingNoteFor(null);
                }}
              >
                {t("common.cancel", "Cancel")}
              </Button>
            </div>
          </form>
        ) : (
          <button
            type="button"
            className="flex w-full items-start gap-2 rounded-lg bg-card px-4 py-3 text-left transition-colors active:bg-muted"
            onClick={() => {
              reset({ note: workout.note ?? "" });
              setEditingNoteFor(workout.id);
            }}
            aria-label={t("workout.notes.edit", "Edit notes")}
          >
            <Icon name="clipboard" className="mt-0.5 shrink-0 text-base text-muted-foreground" />
            {workout.note ? (
              <span className="min-w-0 flex-1 text-base leading-normal whitespace-pre-wrap text-foreground/60">
                {workout.note}
              </span>
            ) : (
              <span className="min-w-0 flex-1 text-sm leading-snug text-muted-foreground">
                {t("workout.notes.add", "Add a note…")}
              </span>
            )}
            <Icon name="pencil" className="mt-0.5 shrink-0 text-sm text-muted-foreground" />
          </button>
        )}
      </div>
      {workout.entries.map((entry) => {
        const exercise = EXIDX[entry.id];
        const legacy = entry as WorkoutEntry & { n?: string };
        return (
          <div
            key={`${workout.id}-${entry.id}-${entry.topW ?? ""}`}
            className="mb-3 flex items-start gap-3"
          >
            {exercise && <Thumb exercise={toCatalogExercise(exercise)} />}
            <div className="min-w-0 grow">
              <div className="text-base leading-tight font-semibold tracking-tight capitalize">
                {exercise ? exercise.n : legacy.n || entry.muscleSnapshot?.n || entry.id}{" "}
                {prSet.has(entry.id) && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-yellow-400/15 px-1.5 py-0.5 text-xs font-medium text-warning">
                    <Icon name="trophy" />
                    PR
                  </span>
                )}
              </div>
              <div className="mt-0.5 text-sm text-foreground/60">
                {entry.sets
                  .flatMap((set) => (set.done ? [setLabel(entry.id, set, entry.target)] : []))
                  .join("  ·  ") || t("workout.completion.noSets", "no sets")}
              </div>
            </div>
          </div>
        );
      })}
      <Button className="w-full" variant="destructive" onClick={() => setConfirmOpen(true)}>
        {t("workout.completion.deleteWorkoutLabel", "Delete workout")}
      </Button>
      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {t("workout.completion.deleteWorkout", "Delete workout?")}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {t(
                "workout.completion.removesHistoryGood",
                "This removes it from your history for good.",
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("common.cancel", "Cancel")}</AlertDialogCancel>
            <AlertDialogAction variant="destructive" onClick={deleteWorkout}>
              {t("common.delete", "Delete")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

export function Calendar({
  start,
  close,
  onDayOverride,
  onWorkoutDetail,
  onCalendarDay,
}: {
  start?: IsoDate;
  close: SheetClose;
} & HistorySheetActions) {
  const { t } = useTranslation();
  const { monthsLong, weekdaysShort } = useDateLabels();
  const st = useStore((store) => store.appState);
  const [cur, setCur] = useState<Date>(() => {
    const d = start ? new Date(start) : new Date();
    d.setDate(1);
    return d;
  });
  const y = cur.getFullYear();
  const mo = cur.getMonth();
  const byDay: Record<string, Workout[]> = {};
  st.workouts.forEach((w) => {
    (byDay[w.d] = byDay[w.d] || []).push(w);
  });
  const startOffset = (new Date(y, mo, 1).getDay() + 6) % 7;
  const daysIn = new Date(y, mo + 1, 0).getDate();
  const monthWs = st.workouts.filter((w) =>
    w.d.startsWith(y + "-" + String(mo + 1).padStart(2, "0")),
  );
  const monthVol = monthWs.reduce((a, w) => a + (w.vol || 0), 0);
  const monthMs = monthWs.reduce((a, w) => a + Math.max(0, (w.end || w.start) - w.start), 0);
  const cells: ReactElement[] = [];
  for (let i = 0; i < startOffset; i++) cells.push(<div key={"e" + i} />);
  for (let d = 1; d <= daysIn; d++) {
    const iso = y + "-" + String(mo + 1).padStart(2, "0") + "-" + String(d).padStart(2, "0");
    const ws = byDay[iso];
    const effId = effectiveRoutineId(st, iso);
    const ovr = st.dayPlan[iso] !== undefined;
    const dotCls = ws ? "done" : ovr && effId ? "ovr" : effId ? "plan" : "";
    cells.push(
      <button
        key={d}
        className={
          "flex aspect-square flex-col items-center justify-center gap-1 rounded-md bg-card text-base text-foreground transition-colors active:bg-muted" +
          (ws ? " bg-primary/15 text-primary" : "") +
          (iso === todayISO() ? " ring-2 ring-primary" : "")
        }
        onClick={async () => {
          await close();
          if (!ws) {
            onDayOverride?.(iso);
            return;
          }
          if (ws.length === 1) {
            onWorkoutDetail?.(ws[0]);
            return;
          }
          onCalendarDay?.(iso, ws);
        }}
      >
        <span>{d}</span>
        <i
          className={
            "size-1 rounded-full bg-transparent" +
            (dotCls === "done"
              ? " bg-primary"
              : dotCls === "plan"
                ? " bg-foreground/30"
                : dotCls === "ovr"
                  ? " bg-orange-500"
                  : "")
          }
        />
      </button>,
    );
  }
  return (
    <>
      <div className="mb-0.5 flex items-center justify-between">
        <button
          className="flex size-9 shrink-0 items-center justify-center rounded-full bg-card text-lg text-foreground transition active:scale-95 active:bg-muted"
          onClick={() => setCur(new Date(y, mo - 1, 1))}
          aria-label="Previous month"
        >
          <Icon name="chevronLeft" />
        </button>
        <h3 className="m-0">
          {monthsLong[mo]} {y}
        </h3>
        <button
          className="flex size-9 shrink-0 items-center justify-center rounded-full bg-card text-lg text-foreground transition active:scale-95 active:bg-muted"
          onClick={() => setCur(new Date(y, mo + 1, 1))}
          aria-label="Next month"
        >
          <Icon name="chevronRight" />
        </button>
      </div>
      <div className="text-center text-sm leading-snug text-foreground/60">
        {monthWs.length > 0
          ? `${t("common.workoutCount", "{{count}} workout", { count: monthWs.length })} · ${fmtDur(monthMs)} · ${fmtVol(monthVol, st.unit)}`
          : t("calendar.noWorkoutsMonth", "No workouts this month")}
      </div>
      <div className="mt-2.5 grid grid-cols-7 gap-1.5">
        {[1, 2, 3, 4, 5, 6, 0].map((day) => (
          <div
            key={day}
            className="px-0 py-0.5 text-center text-xs font-medium text-muted-foreground uppercase"
          >
            {weekdaysShort[day]}
          </div>
        ))}
        {cells}
      </div>
      <div className="mt-3 flex justify-center gap-3.5 text-xs text-muted-foreground">
        <span>
          <i className="mr-1.5 inline-block size-1.5 rounded-full bg-primary" />
          {t("calendar.trained", "Trained")}
        </span>
        <span>
          <i className="mr-1.5 inline-block size-1.5 rounded-full bg-foreground/30" />
          {t("calendar.status.planned", "Planned")}
        </span>
        <span>
          <i className="mr-1.5 inline-block size-1.5 rounded-full bg-orange-500" />
          {t("calendar.status.rescheduled", "Rescheduled")}
        </span>
      </div>
      <div className="mt-2.5 text-center text-sm leading-snug text-muted-foreground">
        {t(
          "calendar.tapTrainedDayDetailsTap",
          "Tap a trained day for details · tap any other day to plan a session",
        )}
      </div>
    </>
  );
}

export function WorkoutRow({
  workout,
  onClick,
}: {
  workout: Workout;
  onClick?: () => void;
}): ReactElement {
  const { t } = useTranslation();
  const appState = useStore((state) => state.appState);
  const glyph = glyphOf(
    appState.routines.find((routine) => routine.id === workout.routineId)?.emoji,
  );
  const content = (
    <>
      <span className="flex size-8.5 shrink-0 items-center justify-center rounded-lg bg-primary text-xl text-white">
        <Icon name={glyph} />
      </span>
      <span className="min-w-0 grow">
        <span className="block text-base leading-tight tracking-tight">{workout.name}</span>
        <span className="mt-0.5 block text-sm text-foreground/60">
          {[
            fmtDate(t, workout.d, true),
            ...durPart(workout.end - workout.start),
            t("workout.completion.sets", "{{count}} sets", { count: setsDone(workout) }),
            fmtVol(workout.vol, appState.unit),
          ].join(" · ")}
        </span>
      </span>
      {workout.prs && workout.prs.length > 0 && (
        <span className="inline-flex items-center gap-1 rounded-full bg-yellow-400/15 px-1.5 py-0.5 text-xs font-medium text-warning">
          <Icon name="trophy" />
          {workout.prs.length} PR
        </span>
      )}
      {!!workout.note && (
        <Icon name="clipboard" className="shrink-0 text-sm text-muted-foreground" />
      )}
      <Icon name="chevronRight" className="shrink-0 text-base text-foreground" />
    </>
  );
  return onClick ? (
    <button
      type="button"
      className="flex min-h-15 w-full items-center gap-3 rounded-lg bg-card px-3 py-2.5 text-left transition-colors active:bg-muted"
      onClick={onClick}
    >
      {content}
    </button>
  ) : (
    <div className="flex min-h-15 w-full items-center gap-3 rounded-lg bg-card px-3 py-2.5 text-left">
      {content}
    </div>
  );
}
