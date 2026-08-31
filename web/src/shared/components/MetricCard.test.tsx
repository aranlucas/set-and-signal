import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { MetricCard } from "@/shared/components/MetricCard";

describe("MetricCard", () => {
  it("owns the shared metric surface and content alignment", () => {
    const markup = renderToStaticMarkup(<MetricCard>Workouts</MetricCard>);

    expect(markup).toContain('data-slot="metric-card"');
    expect(markup).toContain("rounded-lg");
    expect(markup).toContain("bg-card");
    expect(markup).toContain("p-4");
    expect(markup).toContain("text-left");
  });

  it("merges consumer classes and native attributes", () => {
    const markup = renderToStaticMarkup(
      <MetricCard className="text-primary" aria-label="Personal records" />,
    );

    expect(markup).toContain('aria-label="Personal records"');
    expect(markup).toContain("text-primary");
  });
});
