import type { SyncConflict } from "./training-sync";
const labels: Record<string, string> = {
  workouts: "Workout",
  routines: "Routine",
  customEx: "Exercise",
  field: "",
  order: "Order",
  w: "Weight",
  r: "Reps",
  d: "Date",
  t: "Time",
  n: "Name",
  ex: "Exercises",
  entries: "Exercises",
  min: "Minutes",
  sec: "Seconds",
  done: "Completed",
  restSec: "Rest (seconds)",
  target: "Target",
  rir: "Reps in reserve",
  unit: "Units",
  bodyweight: "Body weight",
};
const humanize = (key: string) =>
  labels[key] ??
  key.replaceAll(/([a-z])([A-Z])/g, "$1 $2").replace(/^./, (first) => first.toUpperCase());
const decode = (value: string | null): unknown => (value === null ? null : JSON.parse(value));
export function conflictTitle(conflict: SyncConflict): string {
  const value = decode(conflict.local ?? conflict.remote);
  if (value && typeof value === "object" && "name" in value && typeof value.name === "string")
    return value.name;
  return conflict.key.split("/").map(humanize).filter(Boolean).join(" · ");
}
function flatten(value: unknown, path = ""): Record<string, string> {
  if (value === null) return { [path || "Item"]: "Removed" };
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean")
    return { [path || "Value"]: String(value) };
  if (typeof value !== "object") return {};
  return Object.fromEntries(
    Object.entries(value).flatMap(([key, item]) =>
      Object.entries(
        flatten(
          item,
          [path, /^\d+$/.test(key) ? String(Number(key) + 1) : humanize(key)]
            .filter(Boolean)
            .join(" / "),
        ),
      ),
    ),
  );
}
export function conflictRows(conflict: SyncConflict) {
  const local = flatten(decode(conflict.local));
  const remote = flatten(decode(conflict.remote));
  return [...new Set([...Object.keys(local), ...Object.keys(remote)])]
    .filter((key) => local[key] !== remote[key])
    .map((label) => ({ label, local: local[label] ?? "—", remote: remote[label] ?? "—" }));
}
