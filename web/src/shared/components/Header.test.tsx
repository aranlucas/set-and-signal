import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { Header } from "@/shared/components/Header";

describe("Header", () => {
  it("renders the Cloudscape-inspired content slots", () => {
    const markup = renderToStaticMarkup(
      <Header
        variant="h1"
        description="Progress and history"
        actions={<button>History</button>}
        counter="(12)"
        info={<a href="#help">Info</a>}
      >
        Stats
      </Header>,
    );

    expect(markup).toContain('data-slot="header"');
    expect(markup).toContain("<h1");
    expect(markup).toContain("Progress and history");
    expect(markup).toContain("History</button>");
    expect(markup).toContain("(12)");
    expect(markup).toContain("Info</a>");
  });

  it("separates visual variant from heading semantics", () => {
    const markup = renderToStaticMarkup(
      <Header variant="h2" headingTagOverride="h3" className="mb-2">
        Routines
      </Header>,
    );

    expect(markup).toContain("<h3");
    expect(markup).toContain("text-sm");
    expect(markup).toContain("mb-2");
  });
});
