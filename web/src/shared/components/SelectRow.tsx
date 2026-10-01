import { useState, type ReactNode } from "react";
import Icon from "@/shared/components/Icon";
import type { IconName } from "@/shared/components/Icon";
import { Row } from "@/shared/components/layout";
import { Sheet, SheetContent, SheetTitle } from "@/shared/ui/sheet";
import { Button } from "@/shared/ui/button";

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
        <SheetContent side="bottom" variant="panel" showCloseButton={false}>
          <div className="mx-auto mt-1.5 mb-3.5 h-1 w-9 rounded-full bg-foreground/20" />
          <SheetTitle>{sheetTitle || title}</SheetTitle>
          <div className="overflow-hidden rounded-lg bg-card">
            {options.map((option) => (
              <Button
                variant="listItem"
                type="button"
                key={option.value}
                className="relative flex min-h-11.5 w-full items-center text-left"
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
              </Button>
            ))}
          </div>
          <div className="h-2" />
        </SheetContent>
      </Sheet>
    </>
  );
}

export default SelectRow;
