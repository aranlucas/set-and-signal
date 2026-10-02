import { useTranslation } from "react-i18next";
import { exOr } from "@/domain/exercises/exercises";
import { exLine } from "@/domain/training/history";
import { estimateSessionMinutes } from "@/domain/training/session-planner";
import { useSessionPlannerLabels } from "./use-session-planner-labels";
import type { SessionPlan, Unit } from "@/shared/lib/types";

export function SessionPlanSummary({ plan, unit }: { plan: SessionPlan; unit: Unit }) {
  const { t } = useTranslation();
  const labels = useSessionPlannerLabels();
  const occurrences = new Map<string, number>();
  return (
    <details className="my-3 rounded-lg bg-card p-4">
      <summary className="cursor-pointer text-sm font-medium">
        {t("sessionPlan.snapshot", "Adapted from {{name}} · {{minutes}} min budget", {
          name: plan.sourceName,
          minutes: plan.budgetMin,
        })}
      </summary>
      <p className="mt-2 text-sm text-muted-foreground">
        {t(
          "sessionPlan.snapshotHelp",
          "Accepted planning snapshot. Later edits and actual logged sets are recorded separately. The original routine was preserved.",
        )}
      </p>
      <p className="mt-2 text-sm text-muted-foreground">
        {t(
          "sessionPlan.snapshotConstraints",
          "Equipment: {{equipment}} · {{rest}} sec rest · approximately {{estimate}} min at save",
          {
            equipment:
              plan.equipment.map(labels.equipment).join(", ") ||
              t("sessionPlan.floor", "no equipment"),
            rest: plan.restSec,
            estimate: estimateSessionMinutes(
              plan.rows.flatMap((row) => (row.planned ? [row.planned] : [])),
              plan.restSec,
            ),
          },
        )}
      </p>
      <ul className="mt-3 space-y-3 text-sm">
        {plan.rows.map((row) => {
          const occurrence = (occurrences.get(row.original.id) ?? 0) + 1;
          occurrences.set(row.original.id, occurrence);
          return (
            <li key={`${row.original.id}:${occurrence}`}>
              <div>
                {exOr(row.original.id).n} · {exLine(row.original, unit)}
              </div>
              <div className="text-muted-foreground">
                {row.planned
                  ? `${exOr(row.planned.id).n} · ${exLine(row.planned, unit)}`
                  : t("sessionPlan.omitted", "Omitted from this copy")}
              </div>
              {row.planned && row.planned.id !== row.original.id && (
                <p className="text-muted-foreground">
                  {t(
                    "sessionPlan.snapshotSwap",
                    "Alternative chosen for the selected equipment; load and speed reset. Review your targets.",
                  )}
                </p>
              )}
            </li>
          );
        })}
      </ul>
    </details>
  );
}
