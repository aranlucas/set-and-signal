import { useTranslation } from "react-i18next";
import { Check, Play } from "lucide-react";
import type { PlannedSession } from "@/domain/training/schedule";
import type { Id } from "@/shared/lib/types";
import { exCount } from "@/shared/lib/format";
import { Button } from "@/shared/ui/button";

export function PlannedSessions({
  sessions,
  onStart,
  disabled = false,
}: {
  sessions: readonly PlannedSession[];
  onStart: (routineId: Id) => void;
  disabled?: boolean;
}) {
  const { t } = useTranslation();
  return (
    <div className="flex flex-col gap-3">
      {sessions.map((session) => (
        <div
          key={session.key}
          className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-card p-4"
        >
          <div className="min-w-0 flex-1">
            <h3 className="m-0 text-lg font-semibold">{session.routine.name}</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              {[session.start, session.label, exCount(t, session.routine.ex.length)]
                .filter(Boolean)
                .join(" · ")}
            </p>
          </div>
          {session.completed ? (
            <span className="inline-flex items-center gap-1 text-sm text-primary">
              <Check size={16} />
              {t("calendar.status.completed", "Done")}
            </span>
          ) : (
            <Button
              disabled={disabled}
              onClick={() => onStart(session.routineId)}
              aria-label={t("common.startNamed", "Start {{routine}}", {
                routine: session.routine.name,
              })}
            >
              <Play size={16} />
              {t("common.start", "Start")}
            </Button>
          )}
        </div>
      ))}
    </div>
  );
}
