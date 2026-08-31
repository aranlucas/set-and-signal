import { describe, expect, it } from "vitest";
import { workoutsToCsv } from "./export-csv";
import type { AppState, Workout } from "./types";

const nameOf = (id: string) => ({ sq: "Squat", run: "Treadmill" })[id] || id;

const state = (workouts: Workout[], unit: AppState["unit"] = "kg") => ({ unit, workouts });

describe("workoutsToCsv", () => {
  it("writes one row per done set with the Strong-style header", () => {
    const workout: Workout = {
      id: "w1",
      d: "2026-08-20",
      start: 0,
      end: 3_600_000,
      routineId: null,
      name: "Legs",
      entries: [
        {
          id: "sq",
          sets: [
            { w: 100, r: 5, done: true },
            { w: 100, r: 5, done: true, rpe: 9 },
          ],
        },
      ],
      prs: [],
      vol: 1000,
    };
    const csv = workoutsToCsv(state([workout]), nameOf);
    const rows = csv.trimEnd().split("\n");
    expect(rows[0]).toBe(
      "date,workout_name,duration,exercise_name,set_order,weight_kg,reps,distance_meters,seconds,notes,workout_notes,rpe,rir",
    );
    expect(rows[1]).toBe("2026-08-20,Legs,1:00:00,Squat,1,100,5,,,,,,");
    expect(rows[2]).toBe("2026-08-20,Legs,1:00:00,Squat,2,100,5,,,,,9,");
  });

  it("labels the weight column with the profile unit", () => {
    const csv = workoutsToCsv(state([], "lb"), nameOf);
    expect(csv.split("\n")[0]).toContain("weight_lb");
  });

  it("carries session notes and warm-up markers without counting them as work", () => {
    const workout: Workout = {
      id: "w2",
      d: "2026-08-21",
      start: 0,
      end: 1_800_000,
      routineId: null,
      name: "Push",
      note: 'felt strong, "left" shoulder fine',
      entries: [
        {
          id: "sq",
          sets: [
            { w: 40, r: 8, done: true, wu: true },
            { w: 80, r: 5, done: true },
          ],
        },
      ],
      prs: [],
      vol: 400,
    };
    const rows = workoutsToCsv(state([workout]), nameOf)
      .trimEnd()
      .split("\n")
      .slice(1);
    // Warm-up row keeps its order position but is marked in notes
    expect(rows[0]).toContain("2026-08-21,Push,0:30:00,Squat,1,40,8,,,");
    expect(rows[0]).toContain("warm-up");
    // Quotes and commas are escaped
    expect(rows[1]).toContain('"felt strong, ""left"" shoulder fine"');
  });

  it("exports cardio sets as seconds with speed in notes", () => {
    const workout: Workout = {
      id: "w3",
      d: "2026-08-22",
      start: 0,
      end: 0,
      routineId: null,
      name: "Cardio",
      entries: [{ id: "run", sets: [{ min: 20, speed: 11.5, done: true }] }],
      prs: [],
      vol: 0,
    };
    const row = workoutsToCsv(state([workout]), nameOf)
      .trimEnd()
      .split("\n")[1];
    const cells = row.split(",");
    expect(cells[4 + 4]).toBe("1200"); // seconds column
    expect(row).toContain("11.5 km/h");
  });

  it("skips undone sets entirely", () => {
    const workout: Workout = {
      id: "w4",
      d: "2026-08-23",
      start: 0,
      end: 0,
      routineId: null,
      name: "Skip",
      entries: [{ id: "sq", sets: [{ w: 60, r: 10, done: false }] }],
      prs: [],
      vol: 0,
    };
    const csv = workoutsToCsv(state([workout]), nameOf);
    expect(csv.trimEnd().split("\n")).toHaveLength(1);
  });
});
