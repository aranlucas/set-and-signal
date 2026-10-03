import { renderWithTranslations as renderToStaticMarkup } from "@/test/render-with-i18n";
import { afterEach, expect, it, vi } from "vitest";

vi.hoisted(() => {
  const values = new Map<string, string>();
  vi.stubGlobal("localStorage", {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => {
      values.set(key, value);
    },
    removeItem: (key: string) => {
      values.delete(key);
    },
  });
});

import { DEFAULT_APP_STATE } from "@/domain/training/default-state";
import { todayISO } from "@/shared/lib/format";
import type { AppState } from "@/shared/lib/types";
import {
  createMemoryHistory,
  createRootRoute,
  createRouter,
  RouterContextProvider,
} from "@tanstack/react-router";

import { StartChooserView } from "./StartChooser";

let appState: AppState;

afterEach(() => vi.restoreAllMocks());

it("preserves all planned sessions and completion state after extracting the start chooser", async () => {
  appState = structuredClone(DEFAULT_APP_STATE);
  appState.routines = [
    { id: "rehab", name: "Rehab", emoji: "", ex: [] },
    { id: "run", name: "Easy run", emoji: "", ex: [] },
  ];
  appState.dayPlan[todayISO()] = {
    sessions: [{ routineId: "rehab" }, { routineId: "run", start: "18:00" }],
  };
  appState.workouts = [
    {
      id: "done",
      d: todayISO(),
      routineId: "rehab",
      name: "Rehab",
      start: 1,
      end: 2,
      entries: [],
      prs: [],
      vol: 0,
    },
  ];

  const router = createRouter({
    routeTree: createRootRoute(),
    history: createMemoryHistory({ initialEntries: ["/"] }),
  });

  await router.load();

  const markup = renderToStaticMarkup(
    <RouterContextProvider router={router}>
      <StartChooserView appState={appState} />
    </RouterContextProvider>,
  );

  expect(markup).toContain("today is Rehab, Easy run");
  expect(markup).toContain("Done");
  expect(markup).toContain("18:00");
  expect(markup).toContain('aria-label="Start Easy run"');
  expect(markup).not.toContain('aria-label="Start Rehab"');
  expect(markup).not.toContain("Other routines");
});
