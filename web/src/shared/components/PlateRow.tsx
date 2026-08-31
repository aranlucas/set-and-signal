import { useTranslation } from "react-i18next";
import { useStore } from "@/app/store/useStore";
import { effectivePlateSetup, platesFor } from "@/domain/training/plates";
import { fmtNum, fmtPlate } from "@/shared/lib/format";
import Icon from "@/shared/components/Icon";

// One plate chip: mini bars sized like the discs they stand for, plus the plate value.
// Bar heights are genuinely runtime-derived (scaled to the heaviest plate shown), so an
// inline style is the honest tool here.
function PlateGroup({ w, count, max }: { w: number; count: number; max: number }) {
  const height = 12 + Math.round((w / max) * 12);
  return (
    <span className="inline-flex items-center gap-1 rounded-md bg-muted px-1.5 py-1">
      <span className="flex items-end gap-0.5">
        {Array.from({ length: Math.min(count, 5) }, (_, i) => (
          <i
            key={i}
            className="block w-1.5 rounded-full bg-primary"
            style={{ height: `${height}px` }}
          />
        ))}
      </span>
      <b className="text-xs leading-none font-medium tabular-nums">
        {fmtPlate(w)}
        {count > 1 ? "×" + count : ""}
      </b>
    </span>
  );
}

// The load-the-bar line under a weighted exercise: plates per side for the target
// weight, or the closest achievable total marked with ≈ when the gym's rack can't hit it.
export function PlateRow({ weight }: { weight: number }) {
  const { t } = useTranslation();
  const unit = useStore((state) => state.appState.unit);
  const savedSetup = useStore((state) => state.appState.plates);
  const setup = effectivePlateSetup(unit, savedSetup);
  if (!setup.on || weight < setup.bar) return null;
  const result = platesFor(weight, setup);
  const max = result ? Math.max(...result.perSide.map((plate) => plate.w)) : 0;
  return (
    <div className="mt-2.5 flex flex-wrap items-center gap-x-2 gap-y-1.5 rounded-md bg-muted px-2.5 py-2">
      <span className="inline-flex items-center gap-1 text-xs font-medium text-foreground">
        <Icon name="plate" className="text-sm" />
        {t("plateCalculator.totalWeight", "{{weight}} {{unit}} total", {
          weight: fmtNum(weight),
          unit,
        })}
      </span>
      <span className="text-xs text-muted-foreground">=</span>
      <span className="text-xs font-medium text-muted-foreground">
        {t("plateCalculator.barWeight", "{{weight}} {{unit}} bar", {
          weight: fmtNum(setup.bar),
          unit,
        })}
      </span>
      {result && result.perSide.length > 0 ? (
        <>
          <span className="text-xs text-muted-foreground">+</span>
          <span className="text-xs font-medium tracking-wider text-muted-foreground uppercase">
            {t("plateCalculator.perSide", "Per side")}
          </span>
          <span className="flex min-w-0 flex-wrap items-center gap-1">
            {result.perSide.map((group) => (
              <PlateGroup key={group.w} w={group.w} count={group.count} max={max} />
            ))}
          </span>
        </>
      ) : (
        <span className="text-xs font-medium text-muted-foreground">
          {t("plateCalculator.noPlates", "No plates")}
        </span>
      )}
      {result && !result.exact && (
        <span className="text-xs leading-snug font-medium text-warning">
          ≈ {fmtNum(result.achieved)} {unit}
        </span>
      )}
    </div>
  );
}

export default PlateRow;
