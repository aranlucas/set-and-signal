// Tape-measure tracking (Hevy-Pro-style body metrics): chest, waist, hips, arm, thigh.
// Everything is optional — you log the tapes you actually take — and today's entry is
// merged, not duplicated, so re-saving after a mistype doesn't stack rows.
import { useTranslation } from "react-i18next";
import { Controller, useForm } from "react-hook-form";
import { valibotResolver } from "@hookform/resolvers/valibot";
import { useStore } from "@/app/store/useStore";
import { fmtDate, fmtNum, todayISO } from "@/shared/lib/format";
import { toast } from "@/shared/lib/toast";
import { Button } from "@/shared/ui/button";
import { Field } from "@/shared/ui/field";
import Icon from "@/shared/components/Icon";
import { Stepper } from "@/shared/components/Stepper";
import type { MeasuresEntry, SheetClose } from "@/shared/lib/types";
import { updateAppState } from "@/features/exercises/sheet-shared";
import { useMeasurementFields, type MeasurementKey } from "@/shared/hooks/use-measurement-fields";
import { createMeasurementsFormSchema } from "@/shared/lib/form-schemas";

export function MeasuresSheet({ close }: { close: SheetClose }) {
  const { t } = useTranslation();
  const fields = useMeasurementFields();
  const measures = useStore((state) => state.appState.measures);
  const todayEntry = (measures || []).find((entry) => entry.d === todayISO());
  const latest = (measures || []).at(-1) ?? null;
  const atLeastOneMessage = t("measurements.enterAtLeastOne", "Enter at least one measurement");
  const { control, handleSubmit } = useForm<Partial<Record<MeasurementKey, number>>>({
    defaultValues: Object.fromEntries(
      fields.map((field) => [field.key, todayEntry?.[field.key] ?? latest?.[field.key]]),
    ),
    resolver: valibotResolver(createMeasurementsFormSchema(t)),
  });

  const save = async (values: Partial<Record<MeasurementKey, number>>) => {
    const filled = fields.filter((field) => values[field.key] != null);
    updateAppState((draft) => {
      draft.measures = draft.measures || [];
      const rounded = Object.fromEntries(
        filled.map((field) => [field.key, Math.round(values[field.key]! * 10) / 10]),
      ) as Omit<MeasuresEntry, "d">;
      const date = todayISO();
      const at = draft.measures.findIndex((entry) => entry.d === date);
      if (at >= 0) draft.measures[at] = { d: date, ...rounded };
      else draft.measures.push({ d: date, ...rounded });
      draft.measures.sort((left, right) => (left.d < right.d ? -1 : 1));
    });
    await close();
    toast(t("measurements.saved", "Measurements saved"));
  };

  const del = (date: string) =>
    updateAppState((draft) => {
      draft.measures = (draft.measures || []).filter((entry) => entry.d !== date);
    });
  const recent = [...(measures || [])].reverse().slice(0, 3);

  return (
    <>
      <h3>{t("measurements.log", "Log measurements")}</h3>
      <div className="text-sm leading-snug text-foreground/60">
        {t(
          "measurements.description",
          "Tape measure in cm — log whichever ones you take. Today's entry updates in place.",
        )}
      </div>
      <form onSubmit={handleSubmit(save, () => toast(atLeastOneMessage))}>
        <div className="mt-3.5 grid grid-cols-2 gap-x-3 gap-y-2.5">
          {fields.map((field) => (
            <Controller
              key={field.key}
              control={control}
              name={field.key}
              render={({ field: formField }) => (
                <Stepper
                  label={field.label}
                  unit="cm"
                  decimal
                  step={0.5}
                  value={formField.value}
                  onChange={(value) =>
                    formField.onChange(value == null || value <= 0 ? undefined : value)
                  }
                />
              )}
            />
          ))}
        </div>
        <Field className="mt-3.5">
          <Button type="submit" variant="default">
            {t("common.save", "Save")}
          </Button>
        </Field>
      </form>
      {recent.length > 0 && (
        <>
          <h4 className="my-5.5 mb-2 px-1 text-sm font-normal tracking-tight text-foreground/60">
            {t("measurements.recent", "Recent measurements")}
          </h4>
          <div className="flex flex-col gap-0">
            {recent.map((entryMeasure) => (
              <div
                key={entryMeasure.d}
                className="flex items-center justify-between gap-3 border-b border-border/60 px-0.5 py-2.5"
              >
                <span className="min-w-0 shrink-0 text-sm leading-snug text-foreground/60">
                  {fmtDate(t, entryMeasure.d, true)}
                </span>
                <span className="flex min-w-0 items-center gap-2 text-sm tabular-nums">
                  {fields
                    .filter((field) => entryMeasure[field.key] != null)
                    .map((field) => (
                      <span key={field.key} className="whitespace-nowrap">
                        <span className="text-muted-foreground">{field.label} </span>
                        <b>{fmtNum(entryMeasure[field.key]!)}</b>
                      </span>
                    ))}
                  <Button
                    variant="plain"
                    type="button"
                    className="flex h-7.5 w-8 shrink-0 items-center justify-center rounded-lg bg-card text-base text-destructive"
                    onClick={() => del(entryMeasure.d)}
                    aria-label={t("common.delete", "Delete")}
                  >
                    <Icon name="trash" />
                  </Button>
                </span>
              </div>
            ))}
          </div>
        </>
      )}
    </>
  );
}
