// Curated plan templates — ready-made routines for specific real-world setups.
// Shared by the "Curated plans" picker in Settings and on the Plan screen's empty state,
// and by the demo build, which seeds a history on top of the starter plan.
//
// An entry is [exId, sets, reps] — or { id, sets, min, speed } for cardio, which needs a
// duration instead of a rep target. `week` maps JS weekday numbers (1=Mon … 6=Sat, 0=Sun)
// to indexes into `routines`. `eq` lists the equipment the plan assumes, shown in the picker.
import { uid } from "./format.js";
import type { CuratedItem, CuratedPlan, ExConfig, Routine } from "./types.js";

const APARTMENT_LEG_ITEMS: CuratedItem[] = [
  ["0043", 4, 8],
  ["0085", 3, 10],
  ["0585", 3, 12],
  ["0586", 3, 12],
  ["0605", 4, 15],
  { id: "3666", sets: 1, min: 20, speed: 8 },
];

export const CURATED: CuratedPlan[] = [
  {
    key: "linear-5x5",
    name: "StrongLifts",
    emoji: "barbell",
    eq: ["barbell", "bench", "squat rack"],
    prog: "linear",
    week: { 1: 0, 3: 1, 5: 0 },
    routines: [
      [
        "5×5 Workout A",
        "barbell",
        [
          ["0043", 5, 5],
          ["0025", 5, 5],
          ["0027", 5, 5],
        ],
      ],
      [
        "5×5 Workout B",
        "barbell",
        [
          ["0043", 5, 5],
          ["1456", 5, 5],
          ["0032", 1, 5],
        ],
      ],
    ],
  },
  {
    key: "ppl",
    name: "Push / Pull / Legs",
    emoji: "barbell",
    eq: ["barbell", "leverage machine", "cable", "dumbbell", "body weight", "sled machine"],
    week: { 1: 0, 3: 1, 5: 2 },
    routines: [
      [
        "Push Day",
        "barbell",
        [
          ["0025", 4, 8],
          ["0047", 3, 10],
          ["0426", 3, 10],
          ["0334", 3, 12],
          ["0241", 3, 12],
          ["0251", 3, 10],
        ],
      ],
      [
        "Pull Day",
        "pullup",
        [
          ["2330", 4, 10],
          ["0027", 4, 8],
          ["1323", 3, 10],
          ["0031", 3, 10],
          ["0313", 3, 12],
        ],
      ],
      [
        "Leg Day",
        "legs",
        [
          ["0043", 4, 8],
          ["0085", 3, 10],
          ["0739", 3, 12],
          ["0585", 3, 12],
          ["0586", 3, 12],
          ["0605", 4, 15],
        ],
      ],
    ],
  },
  {
    // Built for the Pike Motorworks fitness center (Seattle): Life Fitness selectorized
    // machines (chest press, shoulder press, row, lat pulldown, leg extension, leg curl),
    // a squat rack with barbell + plates, a SYNRGY 360 cable rig and a treadmill.
    key: "pmw",
    name: "Apartment Gym (Life Fitness machines + rack)",
    emoji: "barbell",
    eq: ["barbell", "leverage machine", "cable", "body weight"],
    week: { 1: 0, 3: 1, 5: 2 },
    routines: [
      [
        "Push Day",
        "barbell",
        [
          ["0025", 4, 8],
          ["0577", 3, 10],
          ["0603", 3, 10],
          ["0178", 3, 12],
          ["0241", 3, 12],
          ["0662", 3, 12],
        ],
      ],
      [
        "Pull Day",
        "pullup",
        [
          ["0579", 4, 10],
          ["1350", 3, 10],
          ["0027", 3, 8],
          ["0031", 3, 10],
          ["0472", 3, 12],
        ],
      ],
      ["Legs & Treadmill", "legs", APARTMENT_LEG_ITEMS],
    ],
  },
];

// Fresh routine objects (new ids) built from a curated template.
export const curatedRoutines = (p: CuratedPlan): Routine[] =>
  p.routines.map(([name, emoji, list]) => ({
    id: uid(),
    name,
    emoji,
    ...(p.prog ? { prog: p.prog } : {}),
    ex: list.map((e: CuratedItem): ExConfig =>
      Array.isArray(e)
        ? { id: e[0], sets: e[1], reps: e[2], weight: 0 }
        : { id: e.id, sets: e.sets, min: e.min, speed: e.speed },
    ),
  }));
