import { useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useStore, DEF } from "../store/useStore";
import { todayISO, localTZ, fmtPlate } from "../lib/format";
import { ACCENT_NAMES, DEFAULT_ACCENT } from "../lib/accents";
import { effortOf } from "../lib/history";
import { parseBackup } from "../lib/backup";
import { buildExport } from "../lib/export-csv";
import { barWeightFor, COMMON_PLATES, defaultPlateSetup, effectivePlateSetup } from "../lib/plates";
import { EXIDX } from "../lib/exercises";
import { webauthnOK, passkeyLogin, IS_ANDROID } from "../lib/api";
import { pushSupported, enablePush, disablePush, sendTestPush } from "../lib/push";
import { wakeLockSupported } from "../lib/wakelock";
import { LANGUAGES } from "../lib/languages";
import { useEffortLabels } from "../hooks/use-effort-labels";
import { DEMO, REPO } from "../lib/demo";
import { MOBILE, shareExport, syncReminder } from "../lib/mobile";
import { CuratedPlans } from "../sheets/curated";
import { ImportSummary } from "../sheets/import";
import { importFromApp, type ParsedImport } from "../sheets/import-actions";
import Icon from "../components/Icon";
import { Section, Row } from "../components/layout";
import { SelectRow } from "../components/SelectRow";
import { Switch } from "../components/ui/switch";
import { cn } from "../lib/utils";
import { Segmented } from "../components/Segmented";
import { Stepper } from "../components/Stepper";
import { Button } from "../components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "../components/ui/dialog";
import ConfirmDialog from "../components/ConfirmDialog";
import type { ConfirmDialogOptions } from "../components/ConfirmDialog";
import RegistrationDialog from "../components/RegistrationDialog";
import type { AppState, Unit, Theme, Body, EffortScale, SheetClose } from "../lib/types";
import { toast } from "../lib/toast";
import { Sheet, SheetContent, SheetTitle } from "../components/ui/sheet";

type SettingsSheet = { kind: "curated" } | { kind: "import"; parsed: ParsedImport };

