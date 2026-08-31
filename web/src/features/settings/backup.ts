import { DEFAULT_APP_STATE } from "@/domain/training/default-state";
import { appStatePatch, parsePayload } from "@/shared/lib/schemas";
import type { AppState } from "@/shared/lib/types";

// Backups are full state exports, unlike a sync patch. Keep these fields required so an
// unrelated JSON file cannot be accepted as an empty profile, while appStatePatch owns the
// nested runtime validation and legacy-optional fields.
const REQUIRED_BACKUP_KEYS = [
  "unit",
  "theme",
  "body",
  "routines",
  "workouts",
  "bodyweight",
  "customEx",
  "week",
  "dayPlan",
  "exWeights",
] as const;

export function parseBackup(json: string): AppState {
  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch {
    throw new Error("file is not valid JSON");
  }

  const restoredPatch = parsePayload(appStatePatch, parsed);
  for (const key of REQUIRED_BACKUP_KEYS) {
    if (!(key in restoredPatch)) throw new Error(`backup.${key} is required`);
  }

  // appStatePatch strips unknown top-level properties, preserving the old backup whitelist.
  return Object.assign(structuredClone(DEFAULT_APP_STATE), restoredPatch);
}
