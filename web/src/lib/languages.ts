export const LANGUAGES = {
  en: { label: "English", locale: "en-GB", hasExercises: true },
  de: { label: "Deutsch", locale: "de-DE", hasExercises: false },
  es: { label: "Español", locale: "es-ES", hasExercises: true },
  fr: { label: "Français", locale: "fr-FR", hasExercises: true },
  it: { label: "Italiano", locale: "it-IT", hasExercises: true },
  pt: { label: "Português", locale: "pt-PT", hasExercises: false },
  pl: { label: "Polski", locale: "pl-PL", hasExercises: true },
  tr: { label: "Türkçe", locale: "tr-TR", hasExercises: true },
  ru: { label: "Русский", locale: "ru-RU", hasExercises: true },
  zh: { label: "中文", locale: "zh-CN", hasExercises: true },
  ko: { label: "한국어", locale: "ko-KR", hasExercises: true },
  hi: { label: "हिन्दी", locale: "hi-IN", hasExercises: true },
} as const;

export type Language = keyof typeof LANGUAGES;

const isLanguage = (language: string): language is Language => Object.hasOwn(LANGUAGES, language);

export const normalizeLanguage = (language: string | null | undefined): Language =>
  language && isLanguage(language) ? language : "en";
