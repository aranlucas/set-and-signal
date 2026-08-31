interface JsxOpeningElement {
  name: {
    type: string;
    name?: string;
  };
}

interface RuleContext {
  filename?: string;
  getFilename?(): string;
  report(descriptor: {
    node: JsxOpeningElement["name"];
    messageId: string;
    data?: Record<string, string>;
  }): void;
}

interface ComponentReplacement {
  component: string;
  module: string;
}

export const componentsByElement: Readonly<Record<string, ComponentReplacement>>;

export const preferComponents: {
  create(context: RuleContext): {
    JSXOpeningElement(node: JsxOpeningElement): void;
  };
};

declare const plugin: {
  meta: { name: string };
  rules: { "prefer-components": typeof preferComponents };
};

export default plugin;
