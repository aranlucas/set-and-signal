import { useTranslation } from "react-i18next";
import { Link, useLocation, useNavigate } from "@tanstack/react-router";
import { useStore } from "@/app/store/useStore";
import { effectiveRoutine } from "@/domain/training/schedule";
import { todayISO } from "@/shared/lib/format";
import Icon from "@/shared/components/Icon";
import type { IconName } from "@/shared/components/Icon";
import { cn } from "@/shared/lib/utils";
import { Tabs, TabsList, TabsTrigger } from "@/shared/ui/tabs";

type TabValue = "home" | "plan" | "workout" | "stats" | "library";
type NavigationTabValue = Exclude<TabValue, "workout">;
type TabDestination = `/${NavigationTabValue}`;

const SECTION_TABS: Readonly<Record<string, TabValue>> = {
  home: "home",
  settings: "home",
  plan: "plan",
  workout: "workout",
  stats: "stats",
  history: "stats",
  library: "library",
};

function NavigationTab({
  value,
  icon,
  to,
  label,
}: {
  value: NavigationTabValue;
  icon: IconName;
  to: TabDestination;
  label: string;
}) {
  return (
    <TabsTrigger
      value={value}
      nativeButton={false}
      render={<Link to={to} activeOptions={{ exact: true }} />}
      className="h-auto min-h-12 flex-col justify-end gap-1 px-1 py-0.5 leading-none"
    >
      <Icon name={icon} />
      <span>{label}</span>
    </TabsTrigger>
  );
}

export default function TabBar({
  onStart,
  onStartIntent,
}: {
  onStart: (routineId: string) => void;
  onStartIntent?: () => void;
}) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const loc = useLocation();
  const appState = useStore((state) => state.appState);
  const user = useStore((state) => state.user);
  const isGuest = useStore((state) => state.isGuest);
  if (!user && !isGuest) return null;
  const currentSection = loc.pathname.split("/")[1] || "home";
  const activeTab = SECTION_TABS[currentSection] ?? null;

  const startWorkout = () => {
    if (!appState.active) {
      const routine = effectiveRoutine(appState, todayISO());
      if (routine && routine.ex.length > 0) {
        onStart(routine.id);
        return;
      }
    }
    void navigate({ to: "/workout" });
  };
  return (
    <nav
      id="tabbar"
      aria-label="Main navigation"
      className="proof-tabbar fixed inset-x-0 bottom-0 z-50 border-t border-border/40 bg-background/80 px-1.5 py-2.5 backdrop-blur-xl backdrop-saturate-180 lg:inset-x-auto lg:bottom-4 lg:left-1/2 lg:w-130 lg:-translate-x-1/2 lg:rounded-2xl lg:border lg:px-2.5 lg:shadow-xl"
    >
      <Tabs value={activeTab} className="w-full gap-0">
        <TabsList
          variant="line"
          className="grid w-full grid-cols-5 items-end gap-0 p-0 group-data-horizontal/tabs:h-auto"
        >
          <NavigationTab
            value="home"
            icon="house"
            to="/home"
            label={t("navigation.home", "Home")}
          />
          <NavigationTab
            value="plan"
            icon="calendar"
            to="/plan"
            label={t("navigation.plan", "Plan")}
          />
          <TabsTrigger
            value="workout"
            className={cn(
              "-mt-6 h-auto min-h-12 flex-col justify-end gap-1 px-1 py-0.5 leading-none text-primary after:hidden data-active:bg-transparent dark:data-active:bg-transparent",
              appState.active && "text-active",
            )}
            onClick={startWorkout}
            onPointerEnter={onStartIntent}
            onFocus={onStartIntent}
          >
            <span
              className={cn(
                "proof-start relative flex size-13 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg transition-transform duration-150 ease-out active:scale-95",
                appState.active &&
                  "bg-orange-500 text-black shadow-lg after:absolute after:inset-0 after:animate-attention-ping after:rounded-full after:border-2 after:border-orange-500",
              )}
            >
              <Icon name={appState.active ? "play" : "plus"} />
            </span>
            <span>
              {appState.active ? t("common.resume", "Resume") : t("common.start", "Start")}
            </span>
          </TabsTrigger>
          <NavigationTab
            value="stats"
            icon="chart"
            to="/stats"
            label={t("navigation.stats", "Stats")}
          />
          <NavigationTab
            value="library"
            icon="list"
            to="/library"
            label={t("navigation.exercises", "Exercises")}
          />
        </TabsList>
      </Tabs>
    </nav>
  );
}
