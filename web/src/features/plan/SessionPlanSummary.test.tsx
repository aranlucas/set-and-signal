import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { SessionPlanSummary } from "./SessionPlanSummary";
import type { SessionPlan } from "@/shared/lib/types";

vi.mock("react-i18next", async (importOriginal) => ({
  ...(await importOriginal<typeof import("react-i18next")>()),
  useTranslation: () => ({
    t: (_key: string, fallback: string, values?: Record<string, string | number>) =>
      fallback.replaceAll(/\{\{(\w+)\}\}/gu, (_match, key: string) => String(values?.[key] ?? "")),
  }),
}));

const plan: SessionPlan = {
  sourceId: "synthetic-source",
  sourceName: "Travel strength",
  equipment: [],
  budgetMin: 20,
  restSec: 60,
  rows: [
    {
      original: { id: "0025", sets: 4, reps: 8, weight: 60 },
      planned: { id: "0662", sets: 2, reps: 10 },
    },
    { original: { id: "0047", sets: 3, reps: 8, weight: 40 }, planned: null },
  ],
};

describe("accepted session snapshot", () => {
  it("distinguishes the original targets, accepted alternatives, and omitted work", () => {
    const markup = renderToStaticMarkup(<SessionPlanSummary plan={plan} unit="kg" />);
    expect(markup).toContain("Adapted from Travel strength · 20 min budget");
    expect(markup.match(/Source routine/g)).toHaveLength(2);
    expect(markup.match(/Accepted copy/g)).toHaveLength(2);
    expect(markup).toContain("60 kg");
    expect(markup).toContain("push-up");
    expect(markup).toContain("Omitted from this copy");
    expect(markup).toContain("load and speed reset");
    expect(markup).toContain("Later edits and actual logged sets are recorded separately");
  });
  it("renders repeated source exercises without changing the stored snapshot", () => {
    const repeated = { ...plan, rows: [plan.rows[0], plan.rows[0]] };
    const before = structuredClone(repeated);
    const markup = renderToStaticMarkup(<SessionPlanSummary plan={repeated} unit="lb" />);
    expect(markup.match(/Source routine/g)).toHaveLength(2);
    expect(markup).toContain("60 lb");
    expect(repeated).toEqual(before);
  });
});
