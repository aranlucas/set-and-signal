interface JsxOpeningElement {
  name: {
    type: string;
    name?: string;
  };
}

interface RuleContext {
  report(descriptor: { node: JsxOpeningElement["name"]; messageId: string }): void;
}

export const noNativeButton: {
  create(context: RuleContext): {
    JSXOpeningElement(node: JsxOpeningElement): void;
  };
};

declare const plugin: {
  meta: { name: string };
  rules: { "no-native-button": typeof noNativeButton };
};

export default plugin;
