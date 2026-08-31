// Mobile build (VITE_MOBILE=1) — the standalone app-store version (Capacitor native shell).
//
// There is no backend: nothing to sign in to, everything lives on the phone. Unlike guest
// mode in a browser, this is the user's only copy of their training log, so it can't depend
// on WebView localStorage alone (iOS evicts that under storage pressure). Every persist()
// therefore also lands in a JSON file in the app's private data directory, and boot()
// restores from it. The workout reminder uses native local notifications scheduled per
// planned weekday — no server involved, unlike Web Push in the self-hosted version.
//
// Like the demo build, MOBILE is replaced at build time, so all of this folds away in
// web bundles; the Capacitor plugins are only ever imported behind it. Static imports are
// not an option: they would pull the native plugins into every web bundle.
import { translate } from "@/i18n/translate.js";
import type { AppState } from "@/shared/lib/types.js";
import { parseStoredState, type ParsedAppStatePatch } from "@/shared/lib/schemas.js";

export const MOBILE = import.meta.env.VITE_MOBILE === "1";

const FILE = "workset-state.json";

export async function nativeLoad(): Promise<ParsedAppStatePatch | null> {
  try {
    const { Filesystem, Directory, Encoding } = await import("@capacitor/filesystem");
    const file = await Filesystem.readFile({
      path: FILE,
      directory: Directory.Data,
      encoding: Encoding.UTF8,
    });
    const raw = typeof file.data === "string" ? file.data : await file.data.text();
    return parseStoredState(raw);
  } catch {
    return null;
  } // first launch, or unreadable — localStorage copy takes over
}

export async function nativeSave(state: AppState): Promise<void> {
  try {
    const { Filesystem, Directory, Encoding } = await import("@capacitor/filesystem");
    await Filesystem.writeFile({
      path: FILE,
      directory: Directory.Data,
      data: JSON.stringify(state),
      encoding: Encoding.UTF8,
    });
  } catch {
    /* keep the localStorage copy */
  }
}

// (Re)schedule the workout-day reminder: one repeating notification per weekday that has a
// routine in the weekly plan. Cheap enough to run after any state change — the plan or the
// reminder time may just have been edited. `interactive` gates the OS permission prompt to
// the Settings toggle; a background resync never pops a dialog.
export async function syncReminder(appState: AppState, interactive = false): Promise<boolean> {
  try {
    const { LocalNotifications } = await import("@capacitor/local-notifications");
    await LocalNotifications.cancel({
      notifications: [0, 1, 2, 3, 4, 5, 6].map((weekday) => ({
        id: 100 + weekday,
      })),
    }).catch(() => {});
    const reminder = appState.reminder;
    if (!reminder?.on) return true;
    let permission = await LocalNotifications.checkPermissions();
    if (permission.display !== "granted" && interactive)
      permission = await LocalNotifications.requestPermissions();
    if (permission.display !== "granted") return false;
    const [hour, minute] = (reminder.time || "08:00").split(":").map(Number);
    const notifications = Object.entries(appState.week).flatMap(([day, routineId]) => {
      const routine = appState.routines.find((candidate) => candidate.id === routineId);
      if (!routine) return [];
      return [
        {
          id: 100 + Number(day),
          title: translate("mobile.workoutDay", "Workout day"),
          body: translate(
            "mobile.planTodayLetSGo",
            "{{routine}} is on the plan today — let’s go!",
            {
              routine: routine.name,
            },
          ),
          // Capacitor weekdays are 1 (Sunday) … 7 (Saturday); appState.week uses getDay() 0…6.
          schedule: {
            on: { weekday: Number(day) + 1, hour, minute },
            allowWhileIdle: true,
          },
        },
      ];
    });
    if (notifications.length > 0) await LocalNotifications.schedule({ notifications });
    return true;
  } catch {
    return false;
  }
}

// WKWebView can't do blob-URL downloads, so the backup goes out through the OS share sheet
// (Files, AirDrop, mail, …) from a temp file instead.
export async function shareExport(json: string, filename: string): Promise<void> {
  const [{ Filesystem, Directory, Encoding }, { Share }] = await Promise.all([
    import("@capacitor/filesystem"),
    import("@capacitor/share"),
  ]);
  const file = await Filesystem.writeFile({
    path: filename,
    directory: Directory.Cache,
    data: json,
    encoding: Encoding.UTF8,
  });
  await Share.share({ title: filename, url: file.uri });
}
