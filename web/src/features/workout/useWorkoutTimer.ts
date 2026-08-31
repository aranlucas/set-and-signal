import { create } from "zustand";
import { beep, vibrate } from "@/shared/lib/sound.js";
import { api } from "@/shared/lib/api.js";
import { translate } from "@/i18n/translate.js";
import { toast } from "@/shared/lib/toast.js";
import { useStore } from "@/app/store/useStore.js";
import type { Timer, WorkTimer } from "@/shared/lib/types.js";

const pushRestTimer = (seconds: number) => {
  if (useStore.getState().user)
    api("/api/push/rest-timer", {
      method: "POST",
      body: JSON.stringify({ seconds }),
    }).catch(() => {});
};
const cancelPushRestTimer = () => {
  if (useStore.getState().user)
    api("/api/push/rest-timer/cancel", { method: "POST", body: "{}" }).catch(() => {});
};

let restIntervalId: number | undefined;
let updateRestTimer: (() => void) | null = null;
let workIntervalId: number | undefined;
let updateWorkTimer: (() => void) | null = null;
let onWorkComplete: ((elapsedSeconds: number) => void) | null = null;

interface WorkoutTimerState {
  timer: Timer | null;
  work: WorkTimer | null;
  startRest: (seconds: number) => void;
  addRest: (seconds: number) => void;
  stopRest: () => void;
  startWork: (seconds: number, label: string, onDone: (elapsedSeconds: number) => void) => void;
  finishWorkEarly: () => void;
  stopWork: () => void;
}

export const useWorkoutTimer = create<WorkoutTimerState>()((set, get) => ({
  timer: null,
  work: null,

  startRest(seconds) {
    get().stopRest();
    const endsAt = Date.now() + seconds * 1000;
    set({ timer: { left: seconds, total: seconds, endsAt } });
    pushRestTimer(seconds);
    updateRestTimer = () => {
      const timer = get().timer;
      if (!timer) return;
      const left = Math.max(0, Math.round((timer.endsAt - Date.now()) / 1000));
      if (left === timer.left) return;
      const soundSettings = useStore.getState().appState.sound;
      if (left <= 0) {
        beep(soundSettings, 880, 0.15);
        beep(soundSettings, 880, 0.15, 0.25);
        beep(soundSettings, 1320, 0.4, 0.5);
        vibrate([200, 100, 200]);
        toast(translate("workout.restOverNextSet", "Rest over — next set!"));
        get().stopRest();
        return;
      }
      if (left <= 3) beep(soundSettings, 660, 0.1);
      set({ timer: { ...timer, left } });
    };
    restIntervalId = setInterval(updateRestTimer, 1000);
    document.addEventListener("visibilitychange", updateRestTimer);
  },

  addRest(seconds) {
    const timer = get().timer;
    if (!timer) return;
    const left = timer.left + seconds;
    if (left <= 0) {
      get().stopRest();
      return;
    }
    set({
      timer: {
        ...timer,
        left,
        total: timer.total + seconds,
        endsAt: timer.endsAt + seconds * 1000,
      },
    });
    pushRestTimer(left);
  },

  stopRest() {
    clearInterval(restIntervalId);
    restIntervalId = undefined;
    if (updateRestTimer) document.removeEventListener("visibilitychange", updateRestTimer);
    updateRestTimer = null;
    if (get().timer) cancelPushRestTimer();
    set({ timer: null });
  },

  startWork(seconds, label, onDone) {
    get().stopWork();
    get().stopRest();
    const total = Math.max(1, Math.round(seconds) || 1);
    const endsAt = Date.now() + total * 1000;
    onWorkComplete = onDone;
    set({ work: { left: total, total, endsAt, label } });
    updateWorkTimer = () => {
      const workTimer = get().work;
      if (!workTimer) return;
      const left = Math.max(0, Math.round((workTimer.endsAt - Date.now()) / 1000));
      if (left === workTimer.left) return;
      const soundSettings = useStore.getState().appState.sound;
      if (left <= 0) {
        beep(soundSettings, 880, 0.15);
        beep(soundSettings, 880, 0.15, 0.25);
        beep(soundSettings, 1320, 0.4, 0.5);
        vibrate([200, 100, 200]);
        const complete = onWorkComplete;
        get().stopWork();
        if (complete) complete(workTimer.total);
        return;
      }
      if (left <= 3) beep(soundSettings, 660, 0.1);
      set({ work: { ...workTimer, left } });
    };
    workIntervalId = setInterval(updateWorkTimer, 1000);
    document.addEventListener("visibilitychange", updateWorkTimer);
  },

  finishWorkEarly() {
    const workTimer = get().work;
    if (!workTimer) return;
    const elapsed = Math.max(1, workTimer.total - workTimer.left);
    const complete = onWorkComplete;
    vibrate(30);
    get().stopWork();
    if (complete) complete(elapsed);
  },

  stopWork() {
    clearInterval(workIntervalId);
    workIntervalId = undefined;
    if (updateWorkTimer) document.removeEventListener("visibilitychange", updateWorkTimer);
    updateWorkTimer = null;
    onWorkComplete = null;
    set({ work: null });
  },
}));
