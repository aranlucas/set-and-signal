import { useNavigate } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { Sheet, SheetContent, SheetTitle } from "@/shared/ui/sheet";
import { MeasuresSheet } from "@/features/account/MeasuresSheet";

export default function HomeMeasuresSheet() {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const close = () => navigate({ to: "/home", replace: true, resetScroll: false });

  return (
    <Sheet
      open
      onOpenChange={(open) => {
        if (!open) void close();
      }}
    >
      <SheetContent side="bottom" variant="panel" showCloseButton={false}>
        <SheetTitle className="sr-only">{t("measurements.log", "Log measurements")}</SheetTitle>
        <div className="mx-auto mt-1.5 mb-3.5 h-1 w-9 rounded-full bg-foreground/20" />
        <MeasuresSheet close={close} />
      </SheetContent>
    </Sheet>
  );
}
