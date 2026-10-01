import type { ReactNode } from "react";
import { Sheet, SheetContent, SheetTitle } from "@/shared/ui/sheet";

export function RouteBottomSheet({
  open = true,
  onOpenChange,
  title,
  children,
}: {
  open?: boolean;
  onOpenChange: (open: boolean) => void;
  title: ReactNode;
  children: ReactNode;
}) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" showCloseButton={false} variant="panel">
        <SheetTitle className="sr-only">{title}</SheetTitle>
        <div className="mx-auto mt-1.5 mb-3.5 h-1 w-9 rounded-full bg-foreground/20" />
        {children}
      </SheetContent>
    </Sheet>
  );
}
