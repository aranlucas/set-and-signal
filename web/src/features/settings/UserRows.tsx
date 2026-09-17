import { useTranslation } from "react-i18next";
import { useNavigate } from "@tanstack/react-router";
import { useStore } from "@/app/store/useStore";
import { Row } from "@/shared/components/layout";
import type { ConfirmDialogOptions } from "@/shared/components/ConfirmDialog";
import { toast } from "@/shared/lib/toast";

// The signed-in rows live apart only because the user object is a server passthrough;
// its fields are narrowed once at this boundary instead of at every row.
export function UserRows({
  requestConfirmation,
}: {
  requestConfirmation: (options: ConfirmDialogOptions) => void;
}) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const user = useStore((state) => state.user);
  const signOut = useStore((state) => state.signOut);
  const syncStatus = useStore((state) => state.syncStatus);
  const pending = syncStatus.pending > 0 || syncStatus.phase === "conflict";
  if (!user) return null;
  return (
    <>
      <Row
        icon="personCircle"
        iconTint="var(--system-grey)"
        title={user.name}
        subtitle={t(
          "sync.profileOwnership",
          "Your plan and completed workouts sync to this profile. Unfinished workouts stay on this device.",
        )}
      />
      {user.admin && (
        <Row
          icon="wrench"
          iconTint="var(--system-indigo)"
          title={t("customExercise.adminDashboard", "Admin dashboard")}
          accessory="chevron"
          onClick={() => void navigate({ to: "/admin" })}
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
            description: pending
              ? t(
                  "sync.signOutPending",
                  "Your latest changes haven’t synced yet. We’ll try saving them before signing out. If that fails, you’ll stay signed in and your edits will be kept.",
                )
              : t(
                  "sync.signOutDescription",
                  "Your saved training stays in your account. Any unfinished workout is kept on this device for when you sign back in.",
                ),
            confirmLabel: pending
              ? t("sync.saveSignOut", "Save & sign out")
              : t("settings.signOutLabel", "Sign out"),
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
            description: pending
              ? t(
                  "sync.signOutPending",
                  "Your latest changes haven’t synced yet. We’ll try saving them before signing out. If that fails, you’ll stay signed in and your edits will be kept.",
                )
              : t(
                  "settings.signsProfileOutEveryDevice",
                  "Signs this profile out on every device, including this one. Your passkeys keep working — sign in with them again anytime.",
                ),
            confirmLabel: t("settings.signOutEverywhereLabel", "Sign out everywhere"),
            danger: true,
            onConfirm: async () => {
              await useStore.getState().signOutAll();
              void navigate({ to: "/home" });
              toast(t("settings.signedOutAllDevices", "Signed out on all devices"));
            },
          });
        }}
      />
    </>
  );
}
