import { cn } from "@/shared/lib/utils";

interface BrandMarkProps {
  className?: string;
  title?: string;
}

/** A registration rail and three signal cuts: the compact Set & Signal mark. */
export default function BrandMark({ className, title }: BrandMarkProps) {
  return (
    <svg
      viewBox="0 0 32 32"
      fill="none"
      role={title ? "img" : undefined}
      aria-hidden={title ? undefined : true}
      className={cn("shrink-0", className)}
    >
      {title ? <title>{title}</title> : null}
      <path d="M8 4v24M4 8h5M4 24h5" stroke="currentColor" strokeWidth="2.5" />
      <path d="M11 8h17M11 16h11M11 24h17" stroke="currentColor" strokeWidth="2.5" />
      <path d="M25 5h4v4M25 27h4v-4" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  );
}
