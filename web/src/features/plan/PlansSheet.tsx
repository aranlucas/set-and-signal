import { useRef, type ChangeEvent } from "react";
import { useReactToPrint } from "react-to-print";
import { useNavigate } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { Controller, useForm } from "react-hook-form";
import { valibotResolver } from "@hookform/resolvers/valibot";
import { useDateLabels } from "@/shared/hooks/use-date-labels";
import { useStore } from "@/app/store/useStore";
import { fmtDate, todayISO, exCount, weekdayOf } from "@/shared/lib/format";
import { effectiveRoutineIds } from "@/domain/training/history";
import { toast } from "@/shared/lib/toast";
import { Button } from "@/shared/ui/button";
import { Field } from "@/shared/ui/field";
import { Input } from "@/shared/ui/input";
import { Switch } from "@/shared/ui/switch";
import Icon from "@/shared/components/Icon";
import { SpaceBetween } from "@/shared/components/SpaceBetween";
import { PlanPrintDocument } from "@/shared/components/PlanPrintDocument";
import { glyphOf } from "@/domain/exercises/glyphs";
import { buildPlanBundle, parsePlan, mergePlan } from "@/features/plan/plan-share";
import { MOBILE, shareExport } from "@/shared/lib/mobile";
import type {
  DayPlanEntry,
  DaySession,
  Id,
  IsoDate,
  SheetClose,
  Weekday,
} from "@/shared/lib/types";
import { getErrorMessage, updateAppState } from "@/features/exercises/sheet-shared";
import { planImportFormSchema } from "@/shared/lib/form-schemas";

export type ParsedBundle = ReturnType<typeof parsePlan>;

export function PlanTools({
  close,
  openImport,
}: {
  close: SheetClose;
  openImport: (bundle: ParsedBundle) => void;
}) {
  const { t } = useTranslation();
  const st = useStore((store) => store.appState);
  const user = useStore((state) => state.user);
  const fileRef = useRef<HTMLInputElement | null>(null);
  const printRef = useRef<HTMLDivElement | null>(null);
  const hasRoutines = (st.routines || []).some((r) => r.ex && r.ex.length);
  const uname = user?.name || "";
  const printPlan = useReactToPrint({
    contentRef: printRef,
    documentTitle: () => `set-and-signal-plan-${todayISO()}`,
    onAfterPrint: () => void close(),
    onPrintError: () => toast(t("sharing.printDialogError", "Could not open the print dialog")),
  });
  const exportFile = async () => {
    const bundle = buildPlanBundle(
      st,
      uname ? t("sharing.sPlan", "{{name}}’s plan", { name: uname }) : "",
    );
    const json = JSON.stringify(bundle, null, 2);
    const name = "set-and-signal-plan-" + todayISO() + ".json";
    if (MOBILE) {
      try {
        await shareExport(json, name);
      } catch {
        /* dismissed */
      }
      void close();
      return;
    }
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = name;
    a.click();
    URL.revokeObjectURL(url);
    void close();
    toast(t("sharing.planFileSavedSendFriend", "Plan file saved — send it to a friend"));
  };
  const pickFile = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    void file.text().then(async (contents) => {
      try {
        const bundle = parsePlan(contents);
        await close();
        openImport(bundle);
      } catch (error) {
        toast(
          t("settings.importFailed", "Import failed: {{error}}", { error: getErrorMessage(error) }),
        );
      }
    });
  };
  return (
    <>
      <h3>{t("sharing.sharePlan", "Share your plan")}</h3>
      <div className="mb-4 text-sm leading-snug text-foreground/60">
        {t(
          "sharing.sendRoutinesFriendPutWeek",
          "Send your routines to a friend, or put your week on paper.",
        )}
      </div>
      <SpaceBetween size="s">
        <SpaceBetween size="xs">
          <Button
            className="w-full"
            variant="default"
            onClick={() => void exportFile()}
            disabled={!hasRoutines}
          >
            <Icon name="upload" />
            {t("sharing.exportPlanFile", "Export plan file")}
          </Button>
          <div className="mx-0.5 text-sm leading-snug text-muted-foreground">
            {t(
              "sharing.smallFileFriendImportsTheir",
              "A small file a friend imports into their own Set & Signal — routines only, none of your workouts or weigh-ins.",
            )}
          </div>
        </SpaceBetween>
        {!MOBILE && (
          <SpaceBetween size="xs">
            <Button
              className="w-full"
              variant="secondary"
              onClick={printPlan}
              disabled={!hasRoutines}
            >
              <Icon name="download" />
              {t("sharing.printSavePdf", "Print / Save as PDF")}
            </Button>
            <div className="mx-0.5 text-sm leading-snug text-muted-foreground">
              {t(
                "sharing.cleanOnePagePerPlan",
                "A clean one-page-per-plan printout — no exercise ever splits across a page.",
              )}
            </div>
          </SpaceBetween>
        )}
      </SpaceBetween>
      {!MOBILE ? (
        <div className="pointer-events-none fixed size-0 overflow-hidden" aria-hidden="true">
          <PlanPrintDocument appState={st} contentRef={printRef} owner={uname} />
        </div>
      ) : null}
      {!hasRoutines && (
        <div className="mx-0.5 mt-3 text-sm leading-snug text-muted-foreground">
          {t(
            "sharing.addExerciseRoutineFirstEmpty",
            "Add an exercise to a routine first — an empty plan has nothing to share.",
          )}
        </div>
      )}
      <h4 className="my-5.5 mb-2 px-1 text-sm font-normal tracking-tight text-foreground/60">
        {t("sharing.gotPlanFriend", "Got a plan from a friend?")}
      </h4>
      <Button className="w-full" variant="ghost" onClick={() => fileRef.current?.click()}>
        <Icon name="folder" />
        {t("sharing.importPlanFile", "Import a plan file")}
      </Button>
      <Input ref={fileRef} type="file" accept="application/json,.json" onChange={pickFile} hidden />
    </>
  );
}

