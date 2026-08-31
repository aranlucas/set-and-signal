import { create } from "zustand";
import { api, apiParsed, ApiError, getSession } from "../lib/api.js";
import { localTZ } from "../lib/format.js";
import { registerCustom } from "../lib/exercise-registry.js";
import { DEMO, DEMO_SEEDED } from "../lib/demo.js";
import { MOBILE, nativeLoad, nativeSave, syncReminder } from "../lib/mobile.js";
import { DEFAULT_APP_STATE } from "../lib/default-state.js";
import type { AppState, StoreState, User } from "../lib/types.js";
import { dataResponse, parseStoredState, parseUser } from "../lib/schemas.js";

const STATE_STORAGE_KEY = "gym_state_v1";

const USER_STORAGE_KEY = "gym_user@v1";
const LEGACY_USER_STORAGE_KEY = "gym_user";

export const DEFAULT_STATE = DEFAULT_APP_STATE;
/** @deprecated Use DEFAULT_STATE in new code. Kept for existing view imports. */
export const DEF = DEFAULT_STATE;

// AppState is a structured-cloneable JSON document. Use the platform clone for
// in-memory drafts so updates do not serialize and parse the entire profile on
// every keystroke; JSON.stringify remains at the actual persistence/API edges.
const cloneValue = <T>(value: T): T => structuredClone(value);

function loadState(): AppState {
  try {
    const storedState = parseStoredState(localStorage.getItem(STATE_STORAGE_KEY));
    if (storedState) return Object.assign(cloneValue(DEFAULT_STATE), storedState);
  } catch {
    /* ignore */
  }
  return cloneValue(DEFAULT_STATE);
}

// One-time migration: move the pre-versioned user record under the versioned
// key so every reader below sees a single format. Runs before the store reads it.
function migrateUserKey() {
  try {
    if (localStorage.getItem(USER_STORAGE_KEY) !== null) return;
    const legacyUser = localStorage.getItem(LEGACY_USER_STORAGE_KEY);
    if (legacyUser === null) return;
    localStorage.setItem(USER_STORAGE_KEY, legacyUser);
    localStorage.removeItem(LEGACY_USER_STORAGE_KEY);
  } catch {
    /* ignore */
  }
}

export const hasData = (appState: Partial<AppState>) =>
  !!(
    (appState.workouts || []).length > 0 ||
    (appState.routines || []).length > 0 ||
    (appState.bodyweight || []).length > 0
  );

interface StoreActions {
  update: (mutate: (draft: AppState) => void, push?: boolean) => void;
  replaceState: (nextState: AppState, push?: boolean) => void;
  setGuest: (isGuest: boolean) => void;
  setUser: (user: User | null) => void;
  pushState: () => Promise<void>;
  pullState: () => Promise<void>;
  signOut: () => Promise<void>;
  signOutAll: () => Promise<void>;
  resetDemo: () => Promise<void>;
  boot: () => Promise<void>;
}

type Store = StoreState & StoreActions;

