import {
  createHashHistory,
  createRootRoute,
  createRoute,
  createRouter,
  lazyRouteComponent,
} from "@tanstack/react-router";
import AppShell from "@/app/app-shell";
import { AdminGate, HomeRedirect, NotFoundView } from "@/app/router-components";

const rootRoute = createRootRoute({
  component: AppShell,
  notFoundComponent: NotFoundView,
});

const indexRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/",
  component: HomeRedirect,
});

// Route-only views stay out of the initial bundle and are fetched on demand as
// TanStack Router preloads them on intent. Keep these importers next to the
// route definitions so the route graph remains easy to scan.
const Home = lazyRouteComponent(() => import("@/features/home/HomePage"));
const Plan = lazyRouteComponent(() => import("@/features/plan/PlanPage"));
const RoutineEdit = lazyRouteComponent(() => import("@/features/plan/RoutineEditPage"));
const Workout = lazyRouteComponent(() => import("@/features/workout/WorkoutPage"));
const Stats = lazyRouteComponent(() => import("@/features/stats/StatsPage"));
const History = lazyRouteComponent(() => import("@/features/history/HistoryPage"));
const Library = lazyRouteComponent(() => import("@/features/library/LibraryPage"));
const Settings = lazyRouteComponent(() => import("@/features/settings/SettingsPage"));
const HomeCalendarSheet = lazyRouteComponent(
  () => import("@/features/home/routes/HomeCalendarSheet"),
);
const HomeCalendarDaySheet = lazyRouteComponent(
  () => import("@/features/home/routes/HomeCalendarDaySheet"),
);
const HomeDaySheet = lazyRouteComponent(() => import("@/features/home/routes/HomeDaySheet"));
const HomeWorkoutDetailSheet = lazyRouteComponent(
  () => import("@/features/home/routes/HomeWorkoutDetailSheet"),
);
const HomeCuratedSheet = lazyRouteComponent(
  () => import("@/features/home/routes/HomeCuratedSheet"),
);
const HomeStrengthSetupSheet = lazyRouteComponent(
  () => import("@/features/home/routes/HomeStrengthSetupSheet"),
);
const HomeAiSheet = lazyRouteComponent(() => import("@/features/home/routes/HomeAiSheet"));
const HomeBodyweightSheet = lazyRouteComponent(
  () => import("@/features/home/routes/HomeBodyweightSheet"),
);
const HomePreWorkoutBodyweightSheet = lazyRouteComponent(
  () => import("@/features/home/routes/HomePreWorkoutBodyweightSheet"),
);
const HomeGoalSheet = lazyRouteComponent(() => import("@/features/home/routes/HomeGoalSheet"));
const HomeMeasuresSheet = lazyRouteComponent(
  () => import("@/features/home/routes/HomeMeasuresSheet"),
);

const homeRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/home",
  component: Home,
});
const planRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/plan",
  component: Plan,
});
const routineEditRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/plan/r/$id",
  component: RoutineEdit,
});
const workoutRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/workout",
  component: Workout,
});
const statsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/stats",
  component: Stats,
});
const historyRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/history",
  component: History,
});
const libraryRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/library",
  component: Library,
});
const settingsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/settings",
  component: Settings,
});

const homeCalendarRoute = createRoute({
  getParentRoute: () => homeRoute,
  path: "calendar",
  component: HomeCalendarSheet,
});
const homeCalendarDayRoute = createRoute({
  getParentRoute: () => homeRoute,
  path: "calendar/$date",
  component: HomeCalendarDaySheet,
});
const homeDayRoute = createRoute({
  getParentRoute: () => homeRoute,
  path: "day/$date",
  component: HomeDaySheet,
});
const homeWorkoutDetailRoute = createRoute({
  getParentRoute: () => homeRoute,
  path: "workout/$workoutId",
  component: HomeWorkoutDetailSheet,
});
const homeCuratedRoute = createRoute({
  getParentRoute: () => homeRoute,
  path: "curated",
  component: HomeCuratedSheet,
});
const homeStrengthSetupRoute = createRoute({
  getParentRoute: () => homeRoute,
  path: "get-started",
  component: HomeStrengthSetupSheet,
});
const homeAiRoute = createRoute({
  getParentRoute: () => homeRoute,
  path: "ai",
  component: HomeAiSheet,
});
const homeBodyweightRoute = createRoute({
  getParentRoute: () => homeRoute,
  path: "bodyweight",
  component: HomeBodyweightSheet,
});
const homePreWorkoutBodyweightRoute = createRoute({
  getParentRoute: () => homeRoute,
  path: "pre-workout/$routineId",
  component: HomePreWorkoutBodyweightSheet,
});
const homeGoalRoute = createRoute({
  getParentRoute: () => homeRoute,
  path: "goal",
  component: HomeGoalSheet,
});
const homeMeasuresRoute = createRoute({
  getParentRoute: () => homeRoute,
  path: "measures",
  component: HomeMeasuresSheet,
});

const adminRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/admin",
  component: AdminGate,
});

const routeTree = rootRoute.addChildren([
  indexRoute,
  homeRoute.addChildren([
    homeCalendarRoute,
    homeCalendarDayRoute,
    homeDayRoute,
    homeWorkoutDetailRoute,
    homeCuratedRoute,
    homeStrengthSetupRoute,
    homeAiRoute,
    homeBodyweightRoute,
    homePreWorkoutBodyweightRoute,
    homeGoalRoute,
    homeMeasuresRoute,
  ]),
  planRoute,
  routineEditRoute,
  workoutRoute,
  statsRoute,
  historyRoute,
  libraryRoute,
  settingsRoute,
  adminRoute,
]);

export const router = createRouter({
  routeTree,
  history: createHashHistory(),
  defaultPreload: "intent",
  scrollRestoration: true,
});

declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}
