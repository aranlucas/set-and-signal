import { describe, expect, it } from "vitest";
import en from "../locales/en/translation";
import { CURATED } from "./curated";
import { EXDB } from "./exercises";

const sourceFiles = Object.entries(
  import.meta.glob<string>("../**/*.{ts,tsx}", {
    query: "?raw",
    import: "default",
    eager: true,
  }),
).filter(([filename]) => !filename.endsWith(".test.ts") && !filename.includes("/locales/"));

const pluralSuffix = /_(zero|one|two|few|many|other)$/u;
const pluralBases = new Set(
  Object.keys(en)
    .filter((key) => pluralSuffix.test(key))
    .map((key) => key.replace(pluralSuffix, "")),
);

describe("translation source calls", () => {
  it("uses semantic literal keys with an English default at extractable call sites", () => {
    const failures: string[] = [];
    const literalCall = /\b(t|translate|reason)\(\s*"([^"]+)"/gu;
    for (const [filename, source] of sourceFiles) {
      for (const match of source.matchAll(literalCall)) {
        const key = match[2];
        if (/^\d+$/u.test(key)) continue;
        const line = source.slice(0, match.index).split("\n").length;
        if (!/^[a-z][A-Za-z0-9]*(?:\.[A-Za-z][A-Za-z0-9]*)+$/u.test(key)) {
          failures.push(`${filename}:${line} non-semantic key ${key}`);
          continue;
        }
        const afterKey = source.slice(match.index + match[0].length);
        if (!/^\s*,\s*["'`]/u.test(afterKey))
          failures.push(`${filename}:${line} missing English default ${key}`);
      }
    }
    expect(failures).toEqual([]);
  });

  it("passes count to every plural translation call", () => {
    const failures: string[] = [];
    for (const [filename, source] of sourceFiles) {
      for (const base of pluralBases) {
        const escaped = base.replaceAll(/[.*+?^${}()|[\]\\]/gu, "\\$&");
        const call = new RegExp(
          String.raw`\b(?:t|translate|reason)\(\s*"${escaped}"\s*,\s*["'\x60][\s\S]{0,500}?\bcount\s*:`,
          "gu",
        );
        const keyCall = new RegExp(String.raw`\b(?:t|translate|reason)\(\s*"${escaped}"`, "gu");
        const all = [...source.matchAll(keyCall)].length;
        const counted = [...source.matchAll(call)].length;
        if (all !== counted) failures.push(`${filename}:${base} ${counted}/${all} counted`);
      }
    }
    expect(failures).toEqual([]);
  });

  it("keeps React on hooks and rejects migration compatibility adapters", () => {
    const failures: string[] = [];
    const compatibilityNames = [
      "translateDataValue",
      "translationKeyForDefaultValue",
      "keyByDefaultValue",
    ];
    for (const [filename, source] of sourceFiles) {
      if (filename.endsWith(".tsx") && /\btranslate\(/u.test(source)) {
        failures.push(`${filename} calls the imperative translator from React`);
      }
      if (filename.endsWith(".tsx")) {
        for (const match of source.matchAll(/\bt\(\s*([^"'`\s])/gu)) {
          const call = source.slice(match.index, match.index + 80);
          const isDeferredMessage = /^t\(\s*why\.key/u.test(call);
          if (!isDeferredMessage) {
            const line = source.slice(0, match.index).split("\n").length;
            failures.push(`${filename}:${line} has a non-extractable dynamic t call`);
          }
        }
      }
      for (const name of compatibilityNames) {
        if (source.includes(name)) failures.push(`${filename} contains ${name}`);
      }
    }
    expect(failures).toEqual([]);
  });

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
      for (const muscle of exercise.sm) values.add(muscle);
    }
    for (const plan of CURATED) {
      for (const equipment of plan.eq) values.add(equipment);
    }

    const missing = [...values].filter((value) => !metadataSource?.includes(JSON.stringify(value)));
    expect(missing).toEqual([]);
  });
});
