import { forwardRef, type ComponentPropsWithoutRef } from "react";

import {
  layoutGapClasses,
  type LayoutBreakpoint,
  type LayoutSpacingSize,
  type ResponsiveLayoutSpacing,
} from "@/shared/components/layout-spacing";
import { cn } from "@/shared/lib/utils";

export type SpaceBetweenSize = LayoutSpacingSize;
export type SpaceBetweenBreakpoint = LayoutBreakpoint;

export interface SpaceBetweenProps extends Omit<ComponentPropsWithoutRef<"div">, "children"> {
  /** Controls the gap using the shared Tailwind spacing scale. */
  size: SpaceBetweenSize;
  /** Adds breakpoint-specific gaps without exposing utility classes to consumers. */
  responsiveSize?: ResponsiveLayoutSpacing;
  direction?: "vertical" | "horizontal";
  alignItems?: "start" | "center" | "end";
  children?: React.ReactNode;
}

const alignmentClasses: Record<NonNullable<SpaceBetweenProps["alignItems"]>, string> = {
  start: "items-start",
  center: "items-center",
  end: "items-end",
};

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
        layoutGapClasses(size, responsiveSize),
        alignItems && alignmentClasses[alignItems],
        className,
      )}
    >
      {children}
    </div>
  );
});
