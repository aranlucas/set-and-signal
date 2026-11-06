import { afterEach, expect, it, vi } from "vitest";
import { DEFAULT_APP_STATE } from "@/domain/training/default-state";

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

it.each([
  { localTS: 200, fileTS: 100, expected: "kg" },
  { localTS: 100, fileTS: 200, expected: "lb" },
  { localTS: 100, fileTS: 100, expected: "lb" },
  { localTS: 0, fileTS: 100, expected: "lb" },
])("restores the newest standalone copy: %j", async ({ localTS, fileTS, expected }) => {
  vi.useFakeTimers();
  vi.stubEnv("VITE_MOBILE", "1");

  const { FilesystemWeb } = await import("@capacitor/filesystem/dist/esm/web");

  vi.spyOn(FilesystemWeb.prototype, "readFile").mockResolvedValue({
    data: JSON.stringify({ ...DEFAULT_APP_STATE, unit: "lb", _ts: fileTS }),
  });

  const write = vi
    .spyOn(FilesystemWeb.prototype, "writeFile")
    .mockResolvedValue({ uri: "file://test" });

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
  useStore.setState({
    isReady: false,
    user: null,
    appState: { ...structuredClone(DEFAULT_APP_STATE), unit: "kg", _ts: localTS },
  });
  await useStore.getState().boot();
  expect(useStore.getState().appState.unit).toBe(expected);
  await vi.runAllTimersAsync();
  expect(write).toHaveBeenCalled();
  expect(write.mock.calls[0]?.[0].data).toContain(`"unit":"${expected}"`);
});
