import { getAppState } from "@/features/exercises/sheet-shared";

export function bwDeltaColor(delta: number | null | undefined, currentW: number): string {
  if (!delta) return "var(--muted-foreground)";
  const targetW = getAppState().targetW;
  if (!targetW) return "var(--foreground)";
  const up = targetW > currentW;
  return delta > 0 === up ? "var(--primary)" : "var(--destructive)";
}
