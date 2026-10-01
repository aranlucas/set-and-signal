export type CssCustomProperty = `--${string}`;

// Lets `style` carry CSS custom properties (`--progress`, …) that utility classes read,
// e.g. `className="w-(--progress)" style={{ "--progress": "40%" }}`.
declare module "react" {
  interface CSSProperties {
    [property: CssCustomProperty]: string | number | undefined;
  }
}
