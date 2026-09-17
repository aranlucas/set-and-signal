import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { PlannedSessions } from "./PlannedSessions";
import type { PlannedSession } from "@/domain/training/schedule";

vi.mock("react-i18next", async (importOriginal) => ({
  ...(await importOriginal<typeof import("react-i18next")>()),
  useTranslation: () => ({
    t: (_key: string, fallback: string, values?: Record<string, string | number>) =>
      fallback.replaceAll(/\{\{(\w+)\}\}/gu, (_match, key: string) => String(values?.[key] ?? "")),
  }),
}));
const sessions: PlannedSession[] = [
  {
    key: "rehab:1",
    routineId: "rehab",
    routine: { id: "rehab", name: "Rehab", emoji: "", ex: [] },
    completed: true,
  },
  {
    key: "run:1",
    routineId: "run",
    routine: { id: "run", name: "Easy run", emoji: "", ex: [] },
    completed: false,
    start: "18:00",
    label: "Three miles",
  },
];

describe("daily planned workouts", () => {
  it("shows every workout while only offering to start unfinished sessions", () => {
    const markup = renderToStaticMarkup(<PlannedSessions sessions={sessions} onStart={() => {}} />);
    expect(markup).toContain("Rehab");
    expect(markup).toContain("Done");
    expect(markup).toContain("Easy run");
    expect(markup).toContain("18:00 · Three miles");
    expect(markup).toContain('aria-label="Start Easy run"');
    expect(markup).not.toContain('aria-label="Start Rehab"');
  });
  it("prevents starting another workout while a session is active", () => {
    const markup = renderToStaticMarkup(
      <PlannedSessions sessions={sessions} onStart={() => {}} disabled />,
    );
    expect(markup).toContain('disabled=""');
  });
});
