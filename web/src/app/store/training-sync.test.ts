import { beforeEach, describe, expect, it, vi } from "vitest";
const fake = vi.hoisted(() => ({
  mutation: vi.fn<() => Promise<null>>(),
  query: vi.fn<() => Promise<unknown>>(),
  close: vi.fn<() => Promise<null>>(),
}));
vi.mock("convex/browser", () => ({
  ConvexClient: class {
    setAuth() {}
    subscribeToConnectionState() {
      return () => {};
    }
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
    expect(receive).toHaveBeenCalledWith(expect.objectContaining({ unit: "kg" }));
    await sync.close();
  });
});

describe("reviewing competing edits", () => {
  it("keeps unrelated edits when accepting another version", async () => {
    saved.set("gym_cache:alice", JSON.stringify({ unit: "kg", restSec: 90 }));
    saved.set(
      "gym_pending_convex:alice",
      JSON.stringify([
        [
          { key: "field/unit", expected: '"kg"', value: '"lb"' },
          { key: "field/restSec", expected: "90", value: "120" },
        ],
      ]),
    );
    fake.query.mockResolvedValue({ unit: "kg", restSec: 90 });
    fake.mutation.mockRejectedValueOnce(new Error("CONFLICT"));
    const status = vi.fn<() => void>();
    const sync = new TrainingSync("alice", vi.fn<() => void>(), vi.fn<() => void>(), status);
    await expect(sync.start()).rejects.toThrow("CONFLICT");
    await sync.resolve([{ key: "field/unit", local: '"lb"', remote: '"kg"' }], "remote");
    expect(fake.mutation).toHaveBeenLastCalledWith(expect.anything(), {
      changes: [{ key: "field/restSec", expected: "90", value: "120" }],
    });
    expect(status).toHaveBeenLastCalledWith({ phase: "saved", pending: 0 });
    expect([...saved.keys()].some((key) => key.includes(":recovery:"))).toBe(true);
    await sync.close();
  });
  it("checks the reviewed version when keeping local edits", async () => {
    saved.set(
      "gym_pending_convex:alice",
      JSON.stringify([[{ key: "field/restSec", expected: "90", value: "120" }]]),
    );
    fake.query.mockResolvedValue({ restSec: 100 });
    fake.mutation.mockRejectedValueOnce(new Error("CONFLICT"));
    const sync = new TrainingSync("alice", vi.fn<() => void>(), vi.fn<() => void>());
    await expect(sync.start()).rejects.toThrow("CONFLICT");
    const conflicts = await sync.conflicts();
    expect(conflicts).toEqual([{ key: "field/restSec", local: "120", remote: "100" }]);
    await sync.resolve(conflicts, "local");
    expect(fake.mutation).toHaveBeenLastCalledWith(expect.anything(), {
      changes: [{ key: "field/restSec", expected: "100", value: "120" }],
    });
    await sync.close();
  });
  it("does not report an offline pending queue as flushed", async () => {
    const sync = new TrainingSync("alice", vi.fn<() => void>(), vi.fn<() => void>());
    sync.enqueue({ restSec: 90 }, { restSec: 120 });
    await expect(sync.flush()).rejects.toThrow("Connect to save");
    expect(saved.get("gym_pending_convex:alice")).toContain("120");
    await sync.close();
  });
});
