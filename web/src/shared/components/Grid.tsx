import { forwardRef, type ComponentPropsWithoutRef } from "react";

import {
  layoutBreakpoints,
  layoutGapClasses,
  type LayoutBreakpoint,
  type LayoutSpacingSize,
  type ResponsiveLayoutSpacing,
} from "@/shared/components/layout-spacing";
import { cn } from "@/shared/lib/utils";

export type GridColumnCount = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12;
export type ResponsiveGridColumns = { default: GridColumnCount } & Partial<
  Record<LayoutBreakpoint, GridColumnCount>
>;

export interface GridProps extends Omit<ComponentPropsWithoutRef<"div">, "children"> {
  /** Sets equal-width columns, with optional Tailwind breakpoint overrides. */
  columns: GridColumnCount | ResponsiveGridColumns;
  /** Uses the same shared spacing scale as SpaceBetween. */
  gap?: LayoutSpacingSize;
  responsiveGap?: ResponsiveLayoutSpacing;
  alignItems?: "start" | "center" | "end" | "stretch";
  children?: React.ReactNode;
}

const columnClasses: Record<GridColumnCount, string> = {
  1: "grid-cols-1",
  2: "grid-cols-2",
  3: "grid-cols-3",
  4: "grid-cols-4",
  5: "grid-cols-5",
  6: "grid-cols-6",
  7: "grid-cols-7",
  8: "grid-cols-8",
  9: "grid-cols-9",
  10: "grid-cols-10",
  11: "grid-cols-11",
  12: "grid-cols-12",
};

const responsiveColumnClasses: Record<LayoutBreakpoint, Record<GridColumnCount, string>> = {
  sm: {
    1: "sm:grid-cols-1",
    2: "sm:grid-cols-2",
    3: "sm:grid-cols-3",
    4: "sm:grid-cols-4",
    5: "sm:grid-cols-5",
    6: "sm:grid-cols-6",
    7: "sm:grid-cols-7",
    8: "sm:grid-cols-8",
    9: "sm:grid-cols-9",
    10: "sm:grid-cols-10",
    11: "sm:grid-cols-11",
    12: "sm:grid-cols-12",
  },
  md: {
    1: "md:grid-cols-1",
    2: "md:grid-cols-2",
    3: "md:grid-cols-3",
    4: "md:grid-cols-4",
    5: "md:grid-cols-5",
    6: "md:grid-cols-6",
    7: "md:grid-cols-7",
    8: "md:grid-cols-8",
    9: "md:grid-cols-9",
    10: "md:grid-cols-10",
    11: "md:grid-cols-11",
    12: "md:grid-cols-12",
  },
  lg: {
    1: "lg:grid-cols-1",
    2: "lg:grid-cols-2",
    3: "lg:grid-cols-3",
    4: "lg:grid-cols-4",
    5: "lg:grid-cols-5",
    6: "lg:grid-cols-6",
    7: "lg:grid-cols-7",
    8: "lg:grid-cols-8",
    9: "lg:grid-cols-9",
    10: "lg:grid-cols-10",
    11: "lg:grid-cols-11",
    12: "lg:grid-cols-12",
  },
  xl: {
    1: "xl:grid-cols-1",
    2: "xl:grid-cols-2",
    3: "xl:grid-cols-3",
    4: "xl:grid-cols-4",
    5: "xl:grid-cols-5",
    6: "xl:grid-cols-6",
    7: "xl:grid-cols-7",
    8: "xl:grid-cols-8",
    9: "xl:grid-cols-9",
    10: "xl:grid-cols-10",
    11: "xl:grid-cols-11",
    12: "xl:grid-cols-12",
  },
  "2xl": {
    1: "2xl:grid-cols-1",
    2: "2xl:grid-cols-2",
    3: "2xl:grid-cols-3",
    4: "2xl:grid-cols-4",
    5: "2xl:grid-cols-5",
    6: "2xl:grid-cols-6",
    7: "2xl:grid-cols-7",
    8: "2xl:grid-cols-8",
    9: "2xl:grid-cols-9",
    10: "2xl:grid-cols-10",
    11: "2xl:grid-cols-11",
    12: "2xl:grid-cols-12",
  },
};

const alignmentClasses: Record<NonNullable<GridProps["alignItems"]>, string> = {
  start: "items-start",
  center: "items-center",
  end: "items-end",
  stretch: "items-stretch",
};

export const Grid = forwardRef<HTMLDivElement, GridProps>(function Grid(
  { columns, gap = "s", responsiveGap, alignItems, className, children, ...props },
  ref,
) {
  const responsiveColumns = typeof columns === "number" ? undefined : columns;
  const defaultColumns = typeof columns === "number" ? columns : columns.default;

  return (
    <div
      {...props}
      ref={ref}
      data-slot="grid"
      className={cn(
        "grid",
        columnClasses[defaultColumns],
        responsiveColumns &&
          layoutBreakpoints.map((breakpoint) => {
            const breakpointColumns = responsiveColumns[breakpoint];
            return breakpointColumns && responsiveColumnClasses[breakpoint][breakpointColumns];
          }),
        layoutGapClasses(gap, responsiveGap),
        alignItems && alignmentClasses[alignItems],
        className,
      )}
    >
      {children}
    </div>
  );
});
