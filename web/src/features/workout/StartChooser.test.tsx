import { renderToStaticMarkup } from "react-dom/server";
import { expect, it, vi } from "vitest";
import { DEFAULT_APP_STATE } from "@/domain/training/default-state";
import { todayISO } from "@/shared/lib/format";
import type { AppState } from "@/shared/lib/types";
import { StartChooser } from "./StartChooser";

let appState: AppState;
vi.mock("@/app/store/useStore", () => ({
  useStore: (select: (state: { appState: AppState }) => unknown) => select({ appState }),
}));
vi.mock("@tanstack/react-router", () => ({ useNavigate: () => vi.fn<() => Promise<void>>() }));
vi.mock("@/shared/components/RouteBottomSheet", () => ({ RouteBottomSheet: () => null }));
vi.mock("react-i18next", async (importOriginal) => ({
  ...(await importOriginal<typeof import("react-i18next")>()),
  useTranslation: () => ({
    t: (_key: string, fallback: string, values?: Record<string, string | number>) =>
      fallback.replaceAll(/\{\{(\w+)\}\}/gu, (_match, key: string) => String(values?.[key] ?? "")),
  }),
}));

it("preserves all planned sessions and completion state after extracting the start chooser", () => {
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
  const markup = renderToStaticMarkup(<StartChooser />);
  expect(markup).toContain("today is Rehab, Easy run");
  expect(markup).toContain("Done");
  expect(markup).toContain("18:00");
  expect(markup).toContain('aria-label="Start Easy run"');
  expect(markup).not.toContain('aria-label="Start Rehab"');
  expect(markup).not.toContain("Other routines");
});
