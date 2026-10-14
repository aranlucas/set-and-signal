import type { OxfmtConfig } from "oxfmt";
import base from "@aranlucas/oxforge/format-tailwind";
import web from "./web/oxfmt.config.ts";

const config: OxfmtConfig = {
  ...base,
  sortTailwindcss: { ...base.sortTailwindcss, stylesheet: "web/src/app/index.css" },
  ignorePatterns: [
    ...(base.ignorePatterns ?? []),
    ...(web.ignorePatterns ?? []).map((pattern) => `web/${pattern}`),
    // Preserve the compact catalog embedded verbatim in the Go binary.
    "internal/exercises/catalog.json",
  ],
};

export default config;
