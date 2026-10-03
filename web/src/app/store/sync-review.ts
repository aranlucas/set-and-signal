import * as v from "valibot";
import { jsonValue, type JsonValue } from "@/shared/lib/schemas";
import type { SyncConflict } from "./training-sync";

const labels = new Map<string, string>(
  Object.entries({
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
  } satisfies Record<string, string>),
);

const humanize = (key: string) =>
  labels.get(key) ??
  key.replaceAll(/([a-z])([A-Z])/g, "$1 $2").replace(/^./, (first) => first.toUpperCase());

const decode = (value: string | null): JsonValue =>
  value === null ? null : v.parse(jsonValue, JSON.parse(value));

export function conflictTitle(conflict: SyncConflict): string {
  const value = decode(conflict.local ?? conflict.remote);

  const named = v.safeParse(v.object({ name: v.string() }), value);

  if (named.success) return named.output.name;

  return conflict.key.split("/").map(humanize).filter(Boolean).join(" · ");
}

function flatten(value: JsonValue, path = ""): Record<string, string> {
  if (value === null) return Object.fromEntries([[path || "Item", "Removed"]]);

  if (v.is(v.union([v.string(), v.number(), v.boolean()]), value))
    return Object.fromEntries([[path || "Value", String(value)]]);

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

  return [...new Set([...Object.keys(local), ...Object.keys(remote)])].flatMap((label) =>
    local[label] !== remote[label]
      ? [{ label, local: local[label] ?? "—", remote: remote[label] ?? "—" }]
      : [],
  );
}
