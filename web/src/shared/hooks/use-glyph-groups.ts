import { useTranslation } from "react-i18next";
import { GLYPH_GROUPS, type GlyphGroupId } from "@/domain/exercises/glyphs";

export function useGlyphGroups() {
  const { t } = useTranslation();
  const labels: Record<GlyphGroupId, string> = {
    strength: t("routine.glyphGroup.strength", "Strength"),
    equipment: t("routine.glyphGroup.equipment", "Equipment"),
    cardio: t("routine.glyphGroup.cardio", "Cardio"),
    recovery: t("routine.glyphGroup.recovery", "Recovery"),
  };
  return GLYPH_GROUPS.map((group) => ({
    id: group.id,
    items: group.items,
    label: labels[group.id],
  }));
}
