import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { Button } from "@/shared/ui/button";

describe("Button layout", () => {
  it("is content-sized by default", () => {
    const markup = renderToStaticMarkup(<Button>Continue</Button>);

    expect(markup).not.toContain("w-full");
  });

  it("allows the owning layout to opt into full width", () => {
    const markup = renderToStaticMarkup(<Button className="w-full">Continue</Button>);

    expect(markup).toContain("w-full");
  });
});
