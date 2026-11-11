import { convexTest } from "convex-test";
import { describe, expect, it } from "vitest";
import schema from "../../../convex/schema";
import { api } from "../../../convex/_generated/api";
import { splitState, joinState } from "../../../convex/model";

const modules = import.meta.glob("../../../convex/**/*.ts");

function setup() {
  const t = convexTest(schema, modules);

  return {
    t,
    alice: t.withIdentity({ subject: "alice", service: true }),
    bob: t.withIdentity({ subject: "bob", service: true }),
    browser: t.withIdentity({ subject: "alice" }),
  };
}

function pushUps(sets: object[]) {
  return {
    id: "w1",
    d: "2026-09-01",
    start: 1,
    end: 2,
    name: "Push",
    entries: [{ id: "0662", sets }],
    vol: 0,
  };
}

describe("Convex training authority", () => {
  it("isolates users and rejects anonymous and browser snapshot replacements", async () => {
    const { t, alice, bob, browser } = setup();
    await expect(t.query(api.training.snapshot, {})).rejects.toThrow("Unauthorized");
    await alice.mutation(api.training.replace, { state: '{"workouts":[]}', expected: null });
    expect(await bob.query(api.training.snapshot, {})).toBeNull();
    await expect(
      browser.mutation(api.training.replace, { state: "{}", expected: null }),
    ).rejects.toThrow("Unauthorized");
  });
  it("checks revisions and strips active drafts", async () => {
    const { alice } = setup();
    await alice.mutation(api.training.replace, {
      state: '{"unit":"lb","active":{"id":"local"}}',
      expected: null,
    });
    expect(await alice.query(api.training.snapshot, {})).toMatchObject({ unit: "lb" });
    expect(await alice.query(api.training.snapshot, {})).not.toHaveProperty("active");
  });
  it("merges independent edits, retries safely and rejects stale edits atomically", async () => {
    const { alice, browser } = setup();
    await alice.mutation(api.training.replace, {
      state: '{"unit":"lb","restSec":60}',
      expected: null,
    });
    const unit = { key: "field/unit", expected: '"lb"', value: '"kg"' };
    await browser.mutation(api.training.commit, { changes: [unit] });
    await browser.mutation(api.training.commit, { changes: [unit] });
    await browser.mutation(api.training.commit, {
      changes: [{ key: "field/restSec", expected: "60", value: "90" }],
    });
    await expect(
      browser.mutation(api.training.commit, {
        changes: [
          { key: "field/sound", expected: null, value: "true" },
          { ...unit, value: '"stale"' },
        ],
      }),
    ).rejects.toThrow(/CONFLICT/u);
    const value = await alice.query(api.training.snapshot, {});
    expect(value).toMatchObject({ unit: "kg", restSec: 90 });
    expect(value).not.toHaveProperty("sound");
  });
  it("rejects server replacements a browser could not load, without blocking on legacy records", async () => {
    const { t, alice } = setup();

    const logged = pushUps([{ done: true, w: 0, r: 10 }]);
    await alice.mutation(api.training.replace, {
      state: JSON.stringify({ unit: "kg", workouts: [logged] }),
      expected: null,
    });
    await expect(
      alice.mutation(api.training.replace, {
        state: JSON.stringify({ unit: "lb", workouts: [pushUps([{ done: true, r: 10 }])] }),
        expected: null,
      }),
    ).rejects.toThrow("Invalid training record: workouts/w1");
    expect(await alice.query(api.training.snapshot, {})).toMatchObject({
      unit: "kg",
      workouts: [logged],
    });

    await t.run(async (ctx) => {
      await ctx.db.insert("records", { owner: "alice", key: "field/theme", value: '"system"' });
    });
    await alice.mutation(api.training.replace, {
      state: JSON.stringify({ unit: "lb", theme: "system", workouts: [logged] }),
      expected: null,
    });
    expect(await alice.query(api.training.snapshot, {})).toMatchObject({ unit: "lb" });
  });
  it("round trips record order and rejects duplicate record identities", () => {
    const state = {
      workouts: [
        { id: "b", d: "2026-09-02" },
        { id: "a", d: "2026-09-01" },
      ],
      unit: "lb",
    };

    expect(joinState(splitState(state), 42)).toEqual({ ...state, _ts: 42 });
    expect(() => splitState({ workouts: [{ id: "a" }, { id: "a" }] })).toThrow("duplicate");
  });
});
