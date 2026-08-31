import { useTranslation } from "react-i18next";
import type { MuscleSlug } from "@/domain/exercises/muscles";

export function useMuscleLabels(): Record<MuscleSlug, string> {
  const { t } = useTranslation();
  return {
    trapezius: t("muscleMap.traps", "Traps"),
    deltoids: t("muscleMap.shoulders", "Shoulders"),
    chest: t("muscleMap.chest", "Chest"),
    "upper-back": t("muscleMap.upperBack", "Upper back"),
    serratus: t("muscleMap.serratus", "Serratus"),
    biceps: t("muscleMap.biceps", "Biceps"),
    triceps: t("muscleMap.triceps", "Triceps"),
    forearm: t("muscleMap.forearms", "Forearms"),
    abs: t("muscleMap.abs", "Abs"),
    obliques: t("muscleMap.obliques", "Obliques"),
    "lower-back": t("muscleMap.lowerBack", "Lower back"),
    gluteal: t("muscleMap.glutes", "Glutes"),
    quadriceps: t("muscleMap.quads", "Quads"),
    hamstring: t("muscleMap.hamstrings", "Hamstrings"),
    adductors: t("muscleMap.adductors", "Adductors"),
    "hip-flexors": t("muscleMap.hipFlexors", "Hip flexors"),
    calves: t("muscleMap.calves", "Calves"),
    tibialis: t("muscleMap.shins", "Shins"),
  };
}
