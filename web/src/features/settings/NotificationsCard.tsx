import { useTranslation } from "react-i18next";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { DEFAULT_STATE } from "@/app/store/useStore";
import { localTZ } from "@/shared/lib/format";
import { pushSupported, enablePush, disablePush, sendTestPush } from "@/features/settings/push";
import { MOBILE, syncReminder } from "@/shared/lib/mobile";
import Icon from "@/shared/components/Icon";
import { Row, Section } from "@/shared/components/layout";
import { Switch } from "@/shared/ui/switch";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import type { AppState } from "@/shared/lib/types";

interface CardProps {
  appState: AppState;
  update: (fn: (state: AppState) => void) => void;
  notify: (msg: string) => void;
}

export function NotificationsCard({ appState, update, notify }: CardProps) {
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
        ...(state.reminder || DEFAULT_STATE.reminder),
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
          reminder: { ...(appState.reminder || DEFAULT_STATE.reminder), on: true },
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
          checked={appState.reminder?.on ?? false}
          onCheckedChange={() => void toggle()}
        />
      </Row>
      {appState.reminder?.on && (
        <Row
          icon="clock"
          iconTint="var(--system-purple)"
          title={t("settings.reminderTime", "Reminder time")}
        >
          <Input
            aria-label={t("settings.reminderTime", "Reminder time")}
            className="w-auto rounded-lg border-0 bg-muted px-2.5 py-1.5 text-base text-foreground tabular-nums outline-none"
            value={appState.reminder?.time || DEFAULT_STATE.reminder.time}
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
              checked={appState.reminder?.on ?? false}
              onCheckedChange={() =>
                update((state) => {
                  state.reminder = {
                    ...(state.reminder || DEFAULT_STATE.reminder),
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
            <Input
              aria-label={t("settings.reminderTime", "Reminder time")}
              className="w-auto rounded-lg border-0 bg-muted px-2.5 py-1.5 text-base text-foreground tabular-nums outline-none"
              value={appState.reminder?.time || DEFAULT_STATE.reminder.time}
              onChange={(event) =>
                update((state) => {
                  state.reminder = {
                    ...(state.reminder || DEFAULT_STATE.reminder),
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
