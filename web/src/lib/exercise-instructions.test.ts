import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { instructionPackPath, loadExerciseInstructions } from "./exercise-instructions";
import { instructionShard, INSTRUCTION_SHARD_COUNT } from "./instruction-shard";

describe("exercise instruction shards", () => {
  beforeAll(() => {
    vi.stubGlobal("fetch", (input: URL | RequestInfo) => {
      if (!(input instanceof URL))
        throw new Error("Expected the instruction loader to fetch a URL");
      if (input.pathname.includes("/fr/")) {
        return Promise.resolve(new Response(null, { status: 404 }));
      }
      const steps = input.pathname.includes("/es/")
        ? [
            "Ponte de pie con los pies separados a la altura de las caderas y coloca la banda alrededor de la base de los dedos del pie.",
          ]
        : ["Stand with your feet hip-width apart and place the band around the ball of your foot."];
      return Promise.resolve(
        new Response(JSON.stringify({ "1000": steps, "1001": steps }), {
          status: 200,
          headers: { "content-type": "application/json" },
        }),
      );
    });
  });

  afterAll(() => {
    vi.unstubAllGlobals();
  });

  it("loads only the requested translated exercise", async () => {
    const result = await loadExerciseInstructions("es", "1000");

    expect(result.language).toBe("es");
    expect(result.steps[0]).toBe(
      "Ponte de pie con los pies separados a la altura de las caderas y coloca la banda alrededor de la base de los dedos del pie.",
    );
  });

  it("falls back directly to English when a UI language has no instruction pack", async () => {
    const result = await loadExerciseInstructions("pt", "1000");

    expect(result.language).toBe("en");
    expect(result.steps[0]).toBe(
      "Stand with your feet hip-width apart and place the band around the ball of your foot.",
    );
  });

  it("falls back to English when a translated shard cannot be loaded", async () => {
    const result = await loadExerciseInstructions("fr", "1001");

    expect(result.language).toBe("en");
    expect(result.steps[0]).toBe(
      "Stand with your feet hip-width apart and place the band around the ball of your foot.",
    );
  });

  it("assigns every id to one stable bounded shard", () => {
    expect(instructionShard("1000")).toBe(instructionShard("1000"));
    expect(Number(instructionShard("0001"))).toBeLessThan(INSTRUCTION_SHARD_COUNT);
    expect(Number(instructionShard("5201"))).toBeLessThan(INSTRUCTION_SHARD_COUNT);
  });

  it("builds a relative static-data path for the selected shard", () => {
    expect(instructionPackPath("hi", "1000")).toMatch(
      /^instructions\/hi\/instructions-hi-\d{2}\.json$/u,
    );
  });
});
