import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { Grid } from "@/shared/components/Grid";

describe("Grid", () => {
  it("uses two columns and the standard gutter", () => {
    const markup = renderToStaticMarkup(
      <Grid columns={2}>
        <div>One</div>
        <div>Two</div>
      </Grid>,
    );

    expect(markup).toContain('data-slot="grid"');
    expect(markup).toContain("grid-cols-2");
    expect(markup).toContain("gap-3");
  });

  it("supports responsive columns, spacing, and alignment", () => {
    const markup = renderToStaticMarkup(
      <Grid
        columns={{ default: 1, md: 2, lg: 4 }}
        gap="xs"
        responsiveGap={{ lg: "m" }}
        alignItems="start"
      >
        <div>One</div>
        <div>Two</div>
      </Grid>,
    );

    expect(markup).toContain("grid-cols-1");
    expect(markup).toContain("md:grid-cols-2");
    expect(markup).toContain("lg:grid-cols-4");
    expect(markup).toContain("gap-2");
    expect(markup).toContain("lg:gap-4");
    expect(markup).toContain("items-start");
  });

  it("merges consumer classes and native attributes", () => {
    const markup = renderToStaticMarkup(
      <Grid columns={2} gap="s" className="gap-6" aria-label="Metrics" />,
    );

    expect(markup).toContain('aria-label="Metrics"');
    expect(markup).toContain("gap-6");
    expect(markup).not.toContain("gap-3");
  });
});
