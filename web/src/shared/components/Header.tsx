import { type ComponentPropsWithoutRef, type ReactNode } from "react";

import { cn } from "@/shared/lib/utils";

export type HeaderVariant = "h1" | "h2" | "h3";
export type HeaderHeadingTag = "h1" | "h2" | "h3" | "h4" | "h5";

export interface HeaderProps extends Omit<ComponentPropsWithoutRef<"div">, "children"> {
  children?: ReactNode;
  variant?: HeaderVariant;
  headingTagOverride?: HeaderHeadingTag;
  description?: ReactNode;
  actions?: ReactNode;
  counter?: ReactNode;
  info?: ReactNode;
}

const headingClasses: Record<HeaderVariant, string> = {
  h1: "text-4xl leading-none font-bold tracking-tight text-balance",
  h2: "font-sans text-sm leading-none font-medium tracking-tight text-foreground/60",
  h3: "text-xl leading-tight font-semibold tracking-tight",
};

export function Header({
  children,
  variant = "h2",
  headingTagOverride,
  description,
  actions,
  counter,
  info,
  className,
  ...props
}: HeaderProps) {
  const HeadingTag = headingTagOverride ?? variant;

  return (
    <div
      {...props}
      data-slot="header"
      className={cn(
        "flex min-w-0 justify-between gap-3",
        variant === "h1" ? "items-end" : "min-h-9 items-center",
        className,
      )}
    >
      <div className="min-w-0 flex-1">
        <div className="flex min-w-0 items-baseline gap-1.5">
          <HeadingTag className={headingClasses[variant]}>
            {children}
            {counter !== undefined && (
              <span className="ml-1 font-normal text-foreground/60">{counter}</span>
            )}
          </HeadingTag>
          {info && <span className="flex-none">{info}</span>}
        </div>
        {description && (
          <p
            className={cn(
              "text-foreground/60",
              variant === "h1"
                ? "mt-1 text-base leading-tight tracking-tight"
                : "mt-1 text-sm leading-snug",
            )}
          >
            {description}
          </p>
        )}
      </div>
      {actions && (
        <div className="flex flex-none flex-wrap items-center justify-end gap-2">{actions}</div>
      )}
    </div>
  );
}

export default Header;
