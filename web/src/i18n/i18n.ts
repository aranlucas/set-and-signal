// Application internationalization bootstrap. The bundled English catalog defines the typed UI
// contract; other UI languages remain lazy-loaded. Exercise instructions use their own sharded
// static-data loader so opening one detail never loads a whole locale into i18next.
import { createInstance } from "i18next";
import resourcesToBackend from "i18next-resources-to-backend";
import { initReactI18next } from "react-i18next";
import english from "@/i18n/locales/en/translation";
import { LANGUAGES, normalizeLanguage } from "@/i18n/languages";

type ResourcePack = { default: Readonly<Record<string, string | string[]>> };
const resourcePacks = import.meta.glob<ResourcePack>("./locales/*/translation.ts");

// Every UI language is its own lazy module; missing packs fall back to bundled English.
export const i18n = createInstance()
  .use(initReactI18next)
  .use(
    resourcesToBackend((language: string, namespace: string) => {
      const loadResource = resourcePacks[`./locales/${language}/${namespace}.ts`];
      return loadResource ? loadResource().then((pack) => pack.default) : Promise.resolve({});
    }),
  );

const i18nReady = i18n.init({
  resources: {
    en: { translation: english },
  },
  partialBundledLanguages: true,
  fallbackLng: "en",
  supportedLngs: Object.keys(LANGUAGES),
  ns: ["translation"],
  defaultNS: "translation",
  returnEmptyString: false,
  interpolation: { escapeValue: false },
  react: { useSuspense: false },
});

export async function setLang(language: string): Promise<void> {
  await i18nReady;
  await i18n.changeLanguage(normalizeLanguage(language));
}
