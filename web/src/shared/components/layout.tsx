import type { ComponentPropsWithoutRef, ReactNode } from "react";
import Icon from "@/shared/components/Icon";
import type { IconName } from "@/shared/components/Icon";
import { cn } from "@/shared/lib/utils";
import { Button } from "@/shared/ui/button";

export function PageHeader({ className, ...props }: ComponentPropsWithoutRef<"header">) {
  return (
    <header
      className={cn(
        "mt-2 mb-4.5 flex items-end justify-between gap-3 border-b border-border pb-3.5",
        className,
      )}
      {...props}
    />
  );
}

export function PageTitle({ className, children, ...props }: ComponentPropsWithoutRef<"h1">) {
  return (
    <h1
      className={cn("text-4xl leading-none font-bold tracking-tight text-balance", className)}
      {...props}
    >
      {children}
    </h1>
  );
}

export function Section({
  title,
  footer,
  children,
  className = "",
}: {
  title?: ReactNode;
  footer?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={cn("mb-5.5", className)}>
      {title && (
        <h2 className="block px-1 pb-2 text-sm font-normal tracking-tight text-foreground/60">
          {title}
        </h2>
      )}
      <div className="overflow-hidden rounded-lg border border-border bg-card">{children}</div>
      {footer && <p className="px-1 pt-2 text-sm leading-snug text-foreground/60">{footer}</p>}
    </section>
  );
}

export interface RowProps {
  icon?: IconName;
  iconTint?: string;
  title: ReactNode;
  subtitle?: ReactNode;
  value?: ReactNode;
  accessory?: "none" | "chevron" | "check";
  onClick?: () => void;
  danger?: boolean;
  children?: ReactNode;
  className?: string;
}

export function Row({
  icon,
  iconTint,
  title,
  subtitle,
  value,
  accessory = "none",
  onClick,
  danger,
  children,
  className = "",
}: RowProps) {
  const content = (
    <>
      {icon && (
        <span
          data-row-icon
          className="flex size-7 shrink-0 items-center justify-center rounded-sm text-lg text-white"
          style={{ backgroundColor: iconTint || "var(--primary)" }}
        >
          <Icon name={icon} />
        </span>
      )}
      <span className="flex min-w-0 flex-1 flex-col gap-px">
        <span className="text-lg leading-tight tracking-tight">{title}</span>
        {subtitle && <span className="text-sm leading-snug text-foreground/60">{subtitle}</span>}
      </span>
      {children}
      {value != null && (
        <span className="min-w-0 flex-auto overflow-hidden text-right text-lg tracking-tight text-ellipsis whitespace-nowrap text-foreground/60">
          {value}
        </span>
      )}
      {accessory === "chevron" && (
        <Icon name="chevronRight" className="shrink-0 text-base text-foreground" />
      )}
      {accessory === "check" && <Icon name="check" className="shrink-0 text-lg text-primary" />}
    </>
  );

  const rowClassName = cn(
    "relative flex min-h-12 w-full items-center gap-3 bg-transparent px-3.5 py-3 text-left text-foreground before:pointer-events-none before:absolute before:top-0 before:right-0 before:left-3.5 before:hidden before:h-px before:bg-border/60 [&+&]:before:block [&:has([data-row-icon])+&:has([data-row-icon])]:before:left-14",
    onClick && "active:bg-muted",
    danger && "text-destructive",
    className,
  );

  return onClick ? (
    <Button variant="plain" type="button" className={rowClassName} onClick={onClick}>
      {content}
    </Button>
  ) : (
    <div className={rowClassName}>{content}</div>
  );
}
