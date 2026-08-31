// The example profile behind the demo build (see demo.js). Imported dynamically, so it stays
// out of the bundle self-hosters ship.
import { isoOf, uid } from "./format.js";
import { starterRoutines } from "./starter.js";
import { modeOf } from "./history.js";
import type {
  BodyweightEntry,
  EffortScale,
  ExWeightHint,
  Id,
  IsoDate,
  RepsSet,
  Routine,
  Weekday,
  Workout,
  WorkoutEntry,
} from "./types.js";

// Starting weight and weekly increment per exercise of the starter plan (kg).
// Chest dips are body-weight only here, so they log reps at 0 added weight.
const PROGRESSION: Record<string, readonly [number, number]> = {
  "0025": [60, 1.25],
  "0047": [45, 1],
  "0426": [20, 0.5],
  "0334": [10, 0.25],
  "0241": [25, 0.75],
  "0251": [0, 0],
  "2330": [50, 1.25],
  "0027": [50, 1],
  "1323": [45, 1],
  "0031": [30, 0.5],
  "0313": [12, 0.3],
  "0043": [70, 1.5],
  "0085": [60, 1.25],
  "0739": [120, 3],
  "0585": [45, 1],
  "0586": [40, 1],
  "0605": [60, 1.5],
};
const HISTORY_WEEKS = 12; // how much history to fabricate
const BW_FROM = 82.4;
const BW_TO = 78.3; // body-weight trend across those weeks
const TARGET_W = 77;

// --- Effort -----------------------------------------------------------------------------
// The demo has to show the effort stats, not just the volume ones, so the history carries
// ratings. Flat ratings would draw a flat trend and prove nothing, so this fabricates the
// shape the charts exist to make visible: a block grinding toward failure, a deload jumping
// back off it, another block going a little deeper than the first.
const DELOAD_WEEK = 5;
// Reps left in the tank the block is aiming for, by week.
const weekTarget = (wk: number) =>
  wk === DELOAD_WEEK
    ? 4.5
    : wk < DELOAD_WEEK
      ? 2.8 - wk * 0.3
      : 2.6 - (wk - DELOAD_WEEK - 1) * 0.26;
// Leg day is trained further from failure than the upper body — deliberate, so the muscle
// map's "hard sets" mode shows a different picture from its all-sets mode.
const EASY = new Set(["0043", "0085", "0739", "0585", "0586"]);
// One exercise nobody ever rates: partial coverage is the normal case (rating is optional and
// off by default), and it shows the per-exercise Effort toggle correctly staying away.
const NEVER_RATED = "0605";
const UNRATED = 0.1; // …plus this share of the remaining sets, at random
// The first weeks are logged in RPE, as if they came out of another app before the profile
// switched to RIR. A set is never rewritten (see history.js), so the stats have to average a
// mixed history as one series — the demo should be showing that, not hiding it.
const RPE_UNTIL = 3;
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

// Deterministic PRNG — the demo should look the same on every visit and in screenshots.
function createRandom(seed: number) {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let value = Math.imul(state ^ (state >>> 15), 1 | state);
    value = (value + Math.imul(value ^ (value >>> 7), 61 | value)) ^ value;
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}
const round = (weight: number, step: number) => Math.round(weight / step) * step;
const timestampAt = (date: Date, hour: number, minute: number) => {
  const dateAtTime = new Date(date);
  dateAtTime.setHours(hour, minute, 0, 0);
  return dateAtTime.getTime();
};
// The Monday of a date. The effort trend is plotted per calendar week, so the training block
// has to run on calendar weeks too — a deload counted off the first day of the history would
// straddle two points and average itself away in both.
const monday = (date: Date) => {
  const mondayDate = new Date(date);
  mondayDate.setDate(mondayDate.getDate() - ((mondayDate.getDay() + 6) % 7));
  mondayDate.setHours(12, 0, 0, 0);
  return +mondayDate;
};

// What one fabricated session entry looks like while under construction — every set this
// seed writes is a rep set.
interface DemoEntry {
  id: Id;
  sets: RepsSet[];
  topW: number | null;
}

// The full example profile shape: everything AppState carries of it, with the effort scale
// the history was rated on pinned down.
export interface DemoState {
  routines: Routine[];
  week: Partial<Record<Weekday, Id>>;
  dayPlan: Record<IsoDate, string>;
  workouts: Workout[];
  bodyweight: BodyweightEntry[];
  exWeights: Record<Id, ExWeightHint>;
  targetW: number;
  effort: EffortScale;
  unit: "kg";
}