export function PlanImport({ bundle, close }: { bundle: ParsedBundle; close: SheetClose }) {
  const { t } = useTranslation();
  const nav = useNavigate();
  const { control, handleSubmit } = useForm<{ schedule: boolean }>({
    defaultValues: { schedule: false },
    resolver: valibotResolver(planImportFormSchema),
  });
  const apply = async ({ schedule }: { schedule: boolean }) => {
    updateAppState((state) => mergePlan(state, bundle, { schedule }));
    await close();
    toast(
      t("sharing.addedRoutinesPlan", "Added {{count}} routines to your plan", {
        count: bundle.routineCount,
      }),
    );
    void nav({ to: "/plan" });
  };
  return (
    <form onSubmit={(event) => void handleSubmit(apply)(event)}>
      <h3>
        {bundle.name
          ? t("sharing.import", "Import “{{plan}}”", { plan: bundle.name })
          : t("sharing.importPlan", "Import this plan")}
      </h3>
      <div className="mb-3.5 text-sm leading-snug text-foreground/60">
        {t("sharing.routineCount", "{{count}} routine", {
          count: bundle.routineCount,
        })}
        {" · " + exCount(t, bundle.exerciseCount)}
        {bundle.scheduledDays > 0
          ? " · " +
            t("sharing.scheduledDayCount", "scheduled on {{count}} day", {
              count: bundle.scheduledDays,
            })
          : ""}
      </div>
      <div className="mb-3.5 text-sm leading-snug text-muted-foreground">
        {t(
          "sharing.theseAddedNewRoutinesNothing",
          "These are added as new routines — nothing you already have is changed.",
        )}
      </div>
      {bundle.dropped > 0 && (
        <div className="mb-3.5 text-sm leading-snug text-warning">
          {t(
            "sharing.missingExerciseCount",
            "{{count}} exercise in the file isn’t in your library and was left out.",
            { count: bundle.dropped },
          )}
        </div>
      )}
      {bundle.scheduledDays > 0 && (
        <div className="mb-4 flex items-center justify-between gap-3 border-y border-border/60 px-0.5 py-2.5">
          <div>
            <div className="text-base leading-tight tracking-tight">
              {t("sharing.useWeeklySchedule", "Use this weekly schedule")}
            </div>
            <div className="text-sm leading-snug text-muted-foreground">
              {t(
                "sharing.replacesCurrentMonSunAssignments",
                "Replaces your current Mon–Sun assignments.",
              )}
            </div>
          </div>
          <Controller
            control={control}
            name="schedule"
            render={({ field }) => (
              <Switch
                aria-label={t("sharing.useWeeklySchedule", "Use this weekly schedule")}
                checked={field.value}
                onCheckedChange={field.onChange}
              />
            )}
          />
        </div>
      )}
      <Field>
        <Button type="submit" variant="default">
          {t("exercise.addMyPlan", "Add to my plan")}
        </Button>
        <Button
          type="button"
          variant="ghost"
          className="text-muted-foreground"
          onClick={() => void close()}
        >
          {t("common.cancel", "Cancel")}
        </Button>
      </Field>
    </form>
  );
}

