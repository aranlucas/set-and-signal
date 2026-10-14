import base from "@aranlucas/oxforge/format-tailwind";

const config = {
  ...base,
  sortTailwindcss: {
    ...base.sortTailwindcss,
    stylesheet: "src/app/index.css",
  },
  ignorePatterns: [
    ...(base.ignorePatterns ?? []),
    ...[
      "catalog/**",
      "dist/**",
      "src/i18n/locales/**",
      "src/generated/**",
      "node_modules/**",
      "src/generated/exercises-data.ts",
      "convex/_generated/**",
      ".agent/**",
      ".agents/**",
      ".claude/**",
      ".codex/**",
      ".continue/**",
      ".cursor/**",
      ".gemini/**",
      ".opencode/**",
      ".pi/**",
      ".roo/**",
      ".windsurf/**",
    ],
  ],
};

export default config;
