export const ACCENT_NAMES = [
  "lime",
  "sky",
  "orange",
  "violet",
  "pink",
  "red",
  "teal",
  "gold",
] as const;

export type Accent = (typeof ACCENT_NAMES)[number];

export const DEFAULT_ACCENT: Accent = "orange";

const ACCENT_SET = new Set<string>(ACCENT_NAMES);

export const isAccent = (value: string): value is Accent => ACCENT_SET.has(value);
