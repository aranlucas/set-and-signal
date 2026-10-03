import { beforeEach, expect, it, vi } from "vitest";

const saved = vi.hoisted(() => {
  const storage = new Map<string, string>();
  vi.stubGlobal("localStorage", {
    getItem: (key: string) => storage.get(key) ?? null,
    setItem: (key: string, value: string) => storage.set(key, value),
    removeItem: (key: string) => storage.delete(key),
  });

  return storage;
});

import { useStore } from "@/app/store/useStore";
import { DEFAULT_APP_STATE } from "@/domain/training/default-state";
import {
  adaptSession,
  canUndoSessionCopy,
  createSessionRoutine,
} from "@/domain/training/session-planner";
import { beginWorkout, completeWorkout } from "@/features/workout/workout-actions";
import { parseStoredState } from "@/shared/lib/schemas";
import { loadSessionDraft, saveSessionDraft } from "./session-draft";
import type { SessionDraft } from "./session-draft";

const source = {
  id: "synthetic-cardio",
  name: "Synthetic treadmill",
  emoji: "run",
  ex: [{ id: "3666", sets: 1, min: 40, speed: 7 }],
};

const constraints = {
  equipment: ["stationary bike"] satisfies ["stationary bike"],
  budgetMin: 20,
  restSec: 45,
};

const rows = adaptSession(source, constraints, [{ amount: 10 }]);

const copy = createSessionRoutine(source, constraints, rows, "synthetic-copy", "Hotel bike");

const draft: SessionDraft = {
  source,
  constraints,
  choices: [{ amount: 10 }],
  copyId: copy.id,
  name: copy.name,
};

beforeEach(() => {
  saved.clear();
  vi.stubGlobal(
    "fetch",
    vi
      .fn<typeof fetch>()
      .mockRejectedValue(new Error("Unexpected network request in local workflow test")),
  );
  useStore.setState({ user: null, appState: structuredClone(DEFAULT_APP_STATE) });
});

it("resumes a validated, account-scoped device draft", () => {
  saveSessionDraft("alice", draft);
  expect(loadSessionDraft("alice")).toEqual(draft);
  expect(loadSessionDraft("bob")).toBeNull();
  expect(loadSessionDraft(null)).toBeNull();
  saved.set("gym_session_plan_v1:account:bob", '{"constraints":42}');
  expect(loadSessionDraft("bob")).toBeNull();
  expect(useStore.getState().appState.active).toBeNull();
});

it("preserves state after failed saving, then saves a separate copy and undoes safely", () => {
  useStore.getState().update((state) => state.routines.push(structuredClone(source)));
  const oldState = structuredClone(useStore.getState().appState);
  vi.spyOn(localStorage, "setItem").mockImplementationOnce(() => {
    throw new Error("Storage unavailable");
  });
  expect(() => useStore.getState().update((state) => state.routines.push(copy))).toThrow(
    "Storage unavailable",
  );
  expect(useStore.getState().appState).toEqual(oldState);
  useStore.getState().update((state) => state.routines.push(copy));
  expect(parseStoredState(saved.get("gym_state_v1") ?? null)?.routines?.[1].sessionPlan).toEqual(
    copy.sessionPlan,
  );
  expect(useStore.getState().appState.active).toBeNull();
  useStore.getState().update((state) => {
    expect(canUndoSessionCopy(state, copy)).toBe(true);
    state.routines = state.routines.filter((routine) => routine.id !== copy.id);
  });
  expect(useStore.getState().appState.routines).toEqual([source]);
});

it("starts edited targets, resumes and finishes with snapshots without rewriting source or history", () => {
  const state = structuredClone(DEFAULT_APP_STATE);
  state.routines = [structuredClone(source), structuredClone(copy)];
  state.sound = false;
  state.workouts = [
    {
      id: "synthetic-old",
      d: "2026-01-01",
      start: 1,
      end: 2,
      routineId: null,
      name: "Synthetic prior bike",
      prs: [],
      vol: 0,
      entries: [{ id: "2138", sets: [{ min: 90, speed: 25, done: true }] }],
    },
  ];
  const oldWorkout = structuredClone(state.workouts[0]);
  useStore.getState().replaceState(state);
  beginWorkout(copy.id, null, "Freestyle");
  expect(useStore.getState().appState.active?.entries[0].sets).toEqual([
    { min: 10, speed: 0, done: false },
  ]);
  const active = structuredClone(useStore.getState().appState.active);
  beginWorkout(source.id, null, "Freestyle");
  expect(useStore.getState().appState.active).toEqual(active);
  const reloaded = parseStoredState(saved.get("gym_state_v1") ?? null);
  expect(reloaded?.active).toEqual(active);
  useStore.getState().update((next) => {
    next.active!.entries[0].sets[0].done = true;
  });
  completeWorkout();
  const finished = useStore.getState().appState;
  expect(finished.active).toBeNull();
  expect(finished.workouts[0]).toEqual(oldWorkout);
  expect(finished.routines[0]).toEqual(source);
  expect(finished.workouts[1].sessionPlan).toEqual(copy.sessionPlan);
  expect(canUndoSessionCopy(finished, copy)).toBe(false);
  expect(parseStoredState(saved.get("gym_state_v1") ?? null)?.workouts?.[1].sessionPlan).toEqual(
    copy.sessionPlan,
  );
});
