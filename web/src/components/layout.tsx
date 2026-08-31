import type { ReactNode } from "react";
import Icon from "./Icon";
import type { IconName } from "./Icon";
import { cn } from "../lib/utils";

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
      <div className="proof-panel overflow-hidden rounded-lg bg-card">{children}</div>
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
          className="proof-row-icon flex size-7 shrink-0 items-center justify-center rounded-sm text-lg text-white"
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
    "proof-row relative flex min-h-11.5 w-full items-center gap-3 bg-transparent px-3.5 py-3 text-left text-foreground before:pointer-events-none before:absolute before:top-0 before:right-0 before:left-3.5 before:hidden before:h-px before:bg-border/60 [&+&]:before:block [&:has([data-row-icon])+&:has([data-row-icon])]:before:left-14",
    onClick && "active:bg-muted",
    danger && "text-destructive",
    className,
  );

  return onClick ? (
    <button type="button" className={rowClassName} onClick={onClick}>
      {content}
    </button>
  ) : (
    <div className={rowClassName}>{content}</div>
  );
}
