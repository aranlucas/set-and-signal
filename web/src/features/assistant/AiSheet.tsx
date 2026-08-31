import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useQuery } from "@tanstack/react-query";
import { EXIDX } from "@/domain/exercises/exercises";
import { fmtNum, todayISO } from "@/shared/lib/format";
import { effectiveRoutine } from "@/domain/training/history";
import { buildDigest } from "@/features/assistant/ai";
import { apiParsed } from "@/shared/lib/api";
import { toast } from "@/shared/lib/toast";
import {
  aiPlanResponse,
  aiStatusResponse,
  type AiPlanEntry,
  type AiPlanResult,
} from "@/shared/lib/schemas";
import { Button } from "@/shared/ui/button";
import Icon from "@/shared/components/Icon";
import { SpaceBetween } from "@/shared/components/SpaceBetween";
import { DEFAULT_GLYPH, glyphOf } from "@/domain/exercises/glyphs";
import type { ExConfig, Id, SheetClose } from "@/shared/lib/types";
import { getAppState, getErrorMessage, updateAppState } from "@/features/exercises/sheet-shared";

const nameOf = (id: Id) => EXIDX[id]?.n || getAppState().customEx.find((x) => x.id === id)?.n || id;

const targetStr = (cur: ExConfig | undefined, g: AiPlanEntry): string => {
  const parts: string[] = [];
  const sets = g.sets ?? cur?.sets;
  if (g.sec !== undefined || cur?.sec !== undefined || cur?.mode === "time") {
    if (sets) parts.push(sets + "×");
    parts.push((g.sec ?? cur?.sec ?? 45) + "s");
  } else if (g.min !== undefined || g.speed !== undefined || cur?.min !== undefined)
    parts.push((g.min ?? cur?.min ?? 20) + " min @ " + (g.speed ?? cur?.speed ?? "—"));
  else if (g.reps !== undefined || !cur?.bodyweight) {
    parts.push((sets ? sets + "×" : "") + (g.reps ?? cur?.reps ?? 10));
    const w = g.weight ?? cur?.weight;
    if (!cur?.bodyweight && w) parts.push("@ " + fmtNum(w) + " " + getAppState().unit);
  } else if (sets) parts.push(sets + "×" + (g.reps ?? cur?.reps ?? 10));
  return parts.join(" ");
};

export function AiPlan({ close }: { close: SheetClose }) {
  const { t } = useTranslation();
  const [applied, setApplied] = useState(false);
  const planQuery = useQuery({
    queryKey: ["ai", "next-workout", todayISO()],
    retry: false,
    queryFn: async (): Promise<AiPlanResult> => {
      const status = await apiParsed("/api/ai/status", aiStatusResponse);
      if (!status.enabled)
        throw new Error(
          t("ai.missingKeyError", "This instance has no AI key configured (OPENROUTER_API_KEY)."),
        );
      const routine = effectiveRoutine(getAppState(), todayISO());
      if (!routine)
        throw new Error(
          t("ai.noRoutineError", "Nothing scheduled today — assign a routine to this day first."),
        );
      return apiParsed("/api/ai/next-workout", aiPlanResponse, {
        method: "POST",
        body: JSON.stringify({ digest: buildDigest(getAppState(), routine) }),
      });
    },
  });
  const res = planQuery.data;

  const apply = () => {
    if (!res) return;
    updateAppState((appState) => {
      const routine = effectiveRoutine(appState, todayISO());
      if (!routine) return;
      const byId = new Map(routine.ex.map((exercise) => [exercise.id, exercise]));
      for (const g of res.suggestion.entries) {
        const exerciseConfig = byId.get(g.id);
        if (!exerciseConfig) continue;
        if (g.swapTo && EXIDX[g.swapTo]) {
          exerciseConfig.id = g.swapTo;
          for (const key of ["weight", "sec", "min", "speed"] as const) delete exerciseConfig[key];
        }
        if (g.sets !== undefined) exerciseConfig.sets = g.sets;
        if (g.reps !== undefined) exerciseConfig.reps = g.reps;
        if (g.weight !== undefined) exerciseConfig.weight = g.weight;
        if (g.sec !== undefined) exerciseConfig.sec = g.sec;
        if (g.min !== undefined) exerciseConfig.min = g.min;
        if (g.speed !== undefined) exerciseConfig.speed = g.speed;
        if (exerciseConfig.weight)
          appState.exWeights[exerciseConfig.id] = {
            w: exerciseConfig.weight,
            d: todayISO(),
          };
      }
    });
    setApplied(true);
    toast(t("ai.adjustmentsApplied", "AI adjustments applied to today's routine"));
    void close();
  };
  return (
    <>
      <h3>{t("ai.workoutPlanTitle", "AI workout plan")}</h3>
      {planQuery.isPending && (
        <div className="text-sm leading-snug text-foreground/60">
          {t("ai.loading", "Reading your recent workouts and thinking…")}
        </div>
      )}
      {planQuery.isError && (
        <>
          <div className="mb-3.5 text-sm leading-snug text-foreground/60">
            {getErrorMessage(planQuery.error)}
          </div>
          <Button variant="ghost" className="w-full text-muted-foreground" onClick={close}>
            {t("common.close", "Close")}
          </Button>
        </>
      )}
      {planQuery.isSuccess && res && (
        <SpaceBetween size="s">
          <SpaceBetween size="xxs">
            <div className="text-sm leading-snug text-muted-foreground">
              <Icon name="bolt" className="text-xs" />{" "}
              {t("ai.plannedBy", "planned by {{source}}", { source: res.model })}
            </div>
            <div className="text-sm leading-normal">{res.suggestion.summary}</div>
          </SpaceBetween>
          <SpaceBetween size="xs">
            {res.suggestion.entries.map((g) => {
              const cur = effectiveRoutine(getAppState(), todayISO())?.ex.find(
                (x) => x.id === g.id,
              );
              const swapped = g.swapTo == null ? undefined : EXIDX[g.swapTo];
              return (
                <div
                  key={g.id}
                  className="flex min-h-15 w-full cursor-default items-center gap-3 rounded-lg bg-card px-3 py-2.5 text-left"
                >
                  <span className="flex size-7 shrink-0 items-center justify-center rounded-sm bg-primary text-lg text-white">
                    <Icon name={glyphOf(DEFAULT_GLYPH)} />
                  </span>
                  <div className="min-w-0 grow">
                    <div className="text-base leading-tight tracking-tight">
                      {swapped
                        ? t("ai.exerciseSwap", "{{from}} → {{to}}", {
                            from: nameOf(g.id),
                            to: swapped.n,
                          })
                        : nameOf(g.id)}
                    </div>
                    <div className="mt-0.5 text-sm text-foreground/60">{targetStr(cur, g)}</div>
                    {g.note && (
                      <div className="mt-0.5 text-sm leading-snug text-muted-foreground">
                        {g.note}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </SpaceBetween>
          <SpaceBetween size="xs">
            {!applied && (
              <Button className="w-full" variant="default" onClick={apply}>
                <Icon name="check" />
                {t("ai.applyToRoutine", "Apply to today's routine")}
              </Button>
            )}
            <Button variant="ghost" className="w-full text-muted-foreground" onClick={close}>
              {applied ? t("common.close", "Close") : t("common.dismiss", "Dismiss")}
            </Button>
          </SpaceBetween>
        </SpaceBetween>
      )}
    </>
  );
}
