import { beforeEach, describe, expect, it, vi } from "vitest";
const fake = vi.hoisted(() => ({
  mutation: vi.fn<() => Promise<null>>(),
  query: vi.fn<() => Promise<unknown>>(),
  close: vi.fn<() => Promise<null>>(),
}));
vi.mock("convex/browser", () => ({
  ConvexClient: class {
    setAuth() {}
    onUpdate() {
      return () => {};
    }
    mutation = fake.mutation;
    query = fake.query;
    close = fake.close;
  },
}));
vi.mock("@/shared/lib/api", () => ({
  api: () => Promise.resolve({ token: "test", url: "https://test.convex.cloud", userId: "alice" }),
}));
import { TrainingSync, changesBetween } from "./training-sync";
const saved = new Map<string, string>();
beforeEach(() => {
  saved.clear();
  vi.clearAllMocks();
  vi.stubGlobal("localStorage", {
    getItem: (key: string) => saved.get(key) ?? null,
    setItem: (key: string, value: string) => {
      saved.set(key, value);
    },
    removeItem: (key: string) => {
      saved.delete(key);
    },
  });
  fake.mutation.mockResolvedValue(null);
  fake.query.mockResolvedValue({ unit: "kg" });
  fake.close.mockResolvedValue(null);
});
describe("durable Convex edits", () => {
  it("never sends active workouts or client timestamps", () => {
    expect(changesBetween({ _ts: 1, active: null }, { _ts: 2, active: null })).toEqual([]);
  });
  it("replays persisted edits after reopening and clears only acknowledged batches", async () => {
    saved.set(
      "gym_pending_convex:alice",
      JSON.stringify([[{ key: "field/unit", expected: '"lb"', value: '"kg"' }]]),
    );
    const receive = vi.fn<() => void>();
    const sync = new TrainingSync("alice", receive, vi.fn<() => void>());
    await sync.start();
    expect(fake.mutation).toHaveBeenCalledTimes(1);
    expect(saved.get("gym_pending_convex:alice")).toBe("[]");
    expect(receive).toHaveBeenCalledWith({ unit: "kg" });
    await sync.close();
  });
  it("creates a missing field without treating UI defaults as stored server values", async () => {
    fake.query.mockResolvedValue(null);
    const sync = new TrainingSync("alice", vi.fn<() => void>(), vi.fn<() => void>());
    await sync.start();
    sync.enqueue({ restSec: 90 }, { restSec: 120 });
    await sync.flush();
    expect(fake.mutation).toHaveBeenCalledWith(expect.anything(), {
      changes: [{ key: "field/restSec", expected: null, value: "120" }],
    });
    await sync.close();
  });
  it("uses the cached server baseline for edits queued before reconnecting", async () => {
    saved.set("gym_cache:alice", JSON.stringify({ restSec: 90 }));
    const sync = new TrainingSync("alice", vi.fn<() => void>(), vi.fn<() => void>());
    sync.enqueue({ restSec: 90 }, { restSec: 120 });
    await sync.start();
    expect(fake.mutation).toHaveBeenCalledWith(expect.anything(), {
      changes: [{ key: "field/restSec", expected: "90", value: "120" }],
    });
    await sync.close();
  });
  it("retains conflicting edits and offers recovery without overwriting them", async () => {
    const pending = JSON.stringify([[{ key: "field/unit", expected: '"lb"', value: '"kg"' }]]);
    saved.set("gym_pending_convex:alice", pending);
    fake.mutation.mockRejectedValue(new Error("CONFLICT"));
    const receive = vi.fn<() => void>();
    const sync = new TrainingSync("alice", receive, vi.fn<() => void>());
    await expect(sync.start()).rejects.toThrow("CONFLICT");
    expect(saved.get("gym_pending_convex:alice")).toBe(pending);
    expect(receive).not.toHaveBeenCalled();
    await sync.useRemote();
    expect([...saved.entries()]).toContainEqual([expect.stringContaining(":recovery:"), pending]);
    expect(receive).toHaveBeenCalledWith({ unit: "kg" });
    await sync.close();
  });
});
