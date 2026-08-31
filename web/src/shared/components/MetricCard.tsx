import type { ComponentPropsWithoutRef } from "react";

import { cn } from "@/shared/lib/utils";

export function MetricCard({ className, ...props }: ComponentPropsWithoutRef<"div">) {
  return (
    <div
      data-slot="metric-card"
      className={cn("rounded-lg bg-card p-4 text-left", className)}
      {...props}
    />
  );
}
