import type { CSSProperties } from "react";
import Icon from "@/shared/components/Icon";
import type { IconName } from "@/shared/components/Icon";
import { ToggleGroup, ToggleGroupItem } from "@/shared/ui/toggle-group";
import { cn } from "@/shared/lib/utils";

export interface SegOption<V extends string = string> {
  value: V;
  label?: string;
  icon?: IconName;
}

export function Segmented<V extends string>({
  options,
  value,
  onChange,
  className = "",
}: {
  options: readonly SegOption<V>[];
  value: V;
  onChange: (value: V) => void;
  className?: string;
}) {
  const selectedIndex = Math.max(
    0,
    options.findIndex((option) => option.value === value),
  );
  const indicatorStyle: CSSProperties = {
    width: `calc((100% - 4px) / ${options.length})`,
    transform: `translateX(calc(100% * ${selectedIndex}))`,
  };
  return (
    <ToggleGroup
      className={cn("relative isolate flex rounded-md bg-input p-0.5", className)}
      spacing={0}
      value={[value]}
      onValueChange={(selectedValues) => {
        const selectedOption = options.find((option) => option.value === selectedValues[0]);
        if (selectedOption) onChange(selectedOption.value);
      }}
    >
      <span
        className="absolute inset-y-0.5 left-0.5 z-0 rounded-sm bg-card shadow transition-transform duration-200 ease-out"
        style={indicatorStyle}
        aria-hidden="true"
      />
      {options.map((option) => (
        <ToggleGroupItem
          key={option.value}
          value={option.value}
          className={cn(
            "relative z-1 flex min-h-7.5 min-w-0 flex-1 items-center justify-center gap-1.5 px-2 py-1.5 text-sm tracking-tight transition-opacity duration-150 active:opacity-50 [&_[data-icon]]:text-base",
            option.value === value
              ? "font-medium text-foreground"
              : "font-normal text-foreground/60",
          )}
        >
          {option.icon && <Icon name={option.icon} />}
          {option.label && <span>{option.label}</span>}
        </ToggleGroupItem>
      ))}
    </ToggleGroup>
  );
}

export default Segmented;