function SettingsContent() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const user = useStore((state) => state.user);
  const setUser = useStore((state) => state.setUser);
  const pullState = useStore((state) => state.pullState);
  const resetDemo = useStore((state) => state.resetDemo);
  const [registrationOpen, setRegistrationOpen] = useState(false);
  const [effortHelpOpen, setEffortHelpOpen] = useState(false);
  const [confirmation, setConfirmation] = useState<ConfirmDialogOptions | null>(null);
  const [activeSheet, setActiveSheet] = useState<SettingsSheet | null>(null);
  const closeSheet: SheetClose = () => {
    setActiveSheet(null);
    return Promise.resolve();
  };
  const requestConfirmation = (options: ConfirmDialogOptions) => setConfirmation(options);
  const signInHere = async () => {
    try {
      const u = await passkeyLogin();
      setUser(u);
      await pullState();
      toast(t("account.welcomeBack", "Welcome back, {{name}}", { name: u.name }));
    } catch (e) {
      if (e instanceof Error && e.name !== "NotAllowedError" && e.name !== "AbortError")
        toast(e.message || t("account.signFailed", "Sign-in failed"));
      else if (!(e instanceof Error)) toast(t("account.signFailed", "Sign-in failed"));
    }
  };
  return (
    <div className="mx-auto w-full max-w-160">
      <div className="proof-header mt-2 mb-4.5 flex items-end justify-between gap-3">
        <button
          className="flex size-9 flex-none items-center justify-center rounded-full bg-card text-lg text-foreground transition duration-140 active:scale-95 active:bg-muted"
          onClick={() => navigate({ to: "/home" })}
          aria-label={t("navigation.home", "Home")}
        >
          <Icon name="chevronLeft" />
        </button>
        <div className="ml-2.5 min-w-0 flex-1">
          <h1 className="text-4xl leading-none font-bold tracking-tight">
            {t("navigation.settings", "Settings")}
          </h1>
        </div>
      </div>

      {/* ---------- account (demo and mobile builds have nothing to sign in to) ---------- */}
      <Section
        title={
          MOBILE
            ? t("mobile.yourData", "Your data")
            : DEMO
              ? t("account.demo.title", "Demo")
              : t("settings.account", "Account")
        }
      >
        {MOBILE ? (
          <>
            <Row
              icon="lock"
              iconTint="var(--primary)"
              title={t("mobile.allDataStaysPhone", "All data stays on this phone")}
              subtitle={t(
                "mobile.noAccountNoCloudBack",
                "No account, no cloud — back it up anytime with Export below.",
              )}
            />
            <Row
              icon="rocket"
              iconTint="var(--system-indigo)"
              title={t("account.selfHostTitle", "Self-host Set & Signal")}
              subtitle={t(
                "account.selfHostDescription",
                "Passkey sign-in, sync across your devices, your own data.",
              )}
              accessory="chevron"
              onClick={() => window.open(REPO, "_blank", "noopener")}
            />
          </>
        ) : DEMO ? (
          <>
            <Row
              icon="sparkles"
              iconTint="var(--primary)"
              title={t("account.demo.activeTitle", "You’re in the demo")}
              subtitle={t(
                "account.demo.activeDescription",
                "Example data, stored only in this browser — change anything you like.",
              )}
            />
            <Row
              icon="reset"
              iconTint="var(--system-blue)"
              title={t("account.demo.reset", "Reset demo data")}
              accessory="chevron"
              onClick={() =>
                requestConfirmation({
                  title: t("account.demo.resetPrompt", "Reset demo data?"),
                  description: t(
                    "account.demo.resetDescription",
                    "Puts the example plan, workouts and weigh-ins back the way they started.",
                  ),
                  confirmLabel: t("common.reset", "Reset"),
                  onConfirm: async () => {
                    await resetDemo();
                    void navigate({ to: "/home" });
                    toast(t("account.demo.resetSuccess", "Demo data reset"));
                  },
                })
              }
            />
            <Row
              icon="rocket"
              iconTint="var(--system-indigo)"
              title={t("account.selfHostTitle", "Self-host Set & Signal")}
              subtitle={t(
                "account.selfHostDescription",
                "Passkey sign-in, sync across your devices, your own data.",
              )}
              accessory="chevron"
              onClick={() => window.open(REPO, "_blank", "noopener")}
            />
          </>
        ) : user ? (
          <UserRows requestConfirmation={requestConfirmation} />
        ) : webauthnOK() ? (
          <>
            <Row
              icon="sparkles"
              iconTint="var(--primary)"
              title={t("settings.createPasskeyProfile", "Create passkey profile")}
              subtitle={t(
                "account.dataSeparationDescription",
                "Keeps your data safe and separate per person.",
              )}
              accessory="chevron"
              onClick={() => setRegistrationOpen(true)}
            />
            <Row
              icon="person"
              iconTint="var(--system-blue)"
              title={t("account.signPasskey", "Sign in with passkey")}
              accessory="chevron"
              onClick={signInHere}
            />
          </>
        ) : (
          <Row
            icon="lock"
            iconTint="var(--system-grey)"
            title={t(
              "settings.passkeysNotSupportedBrowser",
              "Passkeys not supported in this browser.",
            )}
          />
        )}
      </Section>
      {!user && !DEMO && !MOBILE && (
        <p className="-mt-4.5 mb-5.5 px-1 pt-2 text-sm leading-snug text-foreground/60">
          {t("account.guestModeDescription", "Guest mode — data lives only in this browser.")}
        </p>
      )}

      <SettingsPreferences onEffortHelp={() => setEffortHelpOpen(true)} />

      <SettingsData
        user={user}
        requestConfirmation={requestConfirmation}
        onOpenSheet={setActiveSheet}
      />
      <RegistrationDialog open={registrationOpen} onOpenChange={setRegistrationOpen} />
      <EffortHelpDialog open={effortHelpOpen} onOpenChange={setEffortHelpOpen} />
      {confirmation && (
        <ConfirmDialog
          {...confirmation}
          open
          onOpenChange={(open) => {
            if (!open) setConfirmation(null);
          }}
        />
      )}
      <Sheet
        open={activeSheet !== null}
        onOpenChange={(open) => {
          if (!open) setActiveSheet(null);
        }}
      >
        <SheetContent
          side="bottom"
          className="max-h-screen touch-pan-y overflow-y-auto overscroll-contain rounded-2xl bg-sheet p-2 px-4.5 pb-5 lg:inset-x-auto lg:left-1/2 lg:w-160 lg:-translate-x-1/2"
          showCloseButton={false}
        >
          <SheetTitle className="sr-only">
            {activeSheet?.kind === "curated"
              ? t("plans.curated.title", "Curated plans")
              : t("import.importHistory", "Import history")}
          </SheetTitle>
          <div className="mx-auto mt-1.5 mb-3.5 h-1 w-9 rounded-full bg-foreground/20" />
          {activeSheet?.kind === "curated" && <CuratedPlans close={closeSheet} />}
          {activeSheet?.kind === "import" && (
            <ImportSummary parsed={activeSheet.parsed} close={closeSheet} />
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}

export default function Settings() {
  return <SettingsContent />;
}

function SettingsPreferences({ onEffortHelp }: { onEffortHelp: () => void }) {
  const { t } = useTranslation();
  const appState = useStore((state) => state.appState);
  const update = useStore((state) => state.update);
  const user = useStore((state) => state.user);
  const wakeOK = wakeLockSupported();
  return (
    <>
      <Section
        title={t("settings.general", "General")}
        footer={t(
          "settings.noteSwitchingUnitsOnlyChanges",
          "Note: switching units only changes the label — logged numbers are not converted.",
        )}
      >
        <SelectRow
          icon="globe"
          iconTint="var(--system-blue)"
          title={t("settings.language", "Language")}
          value={appState.lang || "en"}
          onChange={(value) => update((state) => void (state.lang = value))}
          options={Object.entries(LANGUAGES).map(([key, language]) => ({
            value: key,
            label: language.label,
            subtitle: language.hasExercises
              ? undefined
              : t(
                  "settings.exerciseInstructionsArenTAvailable",
                  "Exercise instructions aren't available in this language yet — they stay in English.",
                ),
          }))}
        />
        <Row
          icon="scale"
          iconTint="var(--system-teal)"
          title={t("settings.weightUnit", "Weight unit")}
        >
          <Segmented<Unit>
            className="min-w-33 flex-none [&_button]:min-h-7 [&_button]:px-2.5 [&_button]:py-1.5 [&_button_[data-icon]]:text-sm"
            options={[
              { value: "lb", label: "lb" },
              { value: "kg", label: "kg" },
            ]}
            value={appState.unit}
            onChange={(value) =>
              update((state) => {
                state.unit = value;
                // A kg inventory means nothing once the profile reads lb: re-seed the
                // plate calculator with the new unit's defaults.
                if (state.plates) state.plates = defaultPlateSetup(value);
              })
            }
          />
        </Row>
      </Section>
      <Section
        title={t("settings.duringWorkout", "During a workout")}
        footer={
          wakeOK
            ? t(
                "settings.screenStaysWhileWorkoutRunning",
                "The screen stays on while a workout is running, so you don’t have to unlock your phone between sets.",
              )
            : null
        }
      >
        <SelectRow
          icon="timer"
          iconTint="var(--system-orange)"
          title={t("settings.restTimer", "Rest timer")}
          value={String(appState.restSec)}
          onChange={(value) => update((state) => void (state.restSec = Number(value)))}
          options={[60, 90, 120, 150, 180].map((value) => ({
            value: String(value),
            label: value + "s",
          }))}
        />
        {(wakeOK || !MOBILE) && (
          <Row
            icon="sun"
            iconTint="var(--warning)"
            title={t("settings.keepScreenAwake", "Keep screen awake")}
            subtitle={
              wakeOK ? null : t("settings.notSupportedBrowser", "Not supported in this browser.")
            }
          >
            <Switch
              aria-label={t("settings.keepScreenAwake", "Keep screen awake")}
              checked={wakeOK && appState.keepAwake !== false}
              disabled={!wakeOK}
              onCheckedChange={(keepAwake) => update((state) => void (state.keepAwake = keepAwake))}
            />
          </Row>
        )}
        <Row icon="bell" iconTint="var(--system-pink)" title={t("settings.sounds", "Sounds")}>
          <Switch
            aria-label={t("settings.sounds", "Sounds")}
            checked={!!appState.sound}
            onCheckedChange={(soundEnabled) => update((state) => void (state.sound = soundEnabled))}
          />
        </Row>
        <Row
          icon="target"
          iconTint="var(--system-purple)"
          title={t("effort.effortPerSet", "Effort per set")}
        >
          <button
            className="-mx-px -my-3 flex-none bg-transparent px-1 py-3 text-base leading-none text-muted-foreground active:text-foreground"
            aria-label={t("effort.whatRirRpe", "What are RIR and RPE?")}
            onClick={onEffortHelp}
          >
            <Icon name="info" />
          </button>
          <Segmented<EffortScale>
            className="min-w-33 flex-none [&_button]:min-h-7 [&_button]:px-2.5 [&_button]:py-1.5 [&_button_[data-icon]]:text-sm"
            options={[
              { value: "none", label: t("common.off", "Off") },
              { value: "rir", label: t("effort.rir", "RIR") },
              { value: "rpe", label: t("effort.rpe", "RPE") },
            ]}
            value={effortOf(appState)}
            onChange={(effortScale) =>
              update((state) => {
                state.effort = effortScale;
                delete state.showRir;
              })
            }
          />
        </Row>
      </Section>
      <Section
        title={t("settings.barbell.title", "Barbell")}
        footer={t(
          "settings.barbell.description",
          "Barbell exercises include the bar in their total and show which plates to load per side — or the closest weight your rack can build.",
        )}
      >
        <Row
          icon="barbell"
          iconTint="var(--primary)"
          title={t("settings.barbell.plateCalculator", "Plate calculator")}
        >
          <Switch
            aria-label={t("settings.barbell.plateCalculator", "Plate calculator")}
            checked={appState.plates?.on ?? true}
            onCheckedChange={(on) =>
              update((state) => {
                if (!state.plates) state.plates = defaultPlateSetup(state.unit);
                state.plates.on = on;
              })
            }
          />
        </Row>
        {(appState.plates?.on ?? true) && (
          <>
            <Row
              icon="weight"
              iconTint="var(--system-orange)"
              title={t("settings.barbell.barWeight", "Bar weight ({{unit}})", {
                unit: appState.unit,
              })}
            >
              <Stepper
                className="min-w-33 [&_button]:size-9"
                value={barWeightFor(appState.unit, appState.plates)}
                step={appState.unit === "lb" ? 5 : 2.5}
                onChange={(bar) =>
                  update((state) => {
                    if (!state.plates) state.plates = defaultPlateSetup(state.unit);
                    state.plates.bar = bar ?? 0;
                  })
                }
              />
            </Row>
            <div className="w-full px-3.5 pt-1 pb-3.5">
              <div className="mb-2 text-sm leading-snug text-foreground/60">
                {t("settings.barbell.availablePlates", "Plates you have (per side)")}
              </div>
              <div className="flex flex-wrap gap-2">
                {COMMON_PLATES[appState.unit].map((plate) => {
                  const setup = effectivePlateSetup(appState.unit, appState.plates);
                  const active = setup.avail.includes(plate);
                  return (
                    <button
                      key={plate}
                      type="button"
                      aria-pressed={active}
                      className={`min-w-11 rounded-md px-2 py-1.5 text-sm font-medium tabular-nums transition-colors active:bg-input ${
                        active
                          ? "bg-primary text-primary-foreground"
                          : "bg-muted text-foreground/60"
                      }`}
                      onClick={() =>
                        update((state) => {
                          if (!state.plates) state.plates = defaultPlateSetup(state.unit);
                          state.plates.avail = active
                            ? state.plates.avail.filter((candidate) => candidate !== plate)
                            : [...state.plates.avail, plate];
                        })
                      }
                    >
                      {fmtPlate(plate)}
                    </button>
                  );
                })}
              </div>
            </div>
          </>
        )}
      </Section>
      {(!!user || MOBILE) && (
        <NotificationsCard appState={appState} update={update} notify={toast} />
      )}
      <Section
        title={t("settings.appearance", "Appearance")}
        footer={DEMO || MOBILE ? null : t("settings.syncedProfile", "synced with your profile")}
      >
        <Row icon="moon" iconTint="var(--system-indigo)" title={t("settings.theme", "Theme")}>
          <Segmented<Theme>
            className="min-w-33 flex-none [&_button]:min-h-7 [&_button]:px-2.5 [&_button]:py-1.5 [&_button_[data-icon]]:text-sm"
            options={[
              { value: "dark", icon: "moon", label: t("settings.dark", "Dark") },
              { value: "light", icon: "sun", label: t("settings.light", "Light") },
            ]}
            value={appState.theme === "light" ? "light" : "dark"}
            onChange={(theme) => update((state) => void (state.theme = theme))}
          />
        </Row>
        <Row
          icon="figureStrength"
          iconTint="var(--system-teal)"
          title={t("muscleMap.bodyDiagram", "Body diagram")}
        >
          <Segmented<Body>
            className="min-w-33 flex-none [&_button]:min-h-7 [&_button]:px-2.5 [&_button]:py-1.5 [&_button_[data-icon]]:text-sm"
            options={[
              { value: "male", label: t("muscleMap.male", "Male") },
              { value: "female", label: t("muscleMap.female", "Female") },
            ]}
            value={appState.body === "female" ? "female" : "male"}
            onChange={(body) => update((state) => void (state.body = body))}
          />
        </Row>
        <div className="relative flex w-full flex-col items-stretch gap-3 px-3.5 pt-3 pb-3.5 text-left">
          <span className="text-lg leading-tight tracking-tight">
            {t("settings.accentColor", "Accent color")}
          </span>
          <div className="flex flex-wrap gap-3">
            {ACCENT_NAMES.map((accentName) => (
              <button
                type="button"
                key={accentName}
                data-accent-swatch={accentName}
                className={cn(
                  "relative size-8 flex-none rounded-full bg-accent-swatch transition-transform duration-140 active:scale-90",
                  (appState.accent || DEFAULT_ACCENT) === accentName &&
                    "after:absolute after:-inset-1 after:rounded-full after:ring-2 after:ring-foreground",
                )}
                onClick={() => update((state) => void (state.accent = accentName))}
                aria-label={accentName}
                aria-pressed={(appState.accent || DEFAULT_ACCENT) === accentName}
              />
            ))}
          </div>
        </div>
      </Section>
    </>
  );
}

function SettingsData({
  user,
  requestConfirmation,
  onOpenSheet,
}: {
  user: { name: string } | null;
  requestConfirmation: (options: ConfirmDialogOptions) => void;
  onOpenSheet: (sheet: SettingsSheet) => void;
}) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const appState = useStore((state) => state.appState);
  const replaceState = useStore((state) => state.replaceState);
  const fileRef = useRef<HTMLInputElement>(null);
  const importRef = useRef<HTMLInputElement>(null);
  const doExport = async () => {
    const json = JSON.stringify(appState, null, 2);
    const name = "set-and-signal-backup-" + todayISO() + ".json";
    if (MOBILE) {
      try {
        await shareExport(json, name);
        toast(t("settings.backupExported", "Backup exported"));
      } catch {
        /* share sheet dismissed */
      }
      return;
    }
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = name;
    anchor.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    toast(t("settings.backupExported", "Backup exported"));
  };
  const doExportCsv = async () => {
    const { csv, filename } = buildExport(appState, (id) => EXIDX[id]?.n || id);
    if (MOBILE) {
      try {
        await shareExport(csv, filename);
        toast(t("settings.workoutsExported", "Workouts exported"));
      } catch {
        /* share sheet dismissed */
      }
      return;
    }
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = filename;
    anchor.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    toast(t("settings.workoutsExported", "Workouts exported"));
  };
  const doImport = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    void file
      .text()
      .then((contents) => {
        try {
          const restoredState = parseBackup(contents);
          requestConfirmation({
            title: t("settings.importBackupPrompt", "Import backup?"),
            description: t(
              "settings.replacesAllCurrentDataBackup",
              "This replaces all current data with the backup file.",
            ),
            confirmLabel: t("common.import", "Import"),
            danger: true,
            onConfirm: () => {
              replaceState(restoredState, true);
              toast(t("settings.backupImported", "Backup imported"));
            },
          });
        } catch (error) {
          toast(
            t("settings.importFailed", "Import failed: {{error}}", {
              error: error instanceof Error ? error.message : String(error),
            }),
          );
        }
      })
      .catch((error: unknown) =>
        toast(
          t("settings.importFailed", "Import failed: {{error}}", {
            error: error instanceof Error ? error.message : String(error),
          }),
        ),
      );
    event.target.value = "";
  };
  return (
    <>
      <Section title={t("settings.data", "Data")}>
        <Row
          icon="sparkles"
          iconTint="var(--primary)"
          title={t("plans.curated.title", "Curated plans")}
          accessory="chevron"
          onClick={() => onOpenSheet({ kind: "curated" })}
        />
        <Row
          icon="shuffle"
          iconTint="var(--system-teal)"
          title={t("import.importAnotherApp", "Import from another app")}
          subtitle={t(
            "import.fitNotesStrongHevyBody",
            "FitNotes, Strong, Hevy — or body weight from Apple Health",
          )}
          accessory="chevron"
          onClick={() => importRef.current?.click()}
        />
        <Row
          icon="upload"
          iconTint="var(--system-blue)"
          title={t("settings.importBackup", "Import backup")}
          accessory="chevron"
          onClick={() => fileRef.current?.click()}
        />
        <Row
          icon="download"
          iconTint="var(--system-blue)"
          title={t("settings.exportBackupJson", "Export backup (JSON)")}
          accessory="chevron"
          onClick={doExport}
        />
        <Row
          icon="download"
          iconTint="var(--system-teal)"
          title={t("settings.exportWorkoutsCsv", "Export workouts (CSV)")}
          subtitle={t(
            "settings.exportWorkoutsCsvDescription",
            "Opens in Excel, Sheets — or imports into Strong, Hevy & friends",
          )}
          accessory="chevron"
          onClick={() => void doExportCsv()}
        />
        <Row
          icon="trash"
          iconTint="var(--destructive)"
          title={t("settings.resetEverythingLabel", "Reset everything")}
          danger
          onClick={() =>
            requestConfirmation({
              title: t("settings.resetEverything", "Reset everything?"),
              description: t(
                "settings.deletesPlanWorkoutsBodyWeight",
                "Deletes your plan, workouts and body weight on this device. This cannot be undone.",
              ),
              confirmLabel: t("settings.deleteEverything", "Delete everything"),
              danger: true,
              onConfirm: () => {
                replaceState(structuredClone(DEF), true);
                void navigate({ to: "/home" });
                toast(t("settings.allDataReset", "All data reset"));
              },
            })
          }
        />
      </Section>
      <input
        ref={fileRef}
        type="file"
        accept=".json,application/json"
        className="hidden"
        onChange={doImport}
      />
      <input
        ref={importRef}
        type="file"
        accept=".csv,.xml,text/csv,text/xml"
        className="hidden"
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) importFromApp(file, (parsed) => onOpenSheet({ kind: "import", parsed }));
          event.target.value = "";
        }}
      />
      {!MOBILE && (
        <Section title={t("settings.tip", "Tip")}>
          <Row
            icon="lightbulb"
            iconTint="var(--warning)"
            title={
              IS_ANDROID
                ? t("settings.chromeMenuAddHomeScreen", "In Chrome: ⋮ menu → Add to Home screen")
                : t("settings.safariShareAddHomeScreen", "In Safari: Share → Add to Home Screen")
            }
            subtitle={
              t("settings.installAppFullScreen", "to install Set & Signal as a full-screen app.") +
              " " +
              (user
                ? t(
                    "settings.dataSyncsProfileSignAnywhere",
                    "Your data syncs with your profile — sign in anywhere to see it.",
                  )
                : t(
                    "settings.guestDataStaysDeviceExport",
                    "Guest data stays on this device — export a backup now and then!",
                  ))
            }
          />
        </Section>
      )}
      <div className="mt-1 text-center text-sm leading-relaxed text-muted-foreground">
        Set &amp; Signal · {t("settings.freeOpenSourceAgplV3", "free & open source (AGPL v3)")}
        <br />
        <a className="underline" href={REPO} target="_blank" rel="noreferrer">
          source code
        </a>{" "}
        · exercise data: hasaneyldrm/exercises-dataset (CC)
      </div>
    </>
  );
}

