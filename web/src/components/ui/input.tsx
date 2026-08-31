import * as React from "react";
import { Input as InputPrimitive } from "@base-ui/react/input";

import { cn } from "@/lib/utils";

const Input = React.forwardRef<HTMLInputElement, React.ComponentProps<"input">>(function Input(
  { className, type, ...props },
  ref,
) {
  return (
    <InputPrimitive
      ref={ref}
      type={type}
      data-slot="input"
      className={cn(
        "w-full min-w-0 rounded-lg border-0 bg-card px-4 py-3 text-lg tracking-tight transition-shadow outline-none file:inline-flex file:h-6 file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:ring-3 aria-invalid:ring-destructive/20",
        className,
      )}
      {...props}
    />
  );
});

export { Input };
