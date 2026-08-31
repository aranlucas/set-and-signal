import { describe, expect, test } from "vitest";
import de from "@/i18n/locales/de/translation";
import en from "@/i18n/locales/en/translation";
import es from "@/i18n/locales/es/translation";
import fr from "@/i18n/locales/fr/translation";
import hi from "@/i18n/locales/hi/translation";
import it from "@/i18n/locales/it/translation";
import ko from "@/i18n/locales/ko/translation";
import pl from "@/i18n/locales/pl/translation";
import pt from "@/i18n/locales/pt/translation";
import ru from "@/i18n/locales/ru/translation";
import tr from "@/i18n/locales/tr/translation";
import zh from "@/i18n/locales/zh/translation";

const catalogs = { en, de, es, fr, hi, it, ko, pl, pt, ru, tr, zh } satisfies Record<
  string,
  Readonly<Record<string, string>>
>;
const pluralSuffix = /_(zero|one|two|few|many|other)$/u;
const variables = (value: string): string[] =>
  [...value.matchAll(/\{\{\s*([A-Za-z][A-Za-z0-9]*)\s*(?:,[^}]*)?\}\}/gu)]
    .map((match) => match[1])
    .sort();
const canonicalKey = (key: string): string => key.replace(pluralSuffix, "");
const canonicalKeys = (catalog: Readonly<Record<string, string>>): string[] =>
  [...new Set(Object.keys(catalog).map(canonicalKey))].sort();

describe("translation catalogs", () => {
  test("keeps every supported locale in exact semantic-key parity with English", () => {
    const expected = canonicalKeys(en);
    for (const catalog of Object.values(catalogs)) {
      expect(canonicalKeys(catalog)).toEqual(expected);
      for (const key of Object.keys(catalog)) {
        expect(key).toMatch(
          /^[a-z][A-Za-z0-9]*(?:\.[A-Za-z][A-Za-z0-9]*)+(?:_(?:zero|one|two|few|many|other))?$/u,
        );
        expect(key).not.toContain(":");
        expect(key).not.toContain("::");
      }
    }
  });

  test("matches named interpolation variables in every locale", () => {
    const englishByCanonical = new Map<string, string[]>();
    for (const [key, value] of Object.entries(en)) {
      const base = canonicalKey(key);
      englishByCanonical.set(
        base,
        [...new Set([...(englishByCanonical.get(base) ?? []), ...variables(value)])].sort(),
      );
    }
    for (const catalog of Object.values(catalogs)) {
      for (const [key, value] of Object.entries(catalog)) {
        // Empty entries are explicit untranslated placeholders. i18next is configured with
        // returnEmptyString: false so these fall through to the English source catalog.
        if (value === "") continue;
        expect(variables(value)).toEqual(englishByCanonical.get(canonicalKey(key)));
      }
    }
  });

  test("uses JSON v4 plural categories, explicit zero forms, and no uncounted base fallback", () => {
    const pluralBases = new Set(
      Object.keys(en)
        .filter((key) => pluralSuffix.test(key))
        .map(canonicalKey),
    );
    expect(pluralBases.size).toBeGreaterThan(0);

    for (const [language, catalog] of Object.entries(catalogs)) {
      const catalogRecord = catalog as Readonly<Record<string, string>>;
      const expectedCategories = new Set([
        "zero",
        ...new Intl.PluralRules(language).resolvedOptions().pluralCategories,
      ]);
      for (const base of pluralBases) {
        expect(catalogRecord[base]).toBeUndefined();
        const actualCategories = new Set(
          Object.keys(catalog)
            .filter((key) => canonicalKey(key) === base)
            .map((key) => key.match(pluralSuffix)?.[1]),
        );
        expect(actualCategories).toEqual(expectedCategories);
        for (const category of actualCategories) {
          expect(catalogRecord[`${base}_${category}`]).toContain("{{count}}");
        }
      }
    }
  });

  test("contains no positional interpolation placeholders", () => {
    for (const catalog of Object.values(catalogs)) {
      for (const value of Object.values(catalog)) {
        expect(value).not.toMatch(/\{\d+\}/u);
      }
    }
  });
});