// The signed-in rows live apart only because the user object is a server passthrough;
// its fields are narrowed once at this boundary instead of at every row.
function UserRows({
  requestConfirmation,
}: {
  requestConfirmation: (options: ConfirmDialogOptions) => void;
}) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const user = useStore((state) => state.user);
  const signOut = useStore((state) => state.signOut);
  if (!user) return null;
  return (
    <>
      <Row
        icon="personCircle"
        iconTint="var(--system-grey)"
        title={user.name}
        subtitle={t(
          "settings.signedPasskeyDataSyncsProfile",
          "Signed in with passkey — data syncs to this profile.",
        )}
      />
      {user.admin && (
        <Row
          icon="wrench"
          iconTint="var(--system-indigo)"
          title={t("customExercise.adminDashboard", "Admin dashboard")}
          accessory="chevron"
          onClick={() => navigate({ to: "/admin" })}
        />
      )}
      <Row
        icon="signOut"
        iconTint="var(--destructive)"
        title={t("settings.signOutLabel", "Sign out")}
        danger
        onClick={() =>
          requestConfirmation({
            title: t("settings.signOut", "Sign out?"),
            description: t(
              "settings.dataSyncedProfileFirstCleared",
              "Your data is synced to your profile first, then cleared from this device.",
            ),
            confirmLabel: t("settings.signOutLabel", "Sign out"),
            danger: true,
            onConfirm: async () => {
              await signOut();
              void navigate({ to: "/home" });
            },
          })
        }
      />
      <Row
        icon="shield"
        iconTint="var(--destructive)"
        title={t("settings.signOutEverywhereLabel", "Sign out everywhere")}
        subtitle={t(
          "settings.endsProfileSSessionsAll",
          "Ends this profile’s sessions on all your devices.",
        )}
        danger
        onClick={() => {
          // Ends the profile's sessions on every device — this one included, so on success it lands in
          // the same place as the plain sign-out above (home, local data cleared). On failure nothing
          // local is touched: still signed in here, and say so rather than leaving a half-signed-out app.
          requestConfirmation({
            title: t("settings.signOutEverywhere", "Sign out everywhere?"),
            description: t(
              "settings.signsProfileOutEveryDevice",
              "Signs this profile out on every device, including this one. Your passkeys keep working — sign in with them again anytime.",
            ),
            confirmLabel: t("settings.signOutEverywhereLabel", "Sign out everywhere"),
            danger: true,
            onConfirm: async () => {
              try {
                await useStore.getState().signOutAll();
                void navigate({ to: "/home" });
                toast(t("settings.signedOutAllDevices", "Signed out on all devices"));
              } catch {
                toast(
                  t(
                    "settings.couldNotSignOutEverywhere",
                    "Could not sign out everywhere — you are still signed in.",
                  ),
                );
              }
            },
          });
        }}
      />
    </>
  );
}

