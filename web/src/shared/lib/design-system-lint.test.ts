import { describe, expect, it, vi } from "vitest";

import { noNativeButton } from "../../../lint/design-system.mjs";

function visitOpeningElement(name: string) {
  const report = vi.fn<(descriptor: unknown) => void>();
  const visitor = noNativeButton.create({ report });

  visitor.JSXOpeningElement({
    name: { type: "JSXIdentifier", name },
  });

  return report;
}

describe("design-system/no-native-button", () => {
  it("reports native button elements", () => {
    const report = visitOpeningElement("button");

    expect(report).toHaveBeenCalledOnce();
    expect(report).toHaveBeenCalledWith(expect.objectContaining({ messageId: "nativeButton" }));
  });

  it("allows the shared Button component", () => {
    expect(visitOpeningElement("Button")).not.toHaveBeenCalled();
  });
});
