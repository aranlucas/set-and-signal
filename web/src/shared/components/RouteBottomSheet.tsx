import type { ReactNode } from "react";
import { Sheet, SheetContent, SheetTitle } from "@/shared/ui/sheet";

const BOTTOM_SHEET_CONTENT_CLASS =
  "max-h-screen touch-pan-y overflow-y-auto overscroll-contain rounded-2xl bg-sheet p-2 px-4.5 pb-5 lg:inset-x-auto lg:left-1/2 lg:w-160 lg:-translate-x-1/2";

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
      <SheetContent side="bottom" showCloseButton={false} className={BOTTOM_SHEET_CONTENT_CLASS}>
        <SheetTitle className="sr-only">{title}</SheetTitle>
        <div className="mx-auto mt-1.5 mb-3.5 h-1 w-9 rounded-full bg-foreground/20" />
        {children}
      </SheetContent>
    </Sheet>
  );
}