// The whole point is that the two scales are one judgement counted from opposite ends, and a
// paragraph is a bad way to say that — the conversion table shows it in one look. Reading down
// a column is the answer to "what do I put here", so the numbers get their own aligned columns.
const EFFORT_ROWS = [
  ["0", "10"],
  ["1", "9"],
  ["2", "8"],
  ["3", "7"],
  ["4+", "≤6"],
] as const;
// RIR 2 / RPE 8: the row a working set usually lands on — the anchor the others are read
// against. Not where the stepper starts; + walks up from the bottom of the scale.
const EFFORT_TYPICAL = 2;
function EffortHelpContent() {
  const { t } = useTranslation();
  const effortLabels = useEffortLabels();
  return (
    <>
      <div className="my-3 mb-3 overflow-hidden rounded-xl bg-card">
        <div className="flex items-center gap-2 bg-muted px-3.5 py-2">
          <span className="w-9 flex-none text-center text-xs font-semibold tracking-wider text-muted-foreground uppercase">
            {t("effort.rir", "RIR")}
          </span>
          <span className="w-9 flex-none text-center text-xs font-semibold tracking-wider text-muted-foreground uppercase">
            {t("effort.rpe", "RPE")}
          </span>
          <span className="min-w-0 flex-1 text-xs font-semibold tracking-wider text-muted-foreground uppercase">
            {t("effort.howFelt", "How it felt")}
          </span>
        </div>
        {EFFORT_ROWS.map(([rir, rpe], i) => (
          <div
            key={rir}
            className={`relative flex items-center gap-2 px-3.5 py-2.5 ${i === EFFORT_TYPICAL ? "bg-primary/15" : ""}`}
          >
            <span
              className={`w-9 flex-none text-center text-lg font-semibold tracking-tight tabular-nums ${i === EFFORT_TYPICAL ? "text-primary" : ""}`}
            >
              {rir}
            </span>
            <span
              className={`w-9 flex-none text-center text-lg font-semibold tracking-tight tabular-nums ${i === EFFORT_TYPICAL ? "text-primary" : ""}`}
            >
              {rpe}
            </span>
            <span
              className={`min-w-0 flex-1 text-base leading-snug text-foreground/60 ${i === EFFORT_TYPICAL ? "text-foreground" : ""}`}
            >
              {effortLabels.feelings[i]}
            </span>
          </div>
        ))}
      </div>
      <div className="grid gap-2 text-sm leading-normal text-muted-foreground">
        <div>
          {t(
            "effort.rirCountsRepsLeftRpe",
            "RIR counts the reps you left; RPE reads the same effort off a 10-point scale — so RPE ≈ 10 − RIR. Pick the one you already think in.",
          )}
        </div>
        <div>
          {t(
            "effort.highlightedRowWhereMostWorking",
            "The highlighted row is where most working sets land. Sets you have already logged keep their own scale, and nothing else reads the value — progression and estimated 1RM are unaffected.",
          )}
        </div>
      </div>
      <div className="h-2" />
    </>
  );
}

function EffortHelpDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { t } = useTranslation();
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-full max-w-xs rounded-xl bg-modal p-5 shadow-lg">
        <DialogHeader>
          <DialogTitle>{t("effort.effortPerSet", "Effort per set")}</DialogTitle>
          <DialogDescription>
            {t(
              "effort.howHardSetLoggedNext",
              "How hard a set was, logged next to weight and reps. Two scales for the same judgement, counted from opposite ends.",
            )}
          </DialogDescription>
        </DialogHeader>
        <EffortHelpContent />
      </DialogContent>
    </Dialog>
  );
}

interface CardProps {
  appState: AppState;
  update: (fn: (state: AppState) => void) => void;
  notify: (msg: string) => void;
}

function NotificationsCard({ appState, update, notify }: CardProps) {
  if (MOBILE) return <MobileReminderCard appState={appState} update={update} notify={notify} />;
  return <PushCard appState={appState} update={update} notify={notify} />;
}

// Mobile build: the reminder is a native local notification scheduled on planned weekdays —
// no push server involved. The schedule itself is (re)synced by the store on every persist;
// this card only owns the OS permission prompt when the switch turns on.
function MobileReminderCard({ appState, update, notify }: CardProps) {
  const { t } = useTranslation();
  const setReminder = (patch: Partial<AppState["reminder"]>) =>
    update((state) => {
      state.reminder = {
        ...(state.reminder || DEF.reminder),
        ...patch,
        tz: localTZ(),
      };
    });
  const toggle = async () => {
    const on = !appState.reminder?.on;
    if (on) {
      const ok = await syncReminder(
        {
          ...appState,
          reminder: { ...(appState.reminder || DEF.reminder), on: true },
        },
        true,
      );
      if (!ok) {
        notify(
          t(
            "settings.couldNotChangeNotificationSettings",
            "Could not change notification settings",
          ),
        );
        return;
      }
    }
    setReminder({ on });
  };
  return (
    <Section
      title={t("settings.notifications", "Notifications")}
      footer={
        appState.reminder?.on
          ? t(
              "mobile.remindsTimeDaysHaveRoutine",
              "Reminds you at this time on days that have a routine planned.",
            )
          : null
      }
    >
      <Row
        icon="calendar"
        iconTint="var(--system-orange)"
        title={t("settings.workoutDayReminder", "Workout day reminder")}
      >
        <Switch
          aria-label={t("settings.workoutDayReminder", "Workout day reminder")}
          checked={!!appState.reminder?.on}
          onCheckedChange={toggle}
        />
      </Row>
      {appState.reminder?.on && (
        <Row
          icon="clock"
          iconTint="var(--system-purple)"
          title={t("settings.reminderTime", "Reminder time")}
        >
          <input
            aria-label={t("settings.reminderTime", "Reminder time")}
            className="rounded-lg border-0 bg-muted px-2.5 py-1.5 text-base text-foreground tabular-nums outline-none"
            value={appState.reminder?.time || DEF.reminder.time}
            onChange={(e) => setReminder({ time: e.target.value })}
          />
        </Row>
      )}
    </Section>
  );
}

