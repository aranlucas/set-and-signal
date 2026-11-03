import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { MetricCard } from "@/shared/components/MetricCard";

describe("MetricCard", () => {
  it("merges consumer classes and native attributes", () => {
    const markup = renderToStaticMarkup(
      <MetricCard className="text-primary" aria-label="Personal records" />,
    );

    expect(markup).toContain('aria-label="Personal records"');
    expect(markup).toContain("text-primary");
  });
});
