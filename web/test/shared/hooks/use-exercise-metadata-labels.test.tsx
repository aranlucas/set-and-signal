import { createInstance, type i18n as I18n } from "i18next";
import { renderToStaticMarkup } from "react-dom/server";
import { I18nextProvider } from "react-i18next";
import { afterEach, describe, expect, it } from "vitest";
import { BODYPARTS, EXDB } from "@/domain/exercises/exercises";
import { CURATED } from "@/features/plan/curated";
import { i18n, setLang } from "@/i18n/i18n";
import { LANGUAGES } from "@/i18n/languages";
import english from "@/i18n/locales/en/translation";
import { useExerciseMetadataLabels } from "@/shared/hooks/use-exercise-metadata-labels";

type LabelKind = keyof ReturnType<typeof useExerciseMetadataLabels>;

type MetadataLabelsProps = { kind: LabelKind; values: string[] };

function MetadataLabels({ kind, values }: MetadataLabelsProps) {
  const labels = useExerciseMetadataLabels();

  return <>{values.map((value) => labels[kind](value)).join(" | ")}</>;
}

function renderLabels(kind: LabelKind, values: string[], translations: I18n = i18n) {
  return renderToStaticMarkup(
    <I18nextProvider i18n={translations}>
      <MetadataLabels kind={kind} values={values} />
    </I18nextProvider>,
  );
}

afterEach(async () => {
  await setLang("en");
});

describe("exercise metadata labels", () => {
  it.each(Object.keys(LANGUAGES))(
    "translates body-part names used as secondary muscles in %s",
    async (language) => {
      await setLang(language);

      expect(renderLabels("muscle", ["back", "chest", "shoulders", "pectorals"])).toBe(
        [
          i18n.t("exercise.bodyPart.back"),
          i18n.t("exercise.bodyPart.chest"),
          i18n.t("exercise.bodyPart.shoulders"),
          i18n.t("exercise.muscle.pectorals"),
        ].join(" | "),
      );
    },
  );

  it.each(Object.keys(LANGUAGES))(
    "translates body parts used as custom exercise targets in %s",
    async (language) => {
      await setLang(language);

      const customExercises = BODYPARTS.map((bodyPart) => ({ tg: "", bp: bodyPart }));

      expect(
        renderLabels(
          "muscle",
          customExercises.map((exercise) => exercise.tg || exercise.bp),
        ),
      ).toBe(renderLabels("bodyPart", BODYPARTS));
    },
  );

  it("resolves every catalog value through its matching metadata lookup", async () => {
    const translations = createInstance();
    await translations.init({
      lng: "en",
      resources: {
        en: {
          translation: Object.fromEntries(
            Object.entries(english).map(([key, value]) => [key, `translated:${value}`]),
          ),
        },
      },
      interpolation: { escapeValue: false },
      react: { useSuspense: false },
    });

    const metadata: Record<LabelKind, Set<string>> = {
      bodyPart: new Set(EXDB.map((exercise) => exercise.bp)),
      equipment: new Set([
        "custom",
        ...EXDB.map((exercise) => exercise.eq),
        ...CURATED.flatMap((plan) => plan.eq),
      ]),
      muscle: new Set(EXDB.flatMap((exercise) => [exercise.tg, ...exercise.sm])),
    };

    for (const kind of ["bodyPart", "equipment", "muscle"] as const) {
      const labels = renderLabels(kind, [...metadata[kind]], translations).split(" | ");
      expect(labels.filter((label) => !label.startsWith("translated:"))).toEqual([]);
    }
  });

  it.each(["bodyPart", "equipment", "muscle"] as const)(
    "preserves unknown and empty %s values",
    async (kind) => {
      await setLang("es");

      expect(renderLabels(kind, ["my custom metadata", ""])).toBe("my custom metadata | ");
    },
  );
});