function PushCard({ appState, update, notify }: CardProps) {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const supported = pushSupported();
  // The subscription lives in the service worker's pushManager; react-query owns the read.
  const sub = useQuery({
    queryKey: ["push", "subscription"],
    queryFn: () => navigator.serviceWorker.ready.then((reg) => reg.pushManager.getSubscription()),
    enabled: supported,
  });
  const on = !!sub.data;

  const toggle = useMutation({
    mutationFn: (v: boolean) => (v ? enablePush() : disablePush()),
    onSuccess: (_r, v) => {
      notify(
        v
          ? t("settings.notificationsOn", "Notifications on")
          : t("settings.notificationsOff", "Notifications off"),
      );
      void qc.invalidateQueries({ queryKey: ["push", "subscription"] });
    },
    onError: (e) =>
      notify(
        e.message ||
          t(
            "settings.couldNotChangeNotificationSettings",
            "Could not change notification settings",
          ),
      ),
  });
  const test = useMutation({
    mutationFn: () => sendTestPush(),
    onSuccess: () =>
      notify(t("settings.testSentShouldArriveAny", "Test sent — should arrive any second")),
    onError: (e) => notify(e.message || t("settings.testFailed", "Test failed")),
  });

  if (!supported)
    return (
      <Section title={t("settings.notifications", "Notifications")}>
        <Row
          icon="bellSlash"
          iconTint="var(--system-grey)"
          title={t("settings.notSupportedBrowser", "Not supported in this browser.")}
        />
      </Section>
    );

  return (
    <>
      <Section
        title={t("settings.notifications", "Notifications")}
        footer={
          on && appState.reminder?.on
            ? t(
                "settings.onlySentDaysHaveRoutine",
                "Only sent on days you have a routine planned and haven't logged a workout yet.",
              ) +
              (appState.reminder?.tz
                ? " " +
                  t(
                    "settings.timezoneAutoDetectedUpdatesTravel",
                    "Timezone: {{timezone}} (auto-detected, updates if you travel).",
                    {
                      timezone: appState.reminder.tz,
                    },
                  )
                : "")
            : null
        }
      >
        <Row
          icon="bell"
          iconTint="var(--destructive)"
          title={t("settings.pushNotifications", "Push notifications")}
          subtitle={t(
            "settings.restTimerAlertsEvenOpen",
            "Rest-timer alerts, even if Set & Signal is closed.",
          )}
        >
          <Switch
            aria-label={t("settings.pushNotifications", "Push notifications")}
            checked={on}
            disabled={toggle.isPending}
            onCheckedChange={(v) => toggle.mutate(v)}
          />
        </Row>
        {on && (
          <Row
            icon="calendar"
            iconTint="var(--system-orange)"
            title={t("settings.workoutDayReminder", "Workout day reminder")}
          >
            <Switch
              aria-label={t("settings.workoutDayReminder", "Workout day reminder")}
              checked={!!appState.reminder?.on}
              onCheckedChange={() =>
                update((state) => {
                  state.reminder = {
                    ...(state.reminder || DEF.reminder),
                    on: !state.reminder?.on,
                    tz: localTZ(),
                  };
                })
              }
            />
          </Row>
        )}
        {on && appState.reminder?.on && (
          <Row
            icon="clock"
            iconTint="var(--system-purple)"
            title={t("settings.reminderTime", "Reminder time")}
          >
            <input
              aria-label={t("settings.reminderTime", "Reminder time")}
              className="rounded-lg border-0 bg-muted px-2.5 py-1.5 text-base text-foreground tabular-nums outline-none"
              value={appState.reminder?.time || DEF.reminder.time}
              onChange={(event) =>
                update((state) => {
                  state.reminder = {
                    ...(state.reminder || DEF.reminder),
                    time: event.target.value,
                    tz: localTZ(),
                  };
                })
              }
            />
          </Row>
        )}
      </Section>
      {on && (
        <div className="-mt-3 mb-5.5">
          <Button size="sm" onClick={() => test.mutate()}>
            <Icon name="bell" />
            {t("settings.sendTestNotification", "Send test notification")}
          </Button>
        </div>
      )}
    </>
  );
}
