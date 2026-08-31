import { useTranslation } from "react-i18next";

export function useEffortLabels() {
  const { t } = useTranslation();
  return {
    rir: t("effort.rir", "RIR"),
    rpe: t("effort.rpe", "RPE"),
    feelings: [
      t("effort.nothingLeftWentFailure", "Nothing left — went to failure"),
      t("effort.oneMoreRepTank", "One more rep in the tank"),
      t("effort.twoMoreReps", "Two more reps"),
      t("effort.threeMoreReps", "Three more reps"),
      t("effort.easyWarmTerritory", "Easy — warm-up territory"),
    ],
  };
}
