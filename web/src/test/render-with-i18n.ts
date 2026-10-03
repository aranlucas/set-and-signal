import { createElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { createInstance } from "i18next";
import { I18nextProvider } from "react-i18next";

const translations = createInstance();

void translations.init({
  lng: "en",
  fallbackLng: "en",
  resources: { en: { translation: {} } },
  initAsync: false,
  interpolation: { escapeValue: false },
  react: { useSuspense: false },
});

/** Exercise the real translation provider while testing documented English fallbacks. */
export function renderWithTranslations(element: ReactNode): string {
  return renderToStaticMarkup(createElement(I18nextProvider, { i18n: translations }, element));
}
