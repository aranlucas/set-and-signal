import { describe, expect, it, vi } from "vitest";

import { componentsByElement, preferComponents } from "../../../lint/design-system.mjs";

function visitOpeningElement(name: string, filename = "/project/src/features/example.tsx") {
  const report = vi.fn<(descriptor: unknown) => void>();
  const visitor = preferComponents.create({ filename, report });

  visitor.JSXOpeningElement({
    name: { type: "JSXIdentifier", name },
  });

  return report;
}

describe("design-system/prefer-components", () => {
  it.each(
    Object.entries(componentsByElement).map(([element, { component, module }]) => [
      element,
      component,
      module,
    ]),
  )("reports native <%s> elements", (element, component, module) => {
    const report = visitOpeningElement(element);

    expect(report).toHaveBeenCalledOnce();
    expect(report).toHaveBeenCalledWith({
      node: { type: "JSXIdentifier", name: element },
      messageId: "preferComponent",
      data: { element, component, module },
    });
  });

  it.each(["Button", "Input", "FieldSet", "TableCell", "form", "a", "img"])(
    "allows <%s>",
    (element) => {
      expect(visitOpeningElement(element)).not.toHaveBeenCalled();
    },
  );

  it("allows a native element inside its shared primitive implementation", () => {
    expect(
      visitOpeningElement("textarea", "/project/src/shared/ui/textarea.tsx"),
    ).not.toHaveBeenCalled();
  });

  it("still reports that native element outside its primitive implementation", () => {
    expect(visitOpeningElement("textarea")).toHaveBeenCalledOnce();
  });
});
