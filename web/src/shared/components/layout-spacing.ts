/** Cloudscape-inspired 2, 4, 8, 12, 16, 20, 24, 32, and 40px spacing scale. */
export type LayoutSpacingSize = "xxxs" | "xxs" | "xs" | "s" | "m" | "l" | "xl" | "xxl" | "xxxl";
export type LayoutBreakpoint = "sm" | "md" | "lg" | "xl" | "2xl";
export type ResponsiveLayoutSpacing = Partial<Record<LayoutBreakpoint, LayoutSpacingSize>>;

const gapClasses: Record<LayoutSpacingSize, string> = {
  xxxs: "gap-0.5",
  xxs: "gap-1",
  xs: "gap-2",
  s: "gap-3",
  m: "gap-4",
  l: "gap-5",
  xl: "gap-6",
  xxl: "gap-8",
  xxxl: "gap-10",
};

const responsiveGapClasses: Record<LayoutBreakpoint, Record<LayoutSpacingSize, string>> = {
  sm: {
    xxxs: "sm:gap-0.5",
    xxs: "sm:gap-1",
    xs: "sm:gap-2",
    s: "sm:gap-3",
    m: "sm:gap-4",
    l: "sm:gap-5",
    xl: "sm:gap-6",
    xxl: "sm:gap-8",
    xxxl: "sm:gap-10",
  },
  md: {
    xxxs: "md:gap-0.5",
    xxs: "md:gap-1",
    xs: "md:gap-2",
    s: "md:gap-3",
    m: "md:gap-4",
    l: "md:gap-5",
    xl: "md:gap-6",
    xxl: "md:gap-8",
    xxxl: "md:gap-10",
  },
  lg: {
    xxxs: "lg:gap-0.5",
    xxs: "lg:gap-1",
    xs: "lg:gap-2",
    s: "lg:gap-3",
    m: "lg:gap-4",
    l: "lg:gap-5",
    xl: "lg:gap-6",
    xxl: "lg:gap-8",
    xxxl: "lg:gap-10",
  },
  xl: {
    xxxs: "xl:gap-0.5",
    xxs: "xl:gap-1",
    xs: "xl:gap-2",
    s: "xl:gap-3",
    m: "xl:gap-4",
    l: "xl:gap-5",
    xl: "xl:gap-6",
    xxl: "xl:gap-8",
    xxxl: "xl:gap-10",
  },
  "2xl": {
    xxxs: "2xl:gap-0.5",
    xxs: "2xl:gap-1",
    xs: "2xl:gap-2",
    s: "2xl:gap-3",
    m: "2xl:gap-4",
    l: "2xl:gap-5",
    xl: "2xl:gap-6",
    xxl: "2xl:gap-8",
    xxxl: "2xl:gap-10",
  },
};

export const layoutBreakpoints: LayoutBreakpoint[] = ["sm", "md", "lg", "xl", "2xl"];

export function layoutGapClasses(
  size: LayoutSpacingSize,
  responsiveSize?: ResponsiveLayoutSpacing,
) {
  return [
    gapClasses[size],
    responsiveSize &&
      layoutBreakpoints.map((breakpoint) => {
        const breakpointSize = responsiveSize[breakpoint];
        return breakpointSize && responsiveGapClasses[breakpoint][breakpointSize];
      }),
  ];
}
