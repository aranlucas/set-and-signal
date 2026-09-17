import type { ParsedImport } from "@/features/settings/import-actions";

export type SettingsSheet = { kind: "curated" } | { kind: "import"; parsed: ParsedImport };
