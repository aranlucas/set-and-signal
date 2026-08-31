import { useState, type ReactNode } from "react";
import Icon from "./Icon";
import type { IconName } from "./Icon";
import { Row } from "./layout";
import { Sheet, SheetContent, SheetTitle } from "./ui/sheet";

export interface PickOption<V extends string = string> {
  value: V;
  label: string;
  subtitle?: string;
}

export function SelectRow<V extends string>({
  icon,
  iconTint,
  title,
  value,
  options,
  onChange,
  sheetTitle,
}: {
  icon?: IconName;
  iconTint?: string;
  title: ReactNode;
  value: V;
  options: readonly PickOption<V>[];
  onChange: (value: V) => void;
  sheetTitle?: ReactNode;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const current = options.find((option) => option.value === value);

  return (
    <>
      <Row
        icon={icon}
        iconTint={iconTint}
        title={title}
        value={current ? current.label : value}
        accessory="chevron"
        onClick={() => setIsOpen(true)}
      />
      <Sheet open={isOpen} onOpenChange={setIsOpen}>
        <SheetContent
          side="bottom"
          className="max-h-screen touch-pan-y overflow-y-auto overscroll-contain rounded-2xl bg-sheet p-2 px-4.5 pb-5 lg:inset-x-auto lg:left-1/2 lg:w-160 lg:-translate-x-1/2"
          showCloseButton={false}
        >
          <div className="mx-auto mt-1.5 mb-3.5 h-1 w-9 rounded-full bg-foreground/20" />
          <SheetTitle>{sheetTitle || title}</SheetTitle>
          <div className="overflow-hidden rounded-lg bg-card">
            {options.map((option, optionIndex) => (
              <button
                type="button"
                key={option.value}
                className={`relative flex min-h-11.5 w-full items-center gap-3 bg-transparent px-3.5 py-3 text-left text-foreground active:bg-muted ${optionIndex === 0 ? "" : "before:absolute before:top-0 before:right-0 before:left-3.5 before:h-px before:bg-border/60"}`}
                onClick={() => {
                  setIsOpen(false);
                  onChange(option.value);
                }}
              >
                <span className="flex min-w-0 flex-1 flex-col gap-px">
                  <span className="text-lg leading-tight tracking-tight">{option.label}</span>
                  {option.subtitle && (
                    <span className="text-sm leading-snug text-foreground/60">
                      {option.subtitle}
                    </span>
                  )}
                </span>
                {option.value === value && (
                  <Icon name="check" className="flex-none text-lg text-primary" />
                )}
              </button>
            ))}
          </div>
          <div className="h-2" />
        </SheetContent>
      </Sheet>
    </>
  );
}

export default SelectRow;