export const useStore = create<Store>()((set, get) => {
  let pushTimerId: number | undefined;
  let saveTimerId: number | undefined;
  let isBooting = false;

  // Mobile build: mirror the state into a file in the app's data directory (survives WebView
  // storage eviction) and keep the native reminder schedule in step with the weekly plan.
  const nativePersist = () => {
    clearTimeout(saveTimerId);
    saveTimerId = setTimeout(() => {
      saveTimerId = undefined;
      void nativeSave(get().appState);
      void syncReminder(get().appState);
    }, 800);
  };

  const persist = (nextState: AppState, push = true) => {
    nextState._ts = Date.now();
    registerCustom(nextState.customEx);
    localStorage.setItem(STATE_STORAGE_KEY, JSON.stringify(nextState));
    set({ appState: nextState });
    if (MOBILE) nativePersist();
    if (push && get().user) {
      clearTimeout(pushTimerId);
      pushTimerId = setTimeout(() => get().pushState(), 1500);
    }
  };

  // A setting changed right before switching away/closing the tab must not get lost mid-debounce
  // (e.g. setting the reminder time then immediately backgrounding to test it). On mobile the
  // same applies to the file mirror — backgrounding is often the last thing before the OS
  // kills the app.
  if (typeof document !== "undefined") {
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState !== "hidden") return;
      if (MOBILE && saveTimerId) {
        clearTimeout(saveTimerId);
        saveTimerId = undefined;
        void nativeSave(get().appState);
      }
      if (pushTimerId) {
        clearTimeout(pushTimerId);
        pushTimerId = undefined;
        void get().pushState();
      }
    });
  }

  // Everything a sign-out leaves behind on this device, whichever way it was triggered.
  const clearLocalSession = () => {
    get().setUser(null);
    get().setGuest(false);
    localStorage.removeItem("gym_dirty");
    localStorage.removeItem(STATE_STORAGE_KEY);
    persist(cloneValue(DEFAULT_STATE), false);
  };

  return {
    appState: (() => {
      const savedState = loadState();
      registerCustom(savedState.customEx);
      return savedState;
    })(),
    user: (() => {
      migrateUserKey();
      try {
        const rawUser = localStorage.getItem(USER_STORAGE_KEY);
        return rawUser ? parseUser(JSON.parse(rawUser)) : null;
      } catch {
        return null;
      }
    })(),
    isGuest: localStorage.getItem("gym_guest") === "1",
    isReady: false,

    // Mutate a draft of appState via producer fn, then persist + schedule sync.
    update(mutate, push = true) {
      const nextState = cloneValue(get().appState);
      mutate(nextState);
      persist(nextState, push);
    },
    replaceState(nextState, push = false) {
      persist(cloneValue(nextState), push);
    },

    setGuest(isGuest) {
      if (isGuest) localStorage.setItem("gym_guest", "1");
      else localStorage.removeItem("gym_guest");
      set({ isGuest });
    },

    setUser(user) {
      if (user) {
        localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(user));
        localStorage.removeItem("gym_guest");
      } else localStorage.removeItem(USER_STORAGE_KEY);
      set({ user, ...(user ? { isGuest: false } : {}) });
    },

    async pushState() {
      if (!get().user) return;
      clearTimeout(pushTimerId);
      try {
        await api("/api/data", {
          method: "PUT",
          body: JSON.stringify({ state: get().appState }),
        });
        localStorage.removeItem("gym_dirty");
      } catch {
        localStorage.setItem("gym_dirty", "1");
      }
    },
    async pullState() {
      try {
        const { state } = await apiParsed("/api/data", dataResponse);
        if (!state) return;
        // Server is source of truth: take remote state, keep only an in-progress
        // workout that is still running on this device.
        const active = get().appState.active;
        const nextState = Object.assign(cloneValue(DEFAULT_STATE), state);
        if (active) nextState.active = active;
        persist(nextState, false);
        localStorage.removeItem("gym_dirty");
      } catch {
        /* offline — keep cached state until reconnect */
      }
    },

    async signOut() {
      try {
        await get().pushState();
        await api("/api/logout", { method: "POST", body: "{}" });
      } catch {
        /* */
      }
      clearLocalSession();
    },

    // "Sign out everywhere": the server bumps this profile's session version, which kills every
    // session it has on any device — this browser included, so the app has to end up exactly
    // where a normal signOut leaves it. Unlike signOut the request is NOT swallowed: if it fails
    // the sessions elsewhere are all still valid, and wiping this device's copy of the data
    // would sign the user out of the one place the bump didn't reach. Caller reports the error.
    async signOutAll() {
      await get().pushState(); // never throws — stores gym_dirty and moves on when offline
      await api("/api/logout/all", { method: "POST", body: "{}" });
      clearLocalSession();
    },

    // Demo build only: drop the seeded example profile back in (Settings → "Reset demo data").
    // Dynamic import so the generator never ships in a self-hosted bundle.
    async resetDemo() {
      const { buildDemoState } = await import("../lib/demoSeed.js");
      localStorage.removeItem("gym_dirty");
      persist(Object.assign(cloneValue(DEFAULT_STATE), buildDemoState()), false);
    },

    // Boot: ask the server who we are, then pull.
    async boot() {
      if (isBooting || get().isReady) return;
      isBooting = true;
      try {
        // Mobile build: no backend either — restore from the file mirror (the durable copy;
        // localStorage may have been evicted since the last run) and go straight in.
        if (MOBILE) {
          const saved = await nativeLoad();
          const localState = get().appState;
          if (saved && (!hasData(localState) || (saved._ts || 0) >= (localState._ts || 0))) {
            persist(Object.assign(cloneValue(DEFAULT_STATE), saved), false);
          } else if (hasData(localState)) {
            void nativeSave(localState); // first run after an update from a file-less version: seed the mirror
          }
          get().setGuest(true);
          void syncReminder(get().appState);
          set({ isReady: true });
          return;
        }
        // Demo build (GitHub Pages): no backend at all — seed once, stay in guest mode.
        if (DEMO) {
          if (!localStorage.getItem(DEMO_SEEDED)) {
            localStorage.setItem(DEMO_SEEDED, "1");
            await get().resetDemo();
          }
          get().setGuest(true);
          set({ isReady: true });
          return;
        }
        try {
          const me = await getSession();
          get().setUser(me.user);
          get().setGuest(false);
          await get().pullState();
          // Re-stamp the reminder's timezone on every load — keeps it correct if you're travelling,
          // without needing to revisit Settings.
          const tz = localTZ();
          if (get().appState.reminder?.on && get().appState.reminder.tz !== tz) {
            get().update((s) => {
              s.reminder = { ...s.reminder, tz };
            });
          }
        } catch (e) {
          if (e instanceof ApiError && e.status === 401) {
            get().setUser(null);
            get().setGuest(false); // hosted builds require sign-in
          }
        }
        set({ isReady: true });
      } finally {
        isBooting = false;
      }
    },
  };
});
