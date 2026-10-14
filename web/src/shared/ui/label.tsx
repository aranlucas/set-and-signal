import * as React from "react";

import { cn } from "@/shared/lib/utils";

type LabelProps = { tone?: "default" | "muted" };

function Label({
  className,
  tone = "default",
  ...props
}: React.ComponentProps<"label"> & LabelProps) {
  return (
    <label
      data-slot="label"
      className={cn(
        "flex items-center gap-2 text-sm leading-none font-medium select-none group-data-[disabled=true]:pointer-events-none group-data-[disabled=true]:opacity-50 peer-disabled:cursor-not-allowed peer-disabled:opacity-50",
        tone === "muted" && "text-muted-foreground",
        className,
      )}
      {...props}
    />
  );
}

export { Label };
