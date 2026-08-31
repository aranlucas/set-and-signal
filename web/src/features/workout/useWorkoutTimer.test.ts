import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/app/store/useStore", () => ({
  useStore: {
    getState: () => ({ user: null, appState: { sound: false } }),
  },
}));

import { useWorkoutTimer } from "@/features/workout/useWorkoutTimer";

describe("workout timer lifecycle", () => {
  beforeEach(() => {
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
