import type english from "../locales/en/translation";

type PluralSuffix = "zero" | "one" | "two" | "few" | "many" | "other";
type PluralBase<Key> = Key extends `${infer Base}_${PluralSuffix}` ? Base : never;

export type TranslationKey = keyof typeof english | PluralBase<keyof typeof english>;
