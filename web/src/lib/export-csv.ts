// Workout history → CSV, the export shape the category standardized on (Strong's):
// one row per set, with the workout name/duration repeated and session notes carried
// on every row so any importer can reconstruct the log. Weight is exported in the
// profile's unit and labelled in the header (`weight_kg` / `weight_lb`) — importing
// apps convert on their side, so no silent unit rewriting happens here.
import type { AppState, Workout } from "./types";

type CsvCell = string | number | null | undefined;

const cell = (value: CsvCell): string => {
  const text = value == null ? "" : String(value);
  // Quote anything a spreadsheet could misread; double up embedded quotes.
  return /[",\n\r]/.test(text) ? '"' + text.replaceAll('"', '""') + '"' : text;
};

const hms = (ms: number): string => {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  return h + ":" + String(m).padStart(2, "0") + ":" + String(s).padStart(2, "0");
};

export function workoutsToCsv(
  state: Pick<AppState, "unit" | "workouts">,
  nameOf: (id: string) => string,
): string {
  const header = [
    "date",
    "workout_name",
    "duration",
    "exercise_name",
    "set_order",
    `weight_${state.unit}`,
    "reps",
    "distance_meters",
    "seconds",
    "notes",
    "workout_notes",
    "rpe",
    "rir",
  ];
  const lines = [header.join(",")];
  state.workouts.forEach((workout: Workout) => {
    const workoutNotes = workout.note || "";
    workout.entries.forEach((entry) => {
      const name = nameOf(entry.id);
      let order = 0;
      entry.sets.forEach((set) => {
        if (!set.done) return;
        order++;
        const isWarmup = "wu" in set && set.wu;
        if ("min" in set) {
          // Cardio has no measured distance in this app; duration goes in seconds and
          // speed rides along in notes rather than being invented into the wrong column.
          lines.push(
            [
              workout.d,
              workout.name,
              hms(workout.end - workout.start),
              name,
              order,
              "",
              "",
              "",
              Math.round((set.min || 0) * 60),
              (isWarmup ? "WU · " : "") + fmtSpeed(set.speed),
              workoutNotes,
              "",
              "",
            ]
              .map(cell)
              .join(","),
          );
          return;
        }
        const seconds = "sec" in set ? set.sec : "";
        const weight = "w" in set ? set.w : "";
        const reps = "r" in set ? set.r : "";
        const effortNote = isWarmup ? "warm-up" : "";
        lines.push(
          [
            workout.d,
            workout.name,
            hms(workout.end - workout.start),
            name,
            order,
            weight,
            reps,
            "",
            seconds,
            effortNote,
            workoutNotes,
            "rpe" in set && set.rpe != null ? set.rpe : "",
            "rir" in set && set.rir != null ? set.rir : "",
          ]
            .map(cell)
            .join(","),
        );
      });
    });
  });
  return lines.join("\n") + "\n";
}

const fmtSpeed = (speed?: number) => (speed ? `${speed} km/h` : "");

/** Filename-safe download of the export; returns the CSV too so callers can share it. */
export function buildExport(
  state: Pick<AppState, "unit" | "workouts">,
  nameOf: (id: string) => string,
) {
  return {
    csv: workoutsToCsv(state, nameOf),
    filename: "set-and-signal-workouts-" + todaySafe() + ".csv",
  };
}

const todaySafe = (): string => new Date().toISOString().slice(0, 10);
