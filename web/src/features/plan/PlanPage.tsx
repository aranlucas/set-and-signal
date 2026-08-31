import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "@tanstack/react-router";
import { useStore } from "@/app/store/useStore";
import { uid, exCount } from "@/shared/lib/format";
import { useDateLabels } from "@/shared/hooks/use-date-labels";
import { CuratedPlans } from "@/features/plan/CuratedPlanSheet";
import { DayAssign, PlanImport, PlanTools, type ParsedBundle } from "@/features/plan/PlansSheet";
import Icon from "@/shared/components/Icon";
import { Grid } from "@/shared/components/Grid";
import { Button } from "@/shared/ui/button";
import { Sheet, SheetContent, SheetTitle } from "@/shared/ui/sheet";
import { glyphOf, DEFAULT_GLYPH } from "@/domain/exercises/glyphs";
import type { SheetClose, Weekday } from "@/shared/lib/types";

type PlanSheet =
  | { kind: "tools" }
  | { kind: "import"; bundle: ParsedBundle }
  | { kind: "assign"; day: Weekday }
  | { kind: "curated" };

export default function Plan() {
  const { t } = useTranslation();
  const { weekdays } = useDateLabels();
  const nav = useNavigate();
  const state = useStore((store) => store.appState);
  const update = useStore((store) => store.update);
  const [sheet, setSheet] = useState<PlanSheet | null>(null);
  const closeSheet: SheetClose = () => {
    setSheet(null);
    return Promise.resolve();
  };

  const addRoutine = () => {
    const newRoutine = {
      id: uid(),
      name: t("exercise.newRoutine", "New routine"),
      emoji: DEFAULT_GLYPH,
      ex: [],
    };
    update((s) => {
      s.routines.push(newRoutine);
    });
    void nav({ to: "/plan/r/$id", params: { id: newRoutine.id } });
  };

  return (
    <>
      <div className="mt-2 mb-4.5 flex items-end justify-between gap-3">
        <div>
          <h1 className="text-4xl leading-none font-bold tracking-tight">
            {t("navigation.plan", "Plan")}
          </h1>
          <div className="mt-1 text-base tracking-tight text-foreground/60">
            {t("plan.weeklyRoutine", "Your weekly routine")}
          </div>
        </div>
        <button
          className="flex size-9 flex-none items-center justify-center rounded-full bg-card text-lg text-foreground transition duration-140 active:scale-95 active:bg-muted"
          onClick={() => setSheet({ kind: "tools" })}
          aria-label={t("sharing.sharePlan", "Share your plan")}
          title={t("sharing.sharePlan", "Share your plan")}
        >
          <Icon name="upload" />
        </button>
      </div>
      <div className="block lg:grid lg:grid-cols-2 lg:items-start lg:gap-3.5 [&>*]:min-w-0">
        <div>
          <h2 className="mt-6 mb-2 px-1 font-sans text-sm leading-none font-medium tracking-tight text-foreground/60">
            {t("plan.weekSchedule", "Week schedule")}
          </h2>
          <div className="flex flex-col gap-2">
            {([1, 2, 3, 4, 5, 6, 0] as Weekday[]).map((d) => {
              const routine = state.routines.find((candidate) => candidate.id === state.week[d]);
              return (
                <button
                  type="button"
                  key={d}
                  className="flex min-h-15 w-full items-center gap-3 rounded-lg bg-card px-3 py-2 text-left transition-colors duration-140 active:bg-muted"
                  onClick={() => setSheet({ kind: "assign", day: d })}
                >
                  <div className="min-w-0 flex-1">
                    <div className="text-base leading-tight font-normal tracking-tight">
                      {weekdays[d]}
                    </div>
                  </div>
                  {routine ? (
                    <span className="inline-flex items-center gap-1 rounded-sm bg-primary/15 px-2 py-0.5 text-xs font-medium text-primary">
                      <Icon name={glyphOf(routine.emoji)} />
                      {routine.name}
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 rounded-sm bg-muted px-2 py-0.5 text-xs font-medium text-foreground/60">
                      {t("common.rest", "Rest")}
                    </span>
                  )}
                  <Icon name="chevronRight" className="flex-none text-base text-foreground" />
                </button>
              );
            })}
          </div>
        </div>
        <div>
          <div className="mt-6 mb-2 flex min-h-8 items-center justify-between gap-3 px-1">
            <h2 className="m-0 font-sans text-sm leading-none font-medium tracking-tight text-foreground/60">
              {t("plan.routines", "Routines")}
            </h2>
            <Button size="xs" variant="secondary" onClick={addRoutine}>
              <Icon name="plus" />
              {t("common.new", "New")}
            </Button>
          </div>
          {state.routines.length > 0 ? (
            <Grid columns={{ default: 1, lg: 2 }} gap="xs">
              {state.routines.map((routine) => (
                <button
                  type="button"
                  key={routine.id}
                  className="flex min-h-15 w-full items-center gap-3 rounded-lg bg-card px-3 py-2 text-left transition-colors duration-140 active:bg-muted"
                  onClick={() => nav({ to: "/plan/r/$id", params: { id: routine.id } })}
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
                  <Icon name="chevronRight" className="flex-none text-base text-foreground" />
                </button>
              ))}
            </Grid>
          ) : (
            <>
              <div className="px-5 py-11 text-center text-base leading-normal text-foreground/60">
                <div className="mb-3 flex justify-center text-4xl text-foreground/60">
                  <Icon name="clipboard" />
                </div>
                {t("plan.noRoutinesYet", "No routines yet.")}
                <br />
                {t("plan.createOneLoadStarterPlan", "Create one or load the starter plan.")}
              </div>
              <Button className="w-full" onClick={() => setSheet({ kind: "curated" })}>
                <Icon name="sparkles" />
                {t("plans.curated.browse", "Browse curated plans")}
              </Button>
            </>
          )}
        </div>
      </div>
      <Sheet open={sheet !== null} onOpenChange={(open) => !open && setSheet(null)}>
        <SheetContent
          side="bottom"
          className="max-h-screen touch-pan-y overflow-y-auto overscroll-contain rounded-2xl bg-sheet p-2 px-4.5 pb-5 lg:inset-x-auto lg:left-1/2 lg:w-160 lg:-translate-x-1/2"
          showCloseButton={false}
        >
          <SheetTitle className="sr-only">
            {sheet?.kind === "tools"
              ? t("sharing.sharePlan", "Share your plan")
              : sheet?.kind === "import"
                ? sheet.bundle.name
                  ? t("sharing.import", "Import “{{plan}}”", { plan: sheet.bundle.name })
                  : t("sharing.importPlan", "Import this plan")
                : sheet?.kind === "assign"
                  ? weekdays[sheet.day]
                  : t("plans.curated.title", "Curated plans")}
          </SheetTitle>
          <div className="mx-auto mt-1.5 mb-3.5 h-1 w-9 rounded-full bg-foreground/20" />
          {sheet?.kind === "tools" && (
            <PlanTools
              close={closeSheet}
              openImport={(bundle) => setSheet({ kind: "import", bundle })}
            />
          )}
          {sheet?.kind === "import" && <PlanImport bundle={sheet.bundle} close={closeSheet} />}
          {sheet?.kind === "assign" && <DayAssign day={sheet.day} close={closeSheet} />}
          {sheet?.kind === "curated" && <CuratedPlans close={closeSheet} />}
        </SheetContent>
      </Sheet>
    </>
  );
}