function cloneSessions(sessions: DaySession[]): DaySession[] {
  return sessions.map((session) => ({ ...session }));
}

function materializeDayOverride(
  appState: {
    week: Partial<Record<Weekday, DaySession[]>>;
    dayPlan: Record<IsoDate, DayPlanEntry>;
  },
  iso: IsoDate,
  weekday: Weekday,
): DayPlanEntry {
  const override = appState.dayPlan[iso];
  if (override !== undefined) {
    if (override.rest) return { rest: true };
    return { sessions: cloneSessions(override.sessions ?? []) };
  }
  const weekly = appState.week[weekday] ?? [];
  return weekly.length ? { sessions: cloneSessions(weekly) } : { sessions: [] };
}

export function DayOverride({ iso, close }: { iso: IsoDate; close: SheetClose }) {
  const { t } = useTranslation();
  const st = useStore((store) => store.appState);
  const wd = weekdayOf(new Date(iso + "T12:00:00"));
  const weeklyNames = (st.week[wd] ?? [])
    .map((session) => st.routines.find((routine) => routine.id === session.routineId)?.name)
    .filter(Boolean);
  const hasOvr = st.dayPlan[iso] !== undefined;
  const effIds = new Set(effectiveRoutineIds(st, iso));
  const isRest = hasOvr && st.dayPlan[iso].rest === true;
  const toggleRoutine = (routineId: Id) => {
    updateAppState((appState) => {
      const entry = materializeDayOverride(appState, iso, wd);
      entry.rest = false;
      const sessions = entry.sessions ?? [];
      const index = sessions.findIndex((session) => session.routineId === routineId);
      if (index >= 0) sessions.splice(index, 1);
      else sessions.push({ routineId });
      appState.dayPlan[iso] = sessions.length ? { sessions } : { sessions: [] };
    });
    void close();
    toast(
      t("calendar.plannedFor", "{{routine}} planned for {{date}}", {
        routine: st.routines.find((routine) => routine.id === routineId)?.name,
        date: fmtDate(t, iso),
      }),
    );
  };
  const setRest = () => {
    updateAppState((appState) => {
      appState.dayPlan[iso] = { rest: true };
    });
    void close();
    toast(t("calendar.setRest", "{{date}} set to rest", { date: fmtDate(t, iso) }));
  };
  const clearOverride = () => {
    updateAppState((appState) => {
      delete appState.dayPlan[iso];
    });
    void close();
    toast(t("calendar.backWeeklyPlan", "Back to weekly plan"));
  };
  return (
    <>
      <h3>{fmtDate(t, iso, true)}</h3>
      <div className="mb-3 text-sm leading-snug text-foreground/60">
        {t("calendar.weeklyPlan", "Weekly plan:")}{" "}
        {weeklyNames.length ? weeklyNames.join(", ") : t("common.rest", "Rest")}
        {hasOvr && (
          <span className="text-active"> · {t("calendar.changedDay", "changed for this day")}</span>
        )}
        <br />
        {t(
          "calendar.sickMissedDayWantDifferent",
          "Sick, missed a day or want a different session? Pick what to train instead.",
        )}
      </div>
      <div className="flex flex-col gap-2">
        {st.routines.map((routine) => (
          <Button
            variant="plain"
            type="button"
            key={routine.id}
            className="flex min-h-15 w-full items-center gap-3 rounded-lg bg-card px-3 py-2.5 text-left transition-colors active:bg-muted"
            onClick={() => toggleRoutine(routine.id)}
          >
            <span className="flex size-7 shrink-0 items-center justify-center rounded-sm bg-primary text-lg text-white">
              <Icon name={glyphOf(routine.emoji)} />
            </span>
            <span className="min-w-0 grow">
              <span className="block text-base leading-tight tracking-tight">{routine.name}</span>
              <span className="mt-0.5 block text-sm text-foreground/60">
                {exCount(t, routine.ex.length)}
              </span>
            </span>
            {effIds.has(routine.id) && <Icon name="check" className="text-primary" />}
          </Button>
        ))}
        <Button
          variant="plain"
          type="button"
          className="flex min-h-15 w-full items-center gap-3 rounded-lg bg-card px-3 py-2.5 text-left transition-colors active:bg-muted"
          onClick={setRest}
        >
          <span className="flex size-7 shrink-0 items-center justify-center rounded-sm bg-input text-lg text-white">
            <Icon name="moon" />
          </span>
          <span className="min-w-0 grow">
            <span className="block text-base leading-tight tracking-tight">
              {t("calendar.restSkipDay", "Rest / skip this day")}
            </span>
          </span>
          {isRest && <Icon name="check" className="text-primary" />}
        </Button>
        {hasOvr && (
          <Button
            variant="plain"
            type="button"
            className="flex min-h-15 w-full items-center gap-3 rounded-lg bg-card px-3 py-2.5 text-left transition-colors active:bg-muted"
            onClick={clearOverride}
          >
            <span className="flex size-7 shrink-0 items-center justify-center rounded-sm bg-input text-lg text-white">
              <Icon name="reset" />
            </span>
            <span className="min-w-0 grow">
              <span className="block text-base leading-tight tracking-tight">
                {t("calendar.backWeeklyPlan", "Back to weekly plan")}
              </span>
            </span>
          </Button>
        )}
      </div>
    </>
  );
}
export function DayAssign({ day, close }: { day: Weekday; close: SheetClose }) {
  const { t } = useTranslation();
  const { weekdays } = useDateLabels();
  const appState = useStore((state) => state.appState);
  const selected = appState.week[day] ?? [];
  const selectedIds = new Set(selected.map((session) => session.routineId));
  const clearDay = () => {
    updateAppState((state) => {
      delete state.week[day];
    });
    void close();
  };
  const toggleRoutine = (routineId: Id) => {
    updateAppState((state) => {
      const current = state.week[day] ?? [];
      const index = current.findIndex((session) => session.routineId === routineId);
      if (index >= 0) {
        const next = current.filter((session) => session.routineId !== routineId);
        if (next.length) state.week[day] = next;
        else delete state.week[day];
      } else {
        state.week[day] = [...current, { routineId }];
      }
    });
    void close();
  };
  return (
    <>
      <h3>{weekdays[day]}</h3>
      <div className="flex flex-col gap-2">
        <Button
          variant="plain"
          type="button"
          className="flex min-h-15 w-full items-center gap-3 rounded-lg bg-card px-3 py-2.5 text-left transition-colors active:bg-muted"
          onClick={clearDay}
        >
          <span className="flex size-7 shrink-0 items-center justify-center rounded-sm bg-input text-lg text-white">
            <Icon name="moon" />
          </span>
          <span className="min-w-0 grow">
            <span className="block text-base leading-tight tracking-tight">
              {t("calendar.restDay", "Rest day")}
            </span>
          </span>
          {!selected.length && <Icon name="check" className="text-primary" />}
        </Button>
        {appState.routines.map((routine) => (
          <Button
            variant="plain"
            type="button"
            key={routine.id}
            className="flex min-h-15 w-full items-center gap-3 rounded-lg bg-card px-3 py-2.5 text-left transition-colors active:bg-muted"
            onClick={() => toggleRoutine(routine.id)}
          >
            <span className="flex size-7 shrink-0 items-center justify-center rounded-sm bg-primary text-lg text-white">
              <Icon name={glyphOf(routine.emoji)} />
            </span>
            <span className="min-w-0 grow">
              <span className="block text-base leading-tight tracking-tight">{routine.name}</span>
              <span className="mt-0.5 block text-sm text-foreground/60">
                {exCount(t, routine.ex.length)}
              </span>
            </span>
            {selectedIds.has(routine.id) && <Icon name="check" className="text-primary" />}
          </Button>
        ))}
      </div>
    </>
  );
}
