import { useTranslation } from "react-i18next";
import type { MeasuresEntry } from "@/shared/lib/types";

type UseMeasurementFieldsResult = { key: MeasurementKey; label: string };

export type MeasurementKey = keyof Omit<MeasuresEntry, "d">;

export function useMeasurementFields(): ReadonlyArray<UseMeasurementFieldsResult> {
  const { t } = useTranslation();

  return [
    { key: "chest", label: t("measurements.chest", "Chest") },
    { key: "waist", label: t("measurements.waist", "Waist") },
    { key: "hips", label: t("measurements.hips", "Hips") },
    { key: "arm", label: t("measurements.arm", "Arm") },
    { key: "thigh", label: t("measurements.thigh", "Thigh") },
  ];
}
