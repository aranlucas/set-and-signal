import { afterEach, expect, it, vi } from "vitest";
import { DEFAULT_APP_STATE } from "@/domain/training/default-state";

const native = vi.hoisted(() => ({ load: vi.fn(), save: vi.fn() }));
vi.mock("@/shared/lib/mobile.js", () => ({
  MOBILE: true,
  nativeLoad: native.load,
  nativeSave: native.save,
  syncReminder: () => Promise.resolve(true),
}));

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

it.each([
  { localTS: 200, fileTS: 100, expected: "kg" },
  { localTS: 100, fileTS: 200, expected: "lb" },
  { localTS: 100, fileTS: 100, expected: "lb" },
  { localTS: 0, fileTS: 100, expected: "lb" },
])("restores the newest standalone copy: %j", async ({ localTS, fileTS, expected }) => {
  vi.resetModules();
  vi.useFakeTimers();
  native.save.mockReset().mockResolvedValue(undefined);
  native.load.mockResolvedValue({ ...DEFAULT_APP_STATE, unit: "lb", _ts: fileTS });
  const saved = new Map<string, string>();
  if (localTS) {
    saved.set("gym_state_v1", JSON.stringify({ ...DEFAULT_APP_STATE, unit: "kg", _ts: localTS }));
  }
  vi.stubGlobal("localStorage", {
    getItem: (key: string) => saved.get(key) ?? null,
    setItem: (key: string, value: string) => saved.set(key, value),
    removeItem: (key: string) => saved.delete(key),
  });
  const { useStore } = await import("@/app/store/useStore");
  await useStore.getState().boot();
  expect(useStore.getState().appState.unit).toBe(expected);
  await vi.runAllTimersAsync();
  expect(native.save).toHaveBeenCalledWith(expect.objectContaining({ unit: expected }));
});
