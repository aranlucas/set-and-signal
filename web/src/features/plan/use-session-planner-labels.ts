import { useTranslation } from "react-i18next";
import { useExerciseMetadataLabels } from "@/shared/hooks/use-exercise-metadata-labels";

export function useSessionPlannerLabels() {
  const { t } = useTranslation();
  const metadata = useExerciseMetadataLabels();

  const equipment = new Map<string, string>(
    Object.entries({
      "band anchor": t("sessionPlan.equipment.bandAnchor", "Secure band anchor"),
      "pull-up bar": t("sessionPlan.equipment.pullupBar", "Pull-up bar"),
      "dip bars": t("sessionPlan.equipment.dipBars", "Dip bars"),
      "chest press machine": t("sessionPlan.equipment.chestPress", "Chest press machine"),
      "shoulder press machine": t("sessionPlan.equipment.shoulderPress", "Shoulder press machine"),
      "row machine": t("sessionPlan.equipment.row", "Row machine"),
      "lat pulldown machine": t("sessionPlan.equipment.pulldown", "Lat pulldown machine"),
      "leg extension machine": t("sessionPlan.equipment.legExtension", "Leg extension machine"),
      "lying leg curl machine": t("sessionPlan.equipment.lyingLegCurl", "Lying leg curl machine"),
      "seated leg curl machine": t(
        "sessionPlan.equipment.seatedLegCurl",
        "Seated leg curl machine",
      ),
      "leg press machine": t("sessionPlan.equipment.legPress", "Leg press machine"),
      "calf raise machine": t("sessionPlan.equipment.calfRaise", "Calf raise machine"),
      treadmill: t("sessionPlan.equipment.treadmill", "Treadmill"),
      "outdoor route": t("sessionPlan.equipment.outdoorRoute", "Outdoor running route"),
      "added weight": t(
        "sessionPlan.equipment.addedWeight",
        "Added weight for bodyweight exercises",
      ),
    } satisfies Record<string, string>),
  );

  const movements = new Map<string, string>(
    Object.entries({
      squat: t("sessionPlan.movement.squat", "squat / leg press"),
      hinge: t("sessionPlan.movement.hinge", "hip hinge"),
      chestPress: t("sessionPlan.movement.chestPress", "chest press"),
      overheadPress: t("sessionPlan.movement.overheadPress", "overhead press"),
      row: t("sessionPlan.movement.row", "horizontal pull"),
      pulldown: t("sessionPlan.movement.pulldown", "vertical pull"),
      curl: t("sessionPlan.movement.curl", "elbow flexion"),
      triceps: t("sessionPlan.movement.triceps", "elbow extension"),
      lateralRaise: t("sessionPlan.movement.lateralRaise", "lateral shoulder raise"),
      kneeExtension: t("sessionPlan.movement.kneeExtension", "knee extension"),
      kneeFlexion: t("sessionPlan.movement.kneeFlexion", "knee flexion"),
      calves: t("sessionPlan.movement.calves", "calf raise"),
      core: t("sessionPlan.movement.core", "trunk flexion"),
      legRaise: t("sessionPlan.movement.legRaise", "leg raise"),
      cardio: t("sessionPlan.movement.cardio", "cardio duration"),
    } satisfies Record<string, string>),
  );

  return {
    equipment: (value: string) => equipment.get(value) ?? metadata.equipment(value),
    movements,
  };
}
