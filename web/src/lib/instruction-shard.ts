export const INSTRUCTION_SHARD_COUNT = 16;

// FNV-1a keeps sparse and non-numeric exercise ids evenly distributed while
// remaining stable between the build-time generator and the browser loader.
export function instructionShard(exerciseId: string): string {
  let hash = 0x811c9dc5;
  for (const character of exerciseId) {
    hash ^= character.codePointAt(0) ?? 0;
    hash = Math.imul(hash, 0x01000193);
  }
  return String((hash >>> 0) % INSTRUCTION_SHARD_COUNT).padStart(2, "0");
}
