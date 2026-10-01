import { Button as ButtonPrimitive } from "@base-ui/react/button";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/shared/lib/utils";

const plain =
  "shrink rounded-none border-0 bg-transparent p-0 text-base font-normal tracking-normal whitespace-normal text-foreground hover:bg-transparent not-aria-[haspopup]:active:scale-100";

const buttonVariants = cva(
  "group/button inline-flex shrink-0 items-center justify-center gap-2 rounded-lg border border-transparent bg-muted px-4.5 py-3.5 text-lg font-semibold tracking-tight whitespace-nowrap text-foreground transition duration-150 ease-out outline-none select-none focus-visible:ring-3 focus-visible:ring-ring/50 not-aria-[haspopup]:active:scale-95 disabled:pointer-events-none disabled:opacity-30 aria-invalid:ring-3 aria-invalid:ring-destructive/20 [&_.icn]:text-xl [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        plain,
        // Card-coloured list row (pickers, plan days, routines).
        row: cn(
          plain,
          "gap-3 rounded-lg bg-card px-3 py-2.5 transition-colors duration-140 active:bg-muted aria-[current=step]:bg-primary aria-[current=step]:text-primary-foreground",
        ),
        // Round icon button in page headers and toolbars.
        circle: cn(
          plain,
          "rounded-full bg-card text-lg text-foreground transition duration-140 active:bg-muted",
        ),
        // Filter pill; `aria-pressed` marks the selected one.
        chip: cn(
          plain,
          "gap-1 rounded-full bg-card px-3 py-1.5 text-sm tracking-tight text-foreground transition-colors duration-140 focus-visible:underline focus-visible:underline-offset-2 active:bg-muted aria-pressed:bg-primary aria-pressed:font-medium aria-pressed:text-primary-foreground",
        ),
        // Compact option in a set of choices (plates, units, formulas); `aria-pressed` marks the choice.
        toggle: cn(
          plain,
          "rounded-md bg-muted px-2 py-1.5 text-sm font-medium text-muted-foreground tabular-nums transition-colors active:bg-input aria-pressed:bg-primary aria-pressed:text-primary-foreground",
        ),
        // Grid cell or option card; `aria-pressed` or `data-highlighted` tint it, `aria-current="date"` rings it.
        tile: cn(
          plain,
          "rounded-lg bg-card text-foreground transition-colors active:bg-muted aria-pressed:bg-primary/15 aria-pressed:text-primary aria-pressed:ring-1 aria-pressed:ring-primary/40 aria-[current=date]:ring-2 aria-[current=date]:ring-primary data-highlighted:bg-primary/15 data-highlighted:text-primary",
        ),
        // Small square action inside a row (reorder, link, delete).
        square: cn(
          plain,
          "rounded-sm bg-card text-base text-foreground transition duration-140 active:bg-muted aria-pressed:bg-primary/15 aria-pressed:text-primary",
        ),
        // Secondary dismiss action ("Not now", "Cancel").
        quiet:
          "text-muted-foreground hover:bg-muted hover:text-foreground aria-expanded:bg-muted aria-expanded:text-foreground dark:hover:bg-muted/50",
        // Borderless tap target, e.g. steppers.
        stepper: cn(plain, "transition-colors duration-150 active:bg-input"),
        // Unstyled clickable content block.
        bare: cn(plain, "gap-3"),
        // Row in a grouped settings-style list; `data-tone="danger"` colours it destructive.
        listItem: cn(
          plain,
          "gap-3 px-3.5 py-3 before:pointer-events-none before:absolute before:top-0 before:right-0 before:left-3.5 before:hidden before:h-px before:bg-border/60 active:bg-muted data-[tone=danger]:text-destructive [&+&]:before:block [&:has([data-row-icon])+&:has([data-row-icon])]:before:left-14",
        ),
        // Accent colour picker swatch; `aria-pressed` rings the chosen one.
        swatch: cn(
          plain,
          "rounded-full bg-accent-swatch transition-transform duration-140 aria-pressed:after:absolute aria-pressed:after:-inset-1 aria-pressed:after:rounded-full aria-pressed:after:ring-2 aria-pressed:after:ring-foreground",
        ),
        // Pill floating over media.
        overlay: cn(
          plain,
          "gap-1 rounded-full bg-black/45 px-3 py-1.5 text-xs font-medium text-white backdrop-blur-md",
        ),
        primary: "bg-primary text-primary-foreground active:bg-primary",
        tinted: "bg-primary/15 text-primary",
        danger: "bg-destructive/15 text-destructive",
        default: "bg-primary text-primary-foreground hover:bg-primary/80",
        outline:
          "border-border bg-background hover:bg-muted hover:text-foreground aria-expanded:bg-muted aria-expanded:text-foreground dark:border-input dark:bg-input/30 dark:hover:bg-input/50",
        secondary:
          "bg-secondary text-secondary-foreground hover:bg-muted aria-expanded:bg-secondary aria-expanded:text-secondary-foreground",
        ghost:
          "hover:bg-muted hover:text-foreground aria-expanded:bg-muted aria-expanded:text-foreground dark:hover:bg-muted/50",
        destructive:
          "bg-destructive/10 text-destructive hover:bg-destructive/20 focus-visible:border-destructive/40 focus-visible:ring-destructive/20 dark:bg-destructive/20 dark:hover:bg-destructive/30 dark:focus-visible:ring-destructive/40",
        link: "text-primary underline-offset-4 hover:underline",
      },
      size: {
        default: "",
        xs: "w-auto gap-1 rounded-sm px-2.5 py-1.5 text-sm [&_.icn]:text-base",
        sm: "w-auto gap-1.5 rounded-md px-3.5 py-2 text-base [&_.icn]:text-base",
        lg: "h-9 gap-1.5 px-2.5 has-data-[icon=inline-end]:pr-2 has-data-[icon=inline-start]:pl-2",
        icon: "size-8",
        "icon-xs":
          "size-6 rounded-md in-data-[slot=button-group]:rounded-lg [&_svg:not([class*='size-'])]:size-3",
        "icon-sm": "size-7 rounded-md in-data-[slot=button-group]:rounded-lg",
        "icon-lg": "size-9",
        block: "gap-3 p-4",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

function Button({
  className,
  variant = "default",
  size = "default",
  ...props
}: ButtonPrimitive.Props & VariantProps<typeof buttonVariants>) {
  return (
    <ButtonPrimitive
      data-slot="button"
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  );
}

export { Button, buttonVariants };
