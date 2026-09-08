import { beforeEach, expect, it, vi } from "vitest";
const { fake, saved } = vi.hoisted(() => {
  const storage = new Map<string, string>();
  vi.stubGlobal("localStorage", {
    getItem: (key: string) => storage.get(key) ?? null,
    setItem: (key: string, value: string) => storage.set(key, value),
    removeItem: (key: string) => storage.delete(key),
  });
  return { saved: storage, fake: { api: vi.fn<() => Promise<unknown>>() } };
});
vi.mock("@/shared/lib/api.js", () => ({
  api: fake.api,
  getSession: vi.fn<() => Promise<unknown>>(),
  ApiError: class extends Error {},
}));
import { useStore } from "./useStore";
beforeEach(() => {
  useStore.getState().setUser(null);
  saved.clear();
  fake.api.mockReset();
});
it("hides one account's history immediately when switching profiles", () => {
  useStore.getState().setUser({ id: "alice", name: "Alice" });
  useStore.setState({
    profileLoaded: true,
    appState: { ...useStore.getState().appState, restSec: 123 },
  });
  useStore.getState().setUser({ id: "bob", name: "Bob" });
  expect(useStore.getState().profileLoaded).toBe(false);
  expect(useStore.getState().appState.restSec).not.toBe(123);
});
it("leaves the account and edits intact if sign-out cannot save", async () => {
  useStore.getState().setUser({ id: "alice", name: "Alice" });
  saved.set("gym_pending_convex:alice", "pending edits");
  useStore.setState({ syncStatus: { phase: "offline", pending: 1 } });
  await expect(useStore.getState().signOut()).rejects.toThrow("still signed in");
  expect(useStore.getState().user?.id).toBe("alice");
  expect(saved.get("gym_pending_convex:alice")).toBe("pending edits");
  expect(fake.api).not.toHaveBeenCalled();
});
