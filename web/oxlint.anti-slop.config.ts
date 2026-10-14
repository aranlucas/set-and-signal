import { ignorePatterns, oxforge, rules } from "@aranlucas/oxforge";

const config = {
  categories: { correctness: "off" },
  plugins: ["oxc"],
  jsPlugins: oxforge({ typeAware: false, namedTypes: false }).jsPlugins,
  rules: { ...rules.antiSlop, "oxc/no-accumulating-spread": "error" },
  ignorePatterns: [...ignorePatterns, "tools/oxlint/effect/**"],
};

export default config;
