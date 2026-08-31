import {
  createHashHistory,
  createRootRoute,
  createRoute,
  createRouter,
  lazyRouteComponent,
} from "@tanstack/react-router";
import AppShell from "./app-shell";
import { AdminGate, HomeRedirect, NotFoundView } from "./router-components";

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
const Home = lazyRouteComponent(() => import("./views/Home"));
const Plan = lazyRouteComponent(() => import("./views/Plan"));
const RoutineEdit = lazyRouteComponent(() => import("./views/RoutineEdit"));
const Workout = lazyRouteComponent(() => import("./views/Workout"));
const Stats = lazyRouteComponent(() => import("./views/Stats"));
const History = lazyRouteComponent(() => import("./views/History"));
const Library = lazyRouteComponent(() => import("./views/Library"));
const Settings = lazyRouteComponent(() => import("./views/Settings"));
const HomeCalendarSheet = lazyRouteComponent(() => import("./views/home/HomeCalendarSheet"));
const HomeCalendarDaySheet = lazyRouteComponent(() => import("./views/home/HomeCalendarDaySheet"));
const HomeDaySheet = lazyRouteComponent(() => import("./views/home/HomeDaySheet"));
const HomeWorkoutDetailSheet = lazyRouteComponent(
  () => import("./views/home/HomeWorkoutDetailSheet"),
);
const HomeCuratedSheet = lazyRouteComponent(() => import("./views/home/HomeCuratedSheet"));
const HomeStrengthSetupSheet = lazyRouteComponent(
  () => import("./views/home/HomeStrengthSetupSheet"),
);
const HomeAiSheet = lazyRouteComponent(() => import("./views/home/HomeAiSheet"));
const HomeBodyweightSheet = lazyRouteComponent(() => import("./views/home/HomeBodyweightSheet"));
const HomePreWorkoutBodyweightSheet = lazyRouteComponent(
  () => import("./views/home/HomePreWorkoutBodyweightSheet"),
);
const HomeGoalSheet = lazyRouteComponent(() => import("./views/home/HomeGoalSheet"));
const HomeMeasuresSheet = lazyRouteComponent(() => import("./views/home/HomeMeasuresSheet"));

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
