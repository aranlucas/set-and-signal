import type english from "@/i18n/locales/en/translation";

declare module "i18next" {
  interface CustomTypeOptions {
    defaultNS: "translation";
    strictKeyChecks: true;
    returnNull: false;
    resources: {
      translation: typeof english;
      exercises: Record<string, string[]>;
    };
  }
}
