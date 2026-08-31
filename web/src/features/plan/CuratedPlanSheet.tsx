import { useTranslation } from "react-i18next";
import { useExerciseMetadataLabels } from "@/shared/hooks/use-exercise-metadata-labels";
import { CURATED, curatedRoutines } from "@/features/plan/curated";
import { glyphOf } from "@/domain/exercises/glyphs";
import { toast } from "@/shared/lib/toast";
import { Button } from "@/shared/ui/button";
import Icon from "@/shared/components/Icon";
import { SpaceBetween } from "@/shared/components/SpaceBetween";
import { updateAppState } from "@/features/exercises/sheet-shared";
import { weekdayFromNumber } from "@/shared/lib/format";
import type { SheetClose } from "@/shared/lib/types";

export function CuratedPlans({ close }: { close: SheetClose }) {
  const { t } = useTranslation();
  const metadata = useExerciseMetadataLabels();
  const load = (p: (typeof CURATED)[number]) => {
    const rs = curatedRoutines(p);
    updateAppState((appState) => {
      rs.forEach((routine) => appState.routines.push(routine));
      for (const [day, routineIndex] of Object.entries(p.week)) {
        const weekday = weekdayFromNumber(Number(day));
        const routine = rs[routineIndex];
        if (weekday != null && routine) appState.week[weekday] = routine.id;
      }
    });
    void close();
    toast(
      t("plans.curated.addedToast", "{{plan}} added — week set to Mon · Wed · Fri", {
        plan: p.name,
      }),
    );
  };
  return (
    <>
      <h3>{t("plans.curated.title", "Curated plans")}</h3>
      <div className="mb-3.5 text-sm leading-snug text-foreground/60">
        {t(
          "plans.curated.description",
          "Ready-made routines for a specific gym setup — added as new routines and scheduled Mon · Wed · Fri.",
        )}
      </div>
      <SpaceBetween size="s">
        <SpaceBetween size="xs">
          {CURATED.map((p) => {
            const n = p.routines.reduce((a, r) => a + r[2].length, 0);
            return (
              <button
                type="button"
                key={p.key}
                className="flex min-h-15 w-full items-center gap-3 rounded-lg bg-card px-3 py-2.5 text-left transition-colors active:bg-muted"
                onClick={() => load(p)}
              >
                <span className="flex size-7 shrink-0 items-center justify-center rounded-sm bg-primary text-lg text-white">
                  <Icon name={glyphOf(p.emoji)} />
                </span>
                <div className="min-w-0 grow">
                  <div className="text-base leading-tight tracking-tight">{p.name}</div>
                  {p.key === "linear-5x5" && (
                    <div className="mt-0.5 text-sm leading-snug text-foreground/60">
                      {t(
                        "plans.curated.linear5x5Description",
                        "Simple barbell training with automatic load progression.",
                      )}
                    </div>
                  )}
                  <div className="mt-0.5 text-sm text-foreground/60">
                    {t(
                      "plans.curated.summary",
                      "{{routineCount}} routines · {{exerciseCount}} exercises",
                      { routineCount: p.routines.length, exerciseCount: n },
                    )}
                  </div>
                  <div className="mt-1 flex scrollbar-none gap-2 overflow-x-auto pb-0.5">
                    {p.eq.map((e) => (
                      <span
                        key={e}
                        className="pointer-events-none shrink-0 rounded-full bg-card px-3 py-1.5 text-sm tracking-tight text-foreground"
                      >
                        {metadata.equipment(e)}
                      </span>
                    ))}
                  </div>
                </div>
                <Icon name="chevronRight" className="shrink-0 text-base text-foreground" />
              </button>
            );
          })}
        </SpaceBetween>
        <Button variant="ghost" className="w-full text-muted-foreground" onClick={close}>
          {t("common.cancel", "Cancel")}
        </Button>
      </SpaceBetween>
    </>
  );
}
