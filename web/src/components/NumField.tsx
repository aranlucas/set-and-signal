import { useState } from "react";
import type { InputHTMLAttributes } from "react";
import { Input } from "./ui/input";
import { cn } from "../lib/utils";

// Numeric input accepting "," as decimal separator. Keeps a local string draft
// while focused so partial input like "33," survives on mobile keypads.
export function NumberField({
  value,
  onChange,
  decimal = true,
  nullable = false,
  className = "",
  ...rest
}: {
  value: number | null | undefined;
  onChange: (n: number | null) => void;
  decimal?: boolean;
  nullable?: boolean;
  className?: string;
} & Omit<InputHTMLAttributes<HTMLInputElement>, "value" | "onChange" | "type">) {
  const [draft, setDraft] = useState<string | null>(null);

  const commit = (raw: string) => {
    let sanitizedValue = raw.replaceAll(",", ".").replaceAll(/[^0-9.]/g, "");
    const decimalIndex = sanitizedValue.indexOf(".");
    if (decimalIndex !== -1) {
      sanitizedValue = decimal
        ? sanitizedValue.slice(0, decimalIndex + 1) +
          sanitizedValue.slice(decimalIndex + 1).replaceAll(".", "")
        : sanitizedValue.slice(0, decimalIndex);
    }
    const numericValue =
      sanitizedValue === "" || sanitizedValue === "."
        ? nullable
          ? null
          : 0
        : Math.max(0, parseFloat(sanitizedValue));
    setDraft(sanitizedValue);
    onChange(numericValue);
  };

  return (
    <Input
      type="text"
      inputMode={decimal ? "decimal" : "numeric"}
      className={cn(
        "w-full min-w-0 border-0 bg-transparent p-0 text-center text-lg font-medium tracking-tight outline-none [&::-webkit-inner-spin-button]:hidden",
        className,
      )}
      value={draft ?? value ?? ""}
      onFocus={(event) => event.target.select()}
      onChange={(event) => commit(event.target.value)}
      onBlur={() => setDraft(null)}
      {...rest}
    />
  );
}

export default NumberField;
