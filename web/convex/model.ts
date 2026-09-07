// Keep the export shape at the boundary; store growing histories as separate documents.
export type RecordValue = { key: string; value: string };
const collections = new Set(["workouts", "routines", "customEx"]);
export function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  if (value !== null && typeof value === "object") {
    return `{${Object.entries(value)
      .filter(([, item]) => item !== undefined)
      .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
      .map(([key, item]) => `${JSON.stringify(key)}:${canonical(item)}`)
      .join(",")}}`;
  }
  return JSON.stringify(value);
}
export function splitState(state: Record<string, unknown>): RecordValue[] {
  const records: RecordValue[] = [];
  for (const [field, value] of Object.entries(state)) {
    if (field === "active" || field === "_ts") continue;
    if (collections.has(field) && Array.isArray(value)) {
      const ids = new Set<string>();
      for (const item of value) {
        if (!item || typeof item.id !== "string" || ids.has(item.id))
          throw new Error(`Invalid or duplicate ${field} id`);
        ids.add(item.id);
        records.push({ key: `${field}/${item.id}`, value: canonical(item) });
      }
      records.push({ key: `order/${field}`, value: canonical([...ids]) });
    } else records.push({ key: `field/${field}`, value: canonical(value) });
  }
  return records;
}
export function joinState(records: RecordValue[], revision: number): Record<string, unknown> {
  const state: Record<string, unknown> = { _ts: revision };
  const values = new Map(records.map((record) => [record.key, JSON.parse(record.value)]));
  for (const [key, value] of values) {
    if (key.startsWith("field/"))
      Object.defineProperty(state, key.slice(6), { value, enumerable: true, writable: true });
    if (key.startsWith("order/")) {
      const field = key.slice(6);
      Object.defineProperty(state, field, {
        value: value
          .map((id: string) => values.get(`${field}/${id}`))
          .filter((item: unknown) => item !== undefined),
        enumerable: true,
        writable: true,
      });
    }
  }
  return state;
}
