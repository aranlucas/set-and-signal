import { readFile, readdir, stat } from "node:fs/promises";
import { join } from "node:path";
import { expect, it } from "vitest";
import { EXDB } from "../../catalog/exercises.ts";
import { INSTRUCTION_SHARD_COUNT } from "../../src/domain/exercises/instruction-shard.ts";

const projectRoot = new URL("../../", import.meta.url).pathname;
const instructionsDirectory = join(projectRoot, "public/instructions");
const languages = await readdir(instructionsDirectory);

it.each(["id", "img", "gif"] as const)("keeps every source %s present and unique", (field) => {
  const values = EXDB.map((exercise) => exercise[field]);
  expect(values.length).toBeGreaterThan(0);
  expect(values.every((value) => value.length > 0)).toBe(true);
  expect(new Set(values).size).toBe(values.length);
});

it("excludes instruction steps from the generated runtime catalog", async () => {
  const source = await readFile(join(projectRoot, "src/generated/exercises-data.ts"), "utf8");
  expect(source).not.toContain('"st":');
});

it("generates exactly ten languages with complete bounded instruction shards", async () => {
  expect(languages).toHaveLength(10);
  await Promise.all(
    languages.map(async (language) => {
      const directory = join(instructionsDirectory, language);
      expect(await readdir(directory), language).toHaveLength(INSTRUCTION_SHARD_COUNT);
      await Promise.all(
        Array.from({ length: INSTRUCTION_SHARD_COUNT }, async (_, shard) => {
          const suffix = shard.toString().padStart(2, "0");
          const path = join(directory, `instructions-${language}-${suffix}.json`);
          expect((await stat(path)).size, path).toBeLessThanOrEqual(150_000);
        }),
      );
    }),
  );
});

it.skipIf(process.env.REQUIRE_LOCAL_MEDIA !== "1")(
  "matches private-mirror media files to the catalog",
  async () => {
    const [images, animations] = await Promise.all([
      readdir(join(projectRoot, "public/img")),
      readdir(join(projectRoot, "public/gif")),
    ]);

    expect(images.toSorted()).toEqual(EXDB.map((exercise) => exercise.img).toSorted());
    expect(animations.toSorted()).toEqual(EXDB.map((exercise) => exercise.gif).toSorted());
  },
);
