import { beforeEach, describe, expect, it, vi } from "vitest";

vi.hoisted(() => {
  const values = new Map<string, string>();
  vi.stubGlobal("localStorage", {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => {
      values.set(key, value);
    },
    removeItem: (key: string) => {
      values.delete(key);
    },
  });
});

import { useStore } from "@/app/store/useStore";

import { useWorkoutTimer } from "@/features/workout/useWorkoutTimer";

describe("workout timer lifecycle", () => {
  beforeEach(() => {
    useStore.setState({ user: null, appState: { ...useStore.getState().appState, sound: false } });
    useWorkoutTimer.setState({ timer: null, work: null });
  });

  it("clears a timed-set countdown when stopped", () => {
    useWorkoutTimer.setState({
      work: {
        left: 12,
        total: 45,
        endsAt: Date.now() + 12_000,
        label: "Plank",
      },
    });

    useWorkoutTimer.getState().stopWork();

    expect(useWorkoutTimer.getState().work).toBeNull();
  });
});
