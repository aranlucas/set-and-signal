import { useNavigate } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { Sheet, SheetContent, SheetTitle } from "../../components/ui/sheet";
import { AiPlan } from "../../sheets/ai";

export default function HomeAiSheet() {
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
      <SheetContent
        side="bottom"
        className="max-h-screen touch-pan-y overflow-y-auto overscroll-contain rounded-2xl bg-sheet p-2 px-4.5 pb-5 lg:inset-x-auto lg:left-1/2 lg:w-160 lg:-translate-x-1/2"
        showCloseButton={false}
      >
        <SheetTitle className="sr-only">{t("ai.workoutPlanTitle", "AI workout plan")}</SheetTitle>
        <div className="mx-auto mt-1.5 mb-3.5 h-1 w-9 rounded-full bg-foreground/20" />
        <AiPlan close={close} />
      </SheetContent>
    </Sheet>
  );
}
