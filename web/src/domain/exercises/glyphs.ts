// Routine icon keys and picker groups.
import { ICON_NAMES } from "@/shared/components/icon-names";
import type { IconName } from "@/shared/components/Icon";

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
const isIconName = (value: string): value is IconName =>
  ICON_NAMES.some((iconName) => iconName === value);

export function glyphOf(value: string | null | undefined): IconName {
  return value && isIconName(value) ? value : DEFAULT_GLYPH;
}
