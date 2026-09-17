import { useTranslation } from "react-i18next";
import { useEffortLabels } from "@/shared/hooks/use-effort-labels";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/shared/ui/dialog";

// The whole point is that the two scales are one judgement counted from opposite ends, and a
// paragraph is a bad way to say that — the conversion table shows it in one look. Reading down
// a column is the answer to "what do I put here", so the numbers get their own aligned columns.
const EFFORT_ROWS = [
  ["0", "10"],
  ["1", "9"],
  ["2", "8"],
  ["3", "7"],
  ["4+", "≤6"],
] as const;
// RIR 2 / RPE 8: the row a working set usually lands on — the anchor the others are read
// against. Not where the stepper starts; + walks up from the bottom of the scale.
const EFFORT_TYPICAL = 2;
function EffortHelpContent() {
  const { t } = useTranslation();
  const effortLabels = useEffortLabels();
  return (
    <>
      <div className="my-3 mb-3 overflow-hidden rounded-xl bg-card">
        <div className="flex items-center gap-2 bg-muted px-3.5 py-2">
          <span className="w-9 flex-none text-center text-xs font-semibold tracking-wider text-muted-foreground uppercase">
            {t("effort.rir", "RIR")}
          </span>
          <span className="w-9 flex-none text-center text-xs font-semibold tracking-wider text-muted-foreground uppercase">
            {t("effort.rpe", "RPE")}
          </span>
          <span className="min-w-0 flex-1 text-xs font-semibold tracking-wider text-muted-foreground uppercase">
            {t("effort.howFelt", "How it felt")}
          </span>
        </div>
        {EFFORT_ROWS.map(([rir, rpe], i) => (
          <div
            key={rir}
            className={`relative flex items-center gap-2 px-3.5 py-2.5 ${i === EFFORT_TYPICAL ? "bg-primary/15" : ""}`}
          >
            <span
              className={`w-9 flex-none text-center text-lg font-semibold tracking-tight tabular-nums ${i === EFFORT_TYPICAL ? "text-primary" : ""}`}
            >
              {rir}
            </span>
            <span
              className={`w-9 flex-none text-center text-lg font-semibold tracking-tight tabular-nums ${i === EFFORT_TYPICAL ? "text-primary" : ""}`}
            >
              {rpe}
            </span>
            <span
              className={`min-w-0 flex-1 text-base leading-snug text-foreground/60 ${i === EFFORT_TYPICAL ? "text-foreground" : ""}`}
            >
              {effortLabels.feelings[i]}
            </span>
          </div>
        ))}
      </div>
      <div className="grid gap-2 text-sm leading-normal text-muted-foreground">
        <div>
          {t(
            "effort.rirCountsRepsLeftRpe",
            "RIR counts the reps you left; RPE reads the same effort off a 10-point scale — so RPE ≈ 10 − RIR. Pick the one you already think in.",
          )}
        </div>
        <div>
          {t(
            "effort.highlightedRowWhereMostWorking",
            "The highlighted row is where most working sets land. Sets you have already logged keep their own scale, and nothing else reads the value — progression and estimated 1RM are unaffected.",
          )}
        </div>
      </div>
      <div className="h-2" />
    </>
  );
}

export function EffortHelpDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { t } = useTranslation();
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-full max-w-xs rounded-xl bg-modal p-5 shadow-lg">
        <DialogHeader>
          <DialogTitle>{t("effort.effortPerSet", "Effort per set")}</DialogTitle>
          <DialogDescription>
            {t(
              "effort.howHardSetLoggedNext",
              "How hard a set was, logged next to weight and reps. Two scales for the same judgement, counted from opposite ends.",
            )}
          </DialogDescription>
        </DialogHeader>
        <EffortHelpContent />
      </DialogContent>
    </Dialog>
  );
}
