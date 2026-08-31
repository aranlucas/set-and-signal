import { describe, expect, it } from "vitest";
import {
  appStatePatch,
  configResponse,
  parsePayload,
  parseStoredState,
  sessionResponse,
} from "@/shared/lib/schemas";
import { DEFAULT_APP_STATE } from "@/domain/training/default-state";

describe("runtime payload schemas", () => {
  it("defaults new profiles to pounds", () => {
    expect(DEFAULT_APP_STATE.unit).toBe("lb");
  });

  it("accepts the small public config contract", () => {
    expect(parsePayload(configResponse, { invite_only: true })).toEqual({
      invite_only: true,
    });
  });

  it("rejects malformed session identities instead of trusting a cast", () => {
    expect(() => parsePayload(sessionResponse, { user: { id: "u1", name: 42 } })).toThrow(
      /Invalid server payload/u,
    );
  });

  it("rejects malformed persisted state and lets the store use defaults", () => {
    expect(parseStoredState('{"unit":"stones"}')).toBeNull();
    expect(parseStoredState("not json")).toBeNull();
  });

  it("accepts a valid state patch without requiring unrelated legacy fields", () => {
    expect(parsePayload(appStatePatch, { unit: "lb", sound: false })).toEqual({
      unit: "lb",
      sound: false,
    });
  });

  it("accepts the current persisted state shape", () => {
    expect(parseStoredState(JSON.stringify(DEFAULT_APP_STATE))).not.toBeNull();
  });

  it("validates persisted active workouts instead of trusting nested unknown data", () => {
    expect(
      parseStoredState(
        JSON.stringify({
          active: {
            id: "active-1",
            d: "2026-08-24",
            start: Date.now(),
            routineId: null,
            name: "Freestyle",
            bw: null,
            cur: 0,
            entries: [
              {
                id: "squat",
                target: { id: "squat", sets: 3 },
                sets: "invalid",
              },
            ],
          },
        }),
      ),
    ).toBeNull();
  });

  it("retains custom-exercise snapshots in finished history", () => {
    const parsed = parseStoredState(
      JSON.stringify({
        ...DEFAULT_APP_STATE,
        workouts: [
          {
            id: "workout-1",
            d: "2026-08-30",
            start: 1,
            end: 2,
            routineId: null,
            name: "Freestyle",
            bw: null,
            entries: [
              {
                id: "deleted-custom",
                sets: [{ done: true, w: 0, r: 10 }],
                muscleSnapshot: {
                  n: "Deleted custom",
                  bp: "chest",
                  muscleWeights: { chest: 1 },
                },
              },
            ],
            prs: [],
            vol: 0,
          },
        ],
      }),
    );

    expect(parsed?.workouts?.[0]?.entries[0]?.muscleSnapshot).toEqual({
      n: "Deleted custom",
      bp: "chest",
      muscleWeights: { chest: 1 },
    });
  });
});
