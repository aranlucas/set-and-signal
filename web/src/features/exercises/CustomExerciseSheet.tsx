import { useTranslation } from "react-i18next";
import { useForm, useWatch } from "react-hook-form";
import { valibotResolver } from "@hookform/resolvers/valibot";
import { useExerciseMetadataLabels } from "@/shared/hooks/use-exercise-metadata-labels";
import { EXIDX, BODYPARTS, allExercises } from "@/domain/exercises/exercises";
import { uid } from "@/shared/lib/format";
import { toast } from "@/shared/lib/toast";
import { Button } from "@/shared/ui/button";
import { Field, FieldError, FieldGroup, FieldLabel, FieldSet } from "@/shared/ui/field";
import { Input } from "@/shared/ui/input";
import { Textarea } from "@/shared/ui/textarea";
import Icon from "@/shared/components/Icon";
import type { CustomEx, SheetClose } from "@/shared/lib/types";
import { getAppState, updateAppState, type SheetEx } from "@/features/exercises/sheet-shared";
import { createCustomExerciseFormSchema } from "@/shared/lib/form-schemas";

export function CustomExerciseForm({
  existingExercise,
  prefillName,
  onDone,
  onDelete,
  close,
}: {
  existingExercise: CustomEx | null;
  prefillName?: string;
  onDone?: (exercise: SheetEx | null) => void;
  onDelete?: () => void;
  close: SheetClose;
}) {
  const { t } = useTranslation();
  const metadata = useExerciseMetadataLabels();
  const {
    handleSubmit,
    control,
    register,
    setValue,
    formState: { errors },
  } = useForm<{
    name: string;
    bodyPart: string;
    description: string;
  }>({
    defaultValues: {
      name: existingExercise ? existingExercise.n : prefillName || "",
      bodyPart: existingExercise ? existingExercise.bp : "",
      description: existingExercise ? existingExercise.desc || "" : "",
    },
    resolver: valibotResolver(createCustomExerciseFormSchema(t)),
  });
  const bodyPart = useWatch({ control, name: "bodyPart" });

  const saveExercise = (values: { name: string; bodyPart: string; description: string }) => {
    const trimmedName = values.name.trim();
    const duplicateExercise = allExercises(getAppState()).find(
      (exercise) =>
        exercise.n.toLowerCase() === trimmedName.toLowerCase() &&
        exercise.id !== existingExercise?.id,
    );
    if (duplicateExercise) {
      toast(
        t("customExercise.alreadyExists", "“{{name}}” already exists", {
          name: duplicateExercise.n,
        }),
      );
      return;
    }

    const trimmedDescription = values.description.trim().slice(0, 1000);
    const exerciseId = existingExercise ? existingExercise.id : "c" + uid();
    if (existingExercise) {
      updateAppState((state) => {
        const customExercise = state.customEx.find((exercise) => exercise.id === exerciseId);
        if (customExercise) {
          customExercise.n = trimmedName;
          customExercise.bp = values.bodyPart;
          customExercise.desc = trimmedDescription;
        }
      });
    } else {
      updateAppState((state) => {
        state.customEx.push({
          id: exerciseId,
          n: trimmedName,
          bp: values.bodyPart,
          desc: trimmedDescription,
          tg: "",
          eq: "custom",
          custom: true,
        });
      });
    }
    void close();
    toast(
      existingExercise
        ? t("customExercise.saved", "Saved")
        : t("customExercise.created", "“{{name}}” created", { name: trimmedName }),
    );
    onDone?.(EXIDX[exerciseId] ?? null);
  };

  return (
    <form onSubmit={handleSubmit(saveExercise)}>
      <h3>
        {existingExercise
          ? t("customExercise.editCustomExercise", "Edit custom exercise")
          : t("customExercise.createOwnExercise", "Create your own exercise")}
      </h3>
      <div className="mb-3 text-sm leading-snug text-foreground/60">
        {t(
          "customExercise.namePickBodyPartBehaves",
          "Name it and pick a body part — it behaves like any other exercise, just without an animation.",
        )}
      </div>
      <FieldGroup className="gap-3">
        <Field data-invalid={!!errors.name}>
          <FieldLabel htmlFor="custom-exercise-name">
            {t("customExercise.exerciseName", "Exercise name")}
          </FieldLabel>
          <Input
            id="custom-exercise-name"
            aria-invalid={!!errors.name}
            placeholder={t("customExercise.exerciseName", "Exercise name")}
            {...register("name")}
          />
          <FieldError errors={[errors.name]} />
        </Field>
        <Field data-invalid={!!errors.bodyPart}>
          <FieldLabel id="custom-exercise-body-part">
            {t("customExercise.pickBodyPart", "Pick a body part")}
          </FieldLabel>
          <FieldSet
            aria-labelledby="custom-exercise-body-part"
            className="scrollbar-none flex-row gap-2 overflow-x-auto pb-0.5"
          >
            {BODYPARTS.map((option) => (
              <Button
                variant="plain"
                key={option}
                type="button"
                aria-pressed={bodyPart === option}
                className={
                  bodyPart === option
                    ? "shrink-0 rounded-full bg-primary px-3 py-1.5 text-sm font-medium tracking-tight text-primary-foreground"
                    : "shrink-0 rounded-full bg-card px-3 py-1.5 text-sm tracking-tight text-foreground"
                }
                onClick={() =>
                  setValue("bodyPart", option, { shouldDirty: true, shouldValidate: true })
                }
              >
                {metadata.bodyPart(option)}
              </Button>
            ))}
          </FieldSet>
          {bodyPart === "cardio" && (
            <div className="flex items-center gap-1.5 text-sm leading-snug text-muted-foreground">
              <Icon name="figureRun" className="text-sm" />
              {t(
                "customExercise.cardioExercisesLogTimeSpeed",
                "Cardio exercises log time + speed instead of weight × reps.",
              )}
            </div>
          )}
          <FieldError errors={[errors.bodyPart]} />
        </Field>
        <Field data-invalid={!!errors.description}>
          <FieldLabel htmlFor="custom-exercise-description">
            {t("customExercise.descriptionOptional", "Description (optional)")}
          </FieldLabel>
          <Textarea
            id="custom-exercise-description"
            aria-invalid={!!errors.description}
            rows={4}
            maxLength={1000}
            placeholder={t(
              "customExercise.descriptionOptionalSetupCuesAnything",
              "Description (optional) — setup, cues, anything you want to remember",
            )}
            {...register("description")}
          />
          <FieldError errors={[errors.description]} />
        </Field>
        <Field>
          <Button type="submit" variant="default">
            {existingExercise
              ? t("workout.completion.save", "Save")
              : t("customExercise.createExercise", "Create exercise")}
          </Button>
          {existingExercise && (
            <Button
              type="button"
              variant="destructive"
              onClick={() => {
                void close();
                onDelete?.();
              }}
            >
              <Icon name="trash" />
              {t("customExercise.deleteExercise", "Delete exercise")}
            </Button>
          )}
        </Field>
      </FieldGroup>
    </form>
  );
}
