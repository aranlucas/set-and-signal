import type english from "@/i18n/locales/en/translation";

type PluralSuffix = "zero" | "one" | "two" | "few" | "many" | "other";
type PluralBase<Key> = Key extends `${infer Base}_${PluralSuffix}` ? Base : never;

export type TranslationKey = keyof typeof english | PluralBase<keyof typeof english>;
