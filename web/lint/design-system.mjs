const noNativeButton = {
  meta: {
    type: "suggestion",
    docs: {
      description: "Require the shared design-system Button component",
    },
    messages: {
      nativeButton: 'Use Button from "@/shared/ui/button" instead of a native <button> element.',
    },
    schema: [],
  },
  create(context) {
    return {
      JSXOpeningElement(node) {
        if (node.name.type === "JSXIdentifier" && node.name.name === "button") {
          context.report({
            node: node.name,
            messageId: "nativeButton",
          });
        }
      },
    };
  },
};

export { noNativeButton };

export default {
  meta: {
    name: "design-system",
  },
  rules: {
    "no-native-button": noNativeButton,
  },
};
