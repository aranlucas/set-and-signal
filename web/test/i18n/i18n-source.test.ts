import { describe, expect, it } from "vitest";
import { CURATED } from "@/features/plan/curated";
import { EXDB } from "@/domain/exercises/exercises";

const sourceFiles = Object.entries(
  import.meta.glob<string>("../../src/**/*.{ts,tsx}", {
    query: "?raw",
    import: "default",
    eager: true,
  }),
).filter(([filename]) => !filename.endsWith(".test.ts") && !filename.includes("/locales/"));

describe("exercise translation coverage", () => {
  it("covers every exercise dataset value in the explicit metadata hook", () => {
    const metadataSource = sourceFiles.find(([filename]) =>
      filename.endsWith("/hooks/use-exercise-metadata-labels.ts"),
    )?.[1];

    expect(metadataSource).toBeDefined();

    const values = new Set<string>(["custom"]);

    for (const exercise of EXDB) {
      values.add(exercise.bp);
      values.add(exercise.eq);
      values.add(exercise.tg);

      for (const muscle of exercise.sm) {
        values.add(muscle);
      }
    }

    for (const plan of CURATED) {
      for (const equipment of plan.eq) {
        values.add(equipment);
      }
    }

    const missing = [...values].filter((value) => !metadataSource?.includes(JSON.stringify(value)));
    expect(missing).toEqual([]);
  });
});
