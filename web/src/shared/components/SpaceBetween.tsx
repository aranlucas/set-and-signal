import { forwardRef, type ComponentPropsWithoutRef } from "react";

import { cn } from "@/shared/lib/utils";

export type SpaceBetweenSize = "xxxs" | "xxs" | "xs" | "s" | "m" | "l" | "xl" | "xxl";
export type SpaceBetweenBreakpoint = "sm" | "md" | "lg" | "xl" | "2xl";

export interface SpaceBetweenProps extends Omit<ComponentPropsWithoutRef<"div">, "children"> {
  /** Controls the gap using the shared Tailwind spacing scale. */
  size: SpaceBetweenSize;
  /** Adds breakpoint-specific gaps without exposing utility classes to consumers. */
  responsiveSize?: Partial<Record<SpaceBetweenBreakpoint, SpaceBetweenSize>>;
  direction?: "vertical" | "horizontal";
  alignItems?: "start" | "center" | "end";
  children?: React.ReactNode;
}

const gapClasses: Record<SpaceBetweenSize, string> = {
  xxxs: "gap-0.5",
  xxs: "gap-1",
  xs: "gap-2",
  s: "gap-3",
  m: "gap-4",
  l: "gap-6",
  xl: "gap-8",
  xxl: "gap-12",
};

const responsiveGapClasses: Record<SpaceBetweenBreakpoint, Record<SpaceBetweenSize, string>> = {
  sm: {
    xxxs: "sm:gap-0.5",
    xxs: "sm:gap-1",
    xs: "sm:gap-2",
    s: "sm:gap-3",
    m: "sm:gap-4",
    l: "sm:gap-6",
    xl: "sm:gap-8",
    xxl: "sm:gap-12",
  },
  md: {
    xxxs: "md:gap-0.5",
    xxs: "md:gap-1",
    xs: "md:gap-2",
    s: "md:gap-3",
    m: "md:gap-4",
    l: "md:gap-6",
    xl: "md:gap-8",
    xxl: "md:gap-12",
  },
  lg: {
    xxxs: "lg:gap-0.5",
    xxs: "lg:gap-1",
    xs: "lg:gap-2",
    s: "lg:gap-3",
    m: "lg:gap-4",
    l: "lg:gap-6",
    xl: "lg:gap-8",
    xxl: "lg:gap-12",
  },
  xl: {
    xxxs: "xl:gap-0.5",
    xxs: "xl:gap-1",
    xs: "xl:gap-2",
    s: "xl:gap-3",
    m: "xl:gap-4",
    l: "xl:gap-6",
    xl: "xl:gap-8",
    xxl: "xl:gap-12",
  },
  "2xl": {
    xxxs: "2xl:gap-0.5",
    xxs: "2xl:gap-1",
    xs: "2xl:gap-2",
    s: "2xl:gap-3",
    m: "2xl:gap-4",
    l: "2xl:gap-6",
    xl: "2xl:gap-8",
    xxl: "2xl:gap-12",
  },
};

const alignmentClasses: Record<NonNullable<SpaceBetweenProps["alignItems"]>, string> = {
  start: "items-start",
  center: "items-center",
  end: "items-end",
};

const breakpoints: SpaceBetweenBreakpoint[] = ["sm", "md", "lg", "xl", "2xl"];

export const SpaceBetween = forwardRef<HTMLDivElement, SpaceBetweenProps>(function SpaceBetween(
  { size, responsiveSize, direction = "vertical", alignItems, className, children, ...props },
  ref,
) {
  return (
    <div
      {...props}
      ref={ref}
      data-slot="space-between"
      className={cn(
        "flex",
        direction === "vertical" ? "flex-col" : "flex-row flex-wrap",
        gapClasses[size],
        responsiveSize &&
          breakpoints.map((breakpoint) => {
            const breakpointSize = responsiveSize[breakpoint];
            return breakpointSize && responsiveGapClasses[breakpoint][breakpointSize];
          }),
        alignItems && alignmentClasses[alignItems],
        className,
      )}
    >
      {children}
    </div>
  );
});
