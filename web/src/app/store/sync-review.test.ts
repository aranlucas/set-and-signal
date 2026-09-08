import { expect, it } from "vitest";
import { conflictRows, conflictTitle } from "./sync-review";
it("names a workout and shows only the values that changed", () => {
  const conflict = {
    key: "workouts/id",
    local: JSON.stringify({ name: "Upper body", entries: [{ sets: [{ w: 50, r: 8 }] }] }),
    remote: JSON.stringify({ name: "Upper body", entries: [{ sets: [{ w: 45, r: 8 }] }] }),
  };
  expect(conflictTitle(conflict)).toBe("Upper body");
  expect(conflictRows(conflict)).toEqual([
    { label: "Exercises / 1 / Sets / 1 / Weight", local: "50", remote: "45" },
  ]);
});
