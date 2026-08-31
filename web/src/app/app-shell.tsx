import { lazy, Suspense, useEffect, useState } from "react";
import { Outlet, useRouterState } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { useStore } from "@/app/store/useStore";
import { useWorkoutTimer } from "@/features/workout/useWorkoutTimer";
import { DEFAULT_ACCENT, isAccent } from "@/shared/lib/accents";
import { setLang } from "@/i18n/i18n";
import { useWakeLock } from "@/shared/lib/wakelock";
import TabBar from "@/shared/components/TabBar";
import ErrorBoundary from "@/shared/components/ErrorBoundary";
import Toast from "@/shared/components/Toast";
import RestTimer from "@/shared/components/RestTimer";
import Login from "@/features/auth/LoginPage";
import { cn } from "@/shared/lib/utils";
import BrandMark from "@/shared/components/BrandMark";

const loadStartWorkoutSheet = () => import("@/shared/components/StartWorkoutSheet");
const StartWorkoutSheet = lazy(loadStartWorkoutSheet);

function applyPrefs(theme: string, accent: string) {
  const de = document.documentElement;
  const isDark = theme === "dark";
  de.classList.toggle("dark", isDark);
  de.dataset.accent = isAccent(accent) ? accent : DEFAULT_ACCENT;
  const meta = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]');
  if (meta) meta.content = isDark ? "#171713" : "#f3ecdd";
}

export default function AppShell() {
  const pageRouteId = useRouterState({
    select: (state) => state.matches[1]?.routeId ?? state.location.pathname,
  });
  const theme = useStore((state) => state.appState.theme);
  const accent = useStore((state) => state.appState.accent);
  const language = useStore((state) => state.appState.lang);
  const activeWorkout = useStore((state) => state.appState.active);
  const keepAwake = useStore((state) => state.appState.keepAwake);
  const user = useStore((state) => state.user);
  const isGuest = useStore((state) => state.isGuest);
  const isReady = useStore((state) => state.isReady);
  const isTimerVisible = useWorkoutTimer((state) => Boolean(state.timer || state.work));
  const [startRoutineId, setStartRoutineId] = useState<string | null>(null);
  const { i18n } = useTranslation();
  const resolvedLanguage = i18n.resolvedLanguage;

  useEffect(() => {
    applyPrefs(theme, accent);
  }, [theme, accent]);
  useEffect(() => {
    void setLang(language || "en");
  }, [language]);
  useEffect(() => {
    document.documentElement.lang = resolvedLanguage || language || "en";
  }, [language, resolvedLanguage]);
  useWakeLock(!!activeWorkout && keepAwake !== false);

  const authed = user || isGuest;
  if (!isReady && !authed)
    return (
      <div id="app" className="proof-app mx-auto max-w-140 px-4 pt-2 pb-32 lg:max-w-270 lg:pt-8">
        <BrandMark className="mx-auto mt-64 size-12 text-primary" title="Set & Signal" />
      </div>
    );

  return (
    <>
      <main
        id="app"
        className={cn(
          "proof-app mx-auto max-w-140 px-4 pt-2 pb-32 lg:max-w-270 lg:pt-8",
          "animate-in duration-200 ease-out fade-in slide-in-from-bottom-1",
          isTimerVisible && "pb-64!",
        )}
        key={pageRouteId}
      >
        <ErrorBoundary>{authed ? <Outlet /> : <Login />}</ErrorBoundary>
      </main>
      <TabBar
        onStart={(routineId) => {
          setStartRoutineId(routineId);
        }}
        onStartIntent={() => void loadStartWorkoutSheet()}
      />
      <RestTimer />
      {startRoutineId !== null && (
        <Suspense fallback={null}>
          <StartWorkoutSheet
            open
            routineId={startRoutineId}
            onOpenChange={(open) => {
              if (!open) setStartRoutineId(null);
            }}
          />
        </Suspense>
      )}
      <Toast />
    </>
  );
}
