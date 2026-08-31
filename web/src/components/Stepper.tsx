import Icon from "./Icon";
import { NumberField } from "./NumField";
import { cn } from "../lib/utils";

export function Stepper({
  value,
  step = 1,
  onChange,
  decimal = true,
  className = "",
  label,
  unit,
}: {
  value: number | null | undefined;
  step?: number;
  onChange: (n: number | null) => void;
  decimal?: boolean;
  className?: string;
  label?: string;
  unit?: string;
}) {
  const set = (v: number | null) => onChange(Math.max(0, Math.round((v || 0) * 100) / 100));
  const cur = +(value ?? 0) || 0;
  const inner = (
    <div className={cn("flex min-w-0 items-center overflow-hidden rounded-md bg-muted", className)}>
      <button
        type="button"
        className="flex size-11 shrink-0 items-center justify-center text-base text-foreground transition-colors duration-150 active:bg-input"
        onClick={() => set(cur - step)}
        aria-label={label ? `Decrease ${label}` : "Decrease"}
      >
        <Icon name="minus" />
      </button>
      <span className="flex min-w-0 flex-1 items-baseline justify-center gap-1 px-0.5">
        <NumberField aria-label={label} value={value} decimal={decimal} onChange={onChange} />
        {unit && <i className="flex-none text-xs text-foreground/60 not-italic">{unit}</i>}
      </span>
      <button
        type="button"
        className="flex size-11 shrink-0 items-center justify-center text-base text-foreground transition-colors duration-150 active:bg-input"
        onClick={() => set(cur + step)}
        aria-label={label ? `Increase ${label}` : "Increase"}
      >
        <Icon name="plus" />
      </button>
    </div>
  );
  if (!label) return inner;
  return (
    <div className="flex min-w-0 flex-col gap-1.5">
      <span className="text-center text-sm text-foreground/60">{label}</span>
      {inner}
    </div>
  );
}

export default Stepper;
