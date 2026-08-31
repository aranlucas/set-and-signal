const componentsByElement = {
  button: { component: "Button", module: "@/shared/ui/button" },
  input: { component: "Input", module: "@/shared/ui/input" },
  textarea: { component: "Textarea", module: "@/shared/ui/textarea" },
  select: { component: "NativeSelect", module: "@/shared/ui/native-select" },
  option: { component: "NativeSelectOption", module: "@/shared/ui/native-select" },
  optgroup: { component: "NativeSelectOptGroup", module: "@/shared/ui/native-select" },
  label: { component: "Label", module: "@/shared/ui/label" },
  fieldset: { component: "FieldSet", module: "@/shared/ui/field" },
  legend: { component: "FieldLegend", module: "@/shared/ui/field" },
  table: { component: "Table", module: "@/shared/ui/table" },
  thead: { component: "TableHeader", module: "@/shared/ui/table" },
  tbody: { component: "TableBody", module: "@/shared/ui/table" },
  tfoot: { component: "TableFooter", module: "@/shared/ui/table" },
  tr: { component: "TableRow", module: "@/shared/ui/table" },
  th: { component: "TableHead", module: "@/shared/ui/table" },
  td: { component: "TableCell", module: "@/shared/ui/table" },
  caption: { component: "TableCaption", module: "@/shared/ui/table" },
  hr: { component: "Separator", module: "@/shared/ui/separator" },
  progress: { component: "Progress", module: "@/shared/ui/progress" },
};

const implementationFilesByElement = {
  textarea: ["/src/shared/ui/textarea.tsx"],
  select: ["/src/shared/ui/native-select.tsx"],
  option: ["/src/shared/ui/native-select.tsx"],
  optgroup: ["/src/shared/ui/native-select.tsx"],
  label: ["/src/shared/ui/label.tsx"],
  fieldset: ["/src/shared/ui/field.tsx"],
  legend: ["/src/shared/ui/field.tsx"],
  table: ["/src/shared/ui/table.tsx"],
  thead: ["/src/shared/ui/table.tsx"],
  tbody: ["/src/shared/ui/table.tsx"],
  tfoot: ["/src/shared/ui/table.tsx"],
  tr: ["/src/shared/ui/table.tsx"],
  th: ["/src/shared/ui/table.tsx"],
  td: ["/src/shared/ui/table.tsx", "/src/shared/ui/calendar.tsx"],
  caption: ["/src/shared/ui/table.tsx"],
};

function isPrimitiveImplementation(element, filename) {
  const normalizedFilename = filename.replaceAll("\\", "/");
  return (implementationFilesByElement[element] ?? []).some((path) =>
    normalizedFilename.endsWith(path),
  );
}

const preferComponents = {
  meta: {
    type: "suggestion",
    docs: {
      description: "Require shared design-system components for supported native JSX elements",
    },
    messages: {
      preferComponent:
        'Use {{component}} from "{{module}}" instead of a native <{{element}}> element.',
    },
    schema: [],
  },
  create(context) {
    const filename = context.filename ?? context.getFilename?.() ?? "";

    return {
      JSXOpeningElement(node) {
        if (node.name.type !== "JSXIdentifier") return;

        const element = node.name.name;
        const replacement = componentsByElement[element];
        if (!replacement || isPrimitiveImplementation(element, filename)) return;

        context.report({
          node: node.name,
          messageId: "preferComponent",
          data: { element, ...replacement },
        });
      },
    };
  },
};

export { componentsByElement, preferComponents };

export default {
  meta: {
    name: "design-system",
  },
  rules: {
    "prefer-components": preferComponents,
  },
};
