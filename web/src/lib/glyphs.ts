// Routine glyphs.
//
// Routines used to store a literal emoji in `r.emoji` ('💪', '🦵', …). The
// redesign stores an icon key instead, but the field keeps its name so existing
// synced state stays readable by both builds — no migration, no lost routines.
//
// glyphOf() accepts either form: a known icon key passes through, a legacy emoji
// is mapped, and anything unrecognised falls back to the default.
import { ICON_NAMES } from "../components/icon-names";
import type { IconName } from "../components/Icon";

export type GlyphGroupId = "strength" | "equipment" | "cardio" | "recovery";

export const DEFAULT_GLYPH = "figureStrength";

// The picker offers glyphs that describe a TRAINING DAY — the split, the kit, or
// the kind of session. The first version offered trophy/medal/crown/flag/star,
// which say how a workout went, not what it is; nobody names a routine "crown".
// Grouped, because 20 loose icons is a wall — you scan the group first.
export const GLYPH_GROUPS = [
  {
    id: "strength",
    items: ["figureStrength", "arm", "abs", "legs", "pullup"],
  },
  {
    id: "equipment",
    items: ["dumbbell", "barbell", "kettlebell", "plate", "machine"],
  },
  {
    id: "cardio",
    items: ["figureRun", "bike", "swim", "boxing", "timer"],
  },
  {
    id: "recovery",
    items: ["stretch", "moon", "heart", "flame", "bolt"],
  },
] satisfies { id: GlyphGroupId; items: IconName[] }[];
// Legacy emoji → icon key, so routines created before the redesign keep a
// sensible glyph instead of all collapsing onto the default.
const LEGACY: Record<string, IconName> = {
  "💪": "arm",
  "🦾": "arm",
  "🫸": "figureStrength",
  "🫷": "pullup",
  "🏋️": "dumbbell",
  "🏋": "dumbbell",
  "🏋️‍♀️": "dumbbell",
  "🦵": "legs",
  "🍑": "legs",
  "🔥": "flame",
  "⚡": "bolt",
  "💥": "bolt",
  "🧨": "bolt",
  "😤": "flame",
  "🏃": "figureRun",
  "🏃‍♀️": "figureRun",
  "🚴": "bike",
  "🏊": "swim",
  "🤸": "stretch",
  "🧘": "stretch",
  "🧘‍♀️": "stretch",
  "🥊": "boxing",
  "🧗": "pullup",
  "⛰️": "figureRun",
  "🏔️": "figureRun",
  "🚀": "bolt",
  "🎯": "target",
  "🏆": "trophy",
  "🥇": "medal",
  "⭐": "star",
  "🌟": "star",
  "👑": "crown",
  "🛡️": "shield",
  "⚔️": "shield",
  "❤️‍🔥": "heart",
  "🦍": "kettlebell",
  "🐂": "barbell",
  "🐻": "kettlebell",
  "🦁": "boxing",
  "🐺": "figureRun",
  "🦈": "swim",
  "🤖": "machine",
};

const isIconName = (value: string): value is IconName =>
  ICON_NAMES.some((iconName) => iconName === value);

export function glyphOf(v: string | null | undefined): IconName {
  if (!v) return DEFAULT_GLYPH;
  if (isIconName(v)) return v;
  if (LEGACY[v]) return LEGACY[v];
  // strip variation selectors / ZWJ sequences and retry the base emoji
  // Emoji need code-point iteration here to strip variation selectors safely.
  // oxlint-disable-next-line typescript/no-misused-spread
  const base = [...v].find((c) => c !== "️" && c !== "‍");
  return (base && LEGACY[base]) || DEFAULT_GLYPH;
}