// A full example profile: 12 weeks of Mon/Wed/Fri sessions on the starter plan, with linear
// progression, the odd missed session, twice-weekly weigh-ins trending toward the goal, and
// per-set effort ratings on most (not all) of it.
export function buildDemoState(): DemoState {
  const random = createRandom(20260723);
  const [push, pull, legs] = starterRoutines();
  const byWeekday: Record<number, Routine> = { 1: push, 3: pull, 5: legs };

  const currentHour = new Date().getHours();
  const today = new Date();
  today.setHours(12, 0, 0, 0);
  const start = new Date(today);
  start.setDate(start.getDate() - HISTORY_WEEKS * 7);

  const workouts: Workout[] = [];
  const bodyweight: BodyweightEntry[] = [];
  const exWeights: Record<Id, ExWeightHint> = {};
  const best: Record<Id, number> = {};

  for (
    let dayMs = +start;
    dayMs <= +today;
    dayMs = new Date(dayMs).setDate(new Date(dayMs).getDate() + 1)
  ) {
    const currentDate = new Date(dayMs);
    const day = new Date(currentDate);
    const iso = isoOf(day);
    const weekIndex = Math.floor((+day - +start) / (7 * 86400000));
    const progress = Math.min(1, weekIndex / HISTORY_WEEKS);

    // weigh-ins: Monday and Thursday mornings
    if (day.getDay() === 1 || day.getDay() === 4) {
      const bodyweightValue = BW_FROM + (BW_TO - BW_FROM) * progress + (random() - 0.5) * 0.7;
      bodyweight.push({
        d: iso,
        w: Math.round(bodyweightValue * 10) / 10,
        t: timestampAt(day, 7, 30),
      });
    }

    const routine = byWeekday[day.getDay()];
    if (!routine) continue;
    if (random() < 0.09) continue; // life happens — a few missed sessions
    if (iso === isoOf(today) && currentHour < 18) continue; // leave today's session to try out, unless it's already evening

    const prs: Id[] = [];
    const blockWeek = Math.round((monday(day) - monday(start)) / (7 * 86400000));
    const targetRir = weekTarget(blockWeek);
    const effortScale = blockWeek < RPE_UNTIL ? "rpe" : "rir";
    const entries: DemoEntry[] = routine.ex.map((config, exerciseIndex): DemoEntry => {
      const [baseWeight, increment] = PROGRESSION[config.id] || [20, 0.5];
      const step = baseWeight >= 40 ? 2.5 : 1.25;
      // The deload pulls the weight back too — effort dropping on its own would look like the
      // same session suddenly got easy.
      const deloadFactor = blockWeek === DELOAD_WEEK ? 0.88 : 1;
      const weight = baseWeight
        ? Math.max(step, round((baseWeight + increment * weekIndex) * deloadFactor, step))
        : 0;
      const rateable = modeOf(config) === "reps" && config.id !== NEVER_RATED;
      const targetReps = config.reps || 0;
      const sets: RepsSet[] = [];
      for (let setIndex = 0; setIndex < config.sets; setIndex++) {
        // last set is where reps usually start slipping
        const drop = setIndex === config.sets - 1 && random() < 0.55 ? (random() < 0.4 ? 2 : 1) : 0;
        const set: RepsSet = {
          w: weight,
          r: Math.max(4, targetReps - drop),
          done: true,
        };
        const rir = clamp(
          round(
            targetRir +
              (config.sets - 1 - setIndex) * 0.6 - // a first set sits further from failure than a last
              exerciseIndex * 0.12 + // …and fatigue accumulates across the session
              (EASY.has(config.id) ? 1.2 : 0) -
              (drop ? 0.5 : 0) + // reps slipping is the set that ran out of room
              (random() - 0.5),
            0.5,
          ),
          0,
          6,
        );
        if (rateable && random() > UNRATED) {
          // RPE's floor of 6 is a convention about which sets are worth rating, so an easy
          // set logged in RPE genuinely loses the distance it was from failure.
          if (effortScale === "rpe") set.rpe = clamp(10 - rir, 6, 10);
          else set.rir = rir;
        }
        sets.push(set);
      }
      if (weight > (best[config.id] || 0)) {
        best[config.id] = weight;
        prs.push(config.id);
      }
      exWeights[config.id] = {
        w: Math.max(weight, exWeights[config.id]?.w || 0),
        d: iso,
      };
      return { id: config.id, sets, topW: weight || null };
    });

    const bodyweightAtWorkout = bodyweight.at(-1)?.w ?? BW_FROM;
    const startMs = timestampAt(day, 18, 5 + Math.floor(random() * 25));
    const volume = entries.reduce(
      (totalVolume, entry) =>
        totalVolume + entry.sets.reduce((entryVolume, set) => entryVolume + set.w * set.r, 0),
      0,
    );
    workouts.push({
      id: uid(),
      d: iso,
      start: startMs,
      end: startMs + (46 + Math.floor(random() * 26)) * 60000,
      routineId: routine.id,
      name: routine.name,
      bw: bodyweightAtWorkout,
      entries: entries as WorkoutEntry[],
      prs: weekIndex === 0 ? [] : prs, // the very first session isn't a PR party
      vol: volume,
    });
  }

  // A visitor should always have something to press "Start" on, so if they land on a rest day
  // the next routine in the rotation is moved onto today — which also shows off rescheduling.
  const dayPlan: Record<IsoDate, string> = {};
  const todayIso = isoOf(today);
  if (!byWeekday[today.getDay()] && !workouts.some((workout) => workout.d === todayIso)) {
    const order = [push, pull, legs];
    const lastRoutineName = workouts.at(-1)?.name ?? legs.name;
    dayPlan[todayIso] =
      order[(order.findIndex((routine) => routine.name === lastRoutineName) + 1) % order.length].id;
  }

  return {
    unit: "kg",
    routines: [push, pull, legs],
    week: { 1: push.id, 3: pull.id, 5: legs.id },
    dayPlan,
    workouts,
    bodyweight,
    exWeights,
    targetW: TARGET_W,
    // The history is rated, so the demo turns the column on and the stats get a scale to
    // label their aggregates with instead of guessing one (see displayScale).
    effort: "rir",
  };
}
