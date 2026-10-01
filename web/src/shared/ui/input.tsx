import * as React from "react";
import { Input as InputPrimitive } from "@base-ui/react/input";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/shared/lib/utils";

const inputVariants = cva(
  "w-full min-w-0 rounded-lg border-0 bg-card px-4 py-3 text-lg tracking-tight transition-shadow outline-none file:inline-flex file:h-6 file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:ring-3 aria-invalid:ring-destructive/20",
  {
    variants: {
      variant: {
        default: "",
        // Search box with a leading icon.
        search: "bg-muted pl-9",
        // Small inline value, e.g. a time next to a label.
        inline: "w-auto bg-muted px-2.5 py-1.5 text-base tabular-nums",
        // Borderless numeric cell inside a set row.
        bare: "bg-transparent p-0 text-center font-medium [&::-webkit-inner-spin-button]:hidden",
        // Outlined numeric field; `data-suffix` reserves room for a trailing unit.
        numeric:
          "border border-input bg-background text-xl font-semibold tabular-nums data-suffix:pr-14",
      },
      density: {
        default: "",
        compact: "text-sm",
      },
    },
    defaultVariants: {
      variant: "default",
      density: "default",
    },
  },
);

const Input = React.forwardRef<
  HTMLInputElement,
  React.ComponentProps<"input"> & VariantProps<typeof inputVariants>
>(function Input({ className, type, variant, density, ...props }, ref) {
  return (
    <InputPrimitive
      ref={ref}
      type={type}
      data-slot="input"
      className={cn(inputVariants({ variant, density }), className)}
      {...props}
    />
  );
});

export { Input };
