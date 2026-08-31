import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { SpaceBetween } from "@/shared/components/SpaceBetween";

describe("SpaceBetween", () => {
  it("uses a vertical medium gap by default", () => {
    const markup = renderToStaticMarkup(
      <SpaceBetween size="m">
        <div>One</div>
        <div>Two</div>
      </SpaceBetween>,
    );

    expect(markup).toContain("flex-col");
    expect(markup).toContain("gap-4");
  });

  it("supports horizontal alignment and responsive gaps", () => {
    const markup = renderToStaticMarkup(
      <SpaceBetween
        direction="horizontal"
        size="s"
        responsiveSize={{ md: "m", lg: "l" }}
        alignItems="center"
      >
        <div>One</div>
        <div>Two</div>
      </SpaceBetween>,
    );

    expect(markup).toContain("flex-row");
    expect(markup).toContain("flex-wrap");
    expect(markup).toContain("gap-3");
    expect(markup).toContain("md:gap-4");
    expect(markup).toContain("lg:gap-5");
    expect(markup).toContain("items-center");
  });

  it("merges consumer classes and native attributes", () => {
    const markup = renderToStaticMarkup(
      <SpaceBetween size="m" className="gap-8" aria-label="Actions" />,
    );

    expect(markup).toContain('aria-label="Actions"');
    expect(markup).toContain("gap-8");
    expect(markup).not.toContain("gap-4");
  });
});
