import { readdir, readFile, stat } from "node:fs/promises";
import { dirname, join } from "node:path";
import { INSTRUCTION_SHARD_COUNT } from "../src/lib/instruction-shard.ts";

const MAX_INSTRUCTION_SHARD_BYTES = 150_000;

const projectRoot = dirname(import.meta.dirname);
const catalogPath = join(projectRoot, "data", "exercises.ts");
const generatedCatalogPath = join(projectRoot, "src", "lib", "exercises-data.ts");
const generatedInstructionsDirectory = join(projectRoot, "public", "instructions");
const imageDirectory = join(projectRoot, "public", "img");
const animationDirectory = join(projectRoot, "public", "gif");

const catalogSource = await readFile(catalogPath, "utf8");
const generatedCatalogSource = await readFile(generatedCatalogPath, "utf8");

function catalogValues(field) {
  const pattern = new RegExp(`^    ${field}: "([^"]+)",$`, "gmu");
  return [...catalogSource.matchAll(pattern)].map((match) => match[1]);
}

function requireUnique(values, label) {
  const duplicates = values.filter((value, index) => values.indexOf(value) !== index);
  if (duplicates.length > 0) {
    throw new Error(`Duplicate ${label}: ${[...new Set(duplicates)].join(", ")}`);
  }
}

function requireSameFiles(referenced, present, label) {
  const referencedFiles = new Set(referenced);
  const presentFiles = new Set(present);
  const missing = referenced.filter((file) => !presentFiles.has(file));
  const orphaned = present.filter((file) => !referencedFiles.has(file));

  if (missing.length > 0 || orphaned.length > 0) {
    throw new Error(
      `${label} mismatch: ${missing.length} missing, ${orphaned.length} orphaned` +
        `${missing.length > 0 ? `\nMissing: ${missing.join(", ")}` : ""}` +
        `${orphaned.length > 0 ? `\nOrphaned: ${orphaned.join(", ")}` : ""}`,
    );
  }
}

const ids = catalogValues("id");
const images = catalogValues("img");
const animations = catalogValues("gif");

if (ids.length === 0 || images.length !== ids.length || animations.length !== ids.length) {
  throw new Error(
    `Incomplete catalog: ${ids.length} IDs, ${images.length} images, ${animations.length} animations`,
  );
}

requireUnique(ids, "exercise IDs");
requireUnique(images, "exercise images");
requireUnique(animations, "exercise animations");
// Visual media is intentionally hosted outside the public source snapshot. A local checkout
// may still opt into the legacy file parity check (useful for a private mirror) by setting
// REQUIRE_LOCAL_MEDIA=1; the public build validates the catalogue names and uses the pinned CDN.
const localImages = await readdir(imageDirectory).catch(() => null);
const localAnimations = await readdir(animationDirectory).catch(() => null);
if (process.env.REQUIRE_LOCAL_MEDIA === "1") {
  if (!localImages || !localAnimations)
    throw new Error("Local exercise media is required when REQUIRE_LOCAL_MEDIA=1");
  requireSameFiles(images, localImages, "Exercise images");
  requireSameFiles(animations, localAnimations, "Exercise animations");
}

if (generatedCatalogSource.includes('"st":')) {
  throw new Error("Generated runtime catalogue still contains instruction steps");
}

const generatedLanguages = await readdir(generatedInstructionsDirectory);
const shardCounts = await Promise.all(
  generatedLanguages.map(async (language) => ({
    language,
    count: (await readdir(join(generatedInstructionsDirectory, language))).length,
  })),
);
const invalidShardCounts = shardCounts.filter(({ count }) => count !== INSTRUCTION_SHARD_COUNT);
if (generatedLanguages.length !== 10 || invalidShardCounts.length > 0) {
  throw new Error(`Generated instruction shards are incomplete: ${JSON.stringify(shardCounts)}`);
}

const shardSizes = await Promise.all(
  generatedLanguages.flatMap((language) =>
    Array.from({ length: INSTRUCTION_SHARD_COUNT }, async (_, shard) => {
      const suffix = shard.toString().padStart(2, "0");
      const path = join(
        generatedInstructionsDirectory,
        language,
        `instructions-${language}-${suffix}.json`,
      );
      return { path, size: (await stat(path)).size };
    }),
  ),
);
const oversizedShards = shardSizes.filter(({ size }) => size > MAX_INSTRUCTION_SHARD_BYTES);
if (oversizedShards.length > 0) {
  throw new Error(`Instruction shard budget exceeded: ${JSON.stringify(oversizedShards)}`);
}

console.log(
  `Validated ${ids.length} compact exercises, ${localImages && localAnimations ? "local media" : "pinned remote media"}, and ${generatedLanguages.length * INSTRUCTION_SHARD_COUNT} instruction shards.`,
);
