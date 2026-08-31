// The official extractor owns the checked-in UI translation modules. Exercise instructions live
// under catalog/ and are sharded separately by scripts/build-instructions.mjs.
export default {
  locales: ["en", "de", "es", "fr", "it", "pt", "pl", "tr", "ru", "zh", "ko", "hi"],
  extract: {
    input: ["src/**/*.{ts,tsx}"],
    ignore: ["src/**/*.test.{ts,tsx}", "src/i18n/locales/**"],
    output: "src/i18n/locales/{{language}}/{{namespace}}.ts",
    outputFormat: "ts",
    primaryLanguage: "en",
    defaultNS: "translation",
    keySeparator: false,
    removeUnusedKeys: false,
    functions: ["t", "*.t", "translate", "reason"],
  },
};
