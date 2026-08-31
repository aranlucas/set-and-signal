import type { AppState } from "./types";

export const DEFAULT_APP_STATE: AppState = {
  unit: "lb",
  restSec: 90,
  sound: true,
  keepAwake: true,
  lang: "en",
  theme: "light",
  accent: "orange",
  body: "male",
  targetW: null,
  bodyweight: [],
  measures: [],
  plates: null,
  routines: [],
  week: {},
  dayPlan: {},
  exWeights: {},
  workouts: [],
  active: null,
  customEx: [],
  gifSize: "full",
  // null means the user has not chosen a scale yet, so legacy showRir can still
  // preserve its former behavior when older profiles are loaded.
  reminder: { on: false, time: "08:00", tz: null },
  effort: null,
};
