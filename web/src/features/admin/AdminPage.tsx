import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useStore } from "@/app/store/useStore";
import { api, apiParsed } from "@/shared/lib/api";
import { fmtDate, fmtDur, fmtVol } from "@/shared/lib/format";
import { workoutVolume, setsDone } from "@/domain/training/history";
import Icon from "@/shared/components/Icon";
import { Grid } from "@/shared/components/Grid";
import { MetricCard } from "@/shared/components/MetricCard";
import { Button } from "@/shared/ui/button";
import { toast } from "@/shared/lib/toast";
import {
  adminInviteResponse,
  adminInvitesResponse,
  adminUserResponse,
  adminUsersResponse,
} from "@/shared/lib/schemas";
import type { AdminLiveInfo, AdminUser, AdminInvite } from "@/shared/lib/schemas";
import type { SheetClose } from "@/shared/lib/types";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/shared/ui/alert-dialog";
import { Sheet, SheetContent, SheetTitle } from "@/shared/ui/sheet";

type LiveUser = AdminUser & { live: AdminLiveInfo };

// Admin-only operator dashboard (owner passkey + admin flag; guarded again server-side).
// Deliberately English-only — it isn't part of the translated end-user surface, so it stays
// out of the per-language string packs.

const formatRelativeTime = (timestamp: number | null | undefined) => {
  if (!timestamp) return "never";
  const secondsAgo = Math.max(0, (Date.now() - timestamp) / 1000);
  if (secondsAgo < 60) return "just now";
  if (secondsAgo < 3600) return Math.floor(secondsAgo / 60) + "m ago";
  if (secondsAgo < 86400) return Math.floor(secondsAgo / 3600) + "h ago";
  return Math.floor(secondsAgo / 86400) + "d ago";
};
const formatDuration = (milliseconds: number) => {
  const minutes = Math.max(0, Math.floor(milliseconds / 60000));
  return minutes < 60 ? minutes + "m" : Math.floor(minutes / 60) + "h" + (minutes % 60) + "m";
};
function UserDetail({
  id,
  onChanged,
  close,
}: {
  id: string;
  onChanged: () => void;
  close: SheetClose;
}) {
  const { t } = useTranslation();
  const [confirmDisable, setConfirmDisable] = useState(false);
  const queryClient = useQueryClient();
  const userQuery = useQuery({
    queryKey: ["admin", "user", id],
    queryFn: () => apiParsed("/api/admin/user?id=" + encodeURIComponent(id), adminUserResponse),
  });
  const details = userQuery.data;
  const disableMutation = useMutation({
    mutationFn: (payload: { uid: string; disabled: boolean }) =>
      api("/api/admin/user/disable", {
        method: "POST",
        body: JSON.stringify({ id: payload.uid, disabled: payload.disabled }),
      }),
    onSuccess: (_response, payload) => {
      toast(payload.disabled ? "User disabled" : "User enabled");
      void queryClient.invalidateQueries({ queryKey: ["admin", "users"] });
      onChanged();
      void close();
    },
    onError: (e) => toast(e.message),
  });
  if (userQuery.isError)
    return (
      <div className="text-sm leading-snug text-foreground/60">
        {userQuery.error.message || "Failed to load user details."}
      </div>
    );
  if (!details) return <div className="text-sm leading-snug text-foreground/60">Loading…</div>;
  const userRecord = details.user;
  const setDisabled = (disabled: boolean) => {
    if (!disableMutation.isPending) disableMutation.mutate({ uid: userRecord.id, disabled });
  };
  return (
    <>
      <h3 className="capitalize">{userRecord.name}</h3>
      <div className="my-2 mb-3 flex flex-wrap items-center gap-1.5">
        {userRecord.admin && (
          <span className="inline-flex items-center gap-1 rounded-sm bg-primary/15 px-2 py-0.5 text-xs font-medium text-primary">
            admin
          </span>
        )}
        {userRecord.disabled && (
          <span className="inline-flex items-center gap-1 rounded-sm bg-muted px-2 py-0.5 text-xs font-medium text-destructive">
            disabled
          </span>
        )}
        {userRecord.invitedBy && (
          <span className="inline-flex items-center gap-1 rounded-sm bg-muted px-2 py-0.5 text-xs font-medium text-foreground/60">
            invite {userRecord.invitedBy}
          </span>
        )}
        <span className="inline-flex items-center gap-1 rounded-sm bg-muted px-2 py-0.5 text-xs font-medium text-foreground/60">
          joined {userRecord.created ? fmtDate(t, userRecord.created.slice(0, 10)) : "—"}
        </span>
      </div>
      <Grid columns={2}>
        <MetricCard>
          <div className="flex items-center gap-1.5 text-sm text-foreground/60">Workouts</div>
          <div className="mt-1 text-lg leading-tight font-semibold tracking-tight">
            {details.workouts.length}
          </div>
        </MetricCard>
        <MetricCard>
          <div className="flex items-center gap-1.5 text-sm text-foreground/60">Weigh-ins</div>
          <div className="mt-1 text-lg leading-tight font-semibold tracking-tight">
            {details.bodyweight.length}
          </div>
        </MetricCard>
        <MetricCard>
          <div className="flex items-center gap-1.5 text-sm text-foreground/60">Routines</div>
          <div className="mt-1 text-lg leading-tight font-semibold tracking-tight">
            {details.routines.length}
          </div>
        </MetricCard>
        <MetricCard>
          <div className="flex items-center gap-1.5 text-sm text-foreground/60">Last sync</div>
          <div className="mt-1 text-base leading-tight font-semibold tracking-tight">
            {formatRelativeTime(details.lastSync)}
          </div>
        </MetricCard>
      </Grid>
      {!userRecord.admin && (
        <Button
          variant={userRecord.disabled ? "default" : "destructive"}
          className="mt-3 mb-1 w-full"
          onClick={() => (userRecord.disabled ? setDisabled(false) : setConfirmDisable(true))}
        >
          {userRecord.disabled ? "Enable account" : "Disable account"}
        </Button>
      )}
      <AlertDialog open={confirmDisable} onOpenChange={setConfirmDisable}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Disable {userRecord.name}?</AlertDialogTitle>
            <AlertDialogDescription>
              They are signed out everywhere and can no longer sync or log in until re-enabled.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction variant="destructive" onClick={() => setDisabled(true)}>
              Disable
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      <h4 className="mt-5.5 mb-2 px-1 text-sm font-normal tracking-tight text-foreground/60">
        Workout history
      </h4>
      {details.workouts.length > 0 ? (
        <div className="flex flex-col gap-0">
          {details.workouts.slice(0, 60).map((workoutRecord) => (
            <div
              key={workoutRecord.id}
              className="flex items-center justify-between gap-3 border-b border-border/60 px-0.5 py-2.5"
            >
              <div>
                <div className="text-sm leading-snug font-semibold">{workoutRecord.name}</div>
                <div className="text-xs text-muted-foreground">
                  {fmtDate(t, workoutRecord.d, true)} ·{" "}
                  {fmtDur((workoutRecord.end || workoutRecord.start) - workoutRecord.start)} ·{" "}
                  {setsDone(workoutRecord)} sets
                  {workoutRecord.prs?.length ? " · " + workoutRecord.prs.length + " PR" : ""}
                </div>
              </div>
              <span className="text-sm leading-snug text-foreground/60">
                {fmtVol(workoutRecord.vol ?? workoutVolume(workoutRecord), details.unit)}
              </span>
            </div>
          ))}
        </div>
      ) : (
        <div className="px-5 py-11 text-center text-sm leading-normal text-foreground/60">
          No workouts logged.
        </div>
      )}
    </>
  );
}

function InvitesCard({ invites }: { invites: AdminInvite[] | undefined }) {
  const queryClient = useQueryClient();
  const generateInviteMutation = useMutation({
    mutationFn: () =>
      apiParsed("/api/admin/invites/new", adminInviteResponse, {
        method: "POST",
        body: "{}",
      }),
    onSuccess: ({ invite }) => {
      navigator.clipboard?.writeText(invite.code).catch(() => {});
      toast("Code " + invite.code + " created & copied");
      void queryClient.invalidateQueries({ queryKey: ["admin", "invites"] });
    },
    onError: (e) => toast(e.message),
  });
  const revokeInviteMutation = useMutation({
    mutationFn: (code: string) =>
      api("/api/admin/invites/revoke", {
        method: "POST",
        body: JSON.stringify({ code }),
      }),
    onSuccess: () => {
      toast("Code revoked");
      void queryClient.invalidateQueries({ queryKey: ["admin", "invites"] });
    },
    onError: (e) => toast(e.message),
  });
  const inviteList = invites || [];
  const unusedInvites = inviteList.filter((invite) => !invite.usedBy);
  const redeemedInvites = inviteList.filter((invite) => invite.usedBy);
  return (
    <div className="mb-3 rounded-lg bg-card p-4">
      <div className="flex items-center justify-between gap-3">
        <h2 className="m-0 text-sm font-normal tracking-tight text-foreground/60">Invite codes</h2>
        <Button
          variant="default"
          size="sm"
          onClick={() => {
            if (!generateInviteMutation.isPending) generateInviteMutation.mutate();
          }}
        >
          <Icon name="plus" />
          Generate
        </Button>
      </div>
      <div className="my-1.5 mb-2.5 text-sm leading-snug text-foreground/60">
        {unusedInvites.length} unused · {redeemedInvites.length} redeemed
      </div>
      {unusedInvites.map((invite) => (
        <div
          key={invite.code}
          className="flex items-center justify-between gap-3 border-b border-border/60 px-0.5 py-2"
        >
          <button
            type="button"
            className="h-min font-mono font-medium tracking-wider"
            onClick={() => {
              navigator.clipboard?.writeText(invite.code).catch(() => {});
              toast("Copied " + invite.code);
            }}
          >
            {invite.code}
          </button>
          <button
            className="flex h-7.5 w-8 flex-none items-center justify-center rounded-lg text-base text-destructive transition duration-140 active:scale-95 active:bg-muted"
            onClick={() => revokeInviteMutation.mutate(invite.code)}
            aria-label="revoke"
          >
            <Icon name="trash" />
          </button>
        </div>
      ))}
      {redeemedInvites.map((invite) => (
        <div
          key={invite.code}
          className="flex items-center justify-between gap-3 px-0.5 py-2 text-sm text-muted-foreground"
        >
          <span className="font-mono">{invite.code}</span>
          <span>→ {invite.usedByName || "used"}</span>
        </div>
      ))}
    </div>
  );
}
function AdminContent() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const user = useStore((state) => state.user);
  const queryClient = useQueryClient();
  const [detailUserId, setDetailUserId] = useState<string | null>(null);
  const isAdmin = !!user?.admin;

  // Poll every 15s so the "training now" section stays live without a manual refresh;
  // the interval rides the users query instead of a hand-rolled setInterval.
  const usersQuery = useQuery({
    queryKey: ["admin", "users"],
    queryFn: () => apiParsed("/api/admin/users", adminUsersResponse),
    enabled: isAdmin,
    refetchInterval: 15000,
  });
  const invitesQuery = useQuery({
    queryKey: ["admin", "invites"],
    queryFn: () => apiParsed("/api/admin/invites", adminInvitesResponse),
    enabled: isAdmin,
  });
  const [currentTime] = useState(() => Date.now());

  if (!isAdmin) return null;
  const users = usersQuery.data;
  const invites = invitesQuery.data?.invites;

  const openUser = (id: string) => setDetailUserId(id);
  const userList = users?.users || [];
  const liveUsers = userList.filter((userRecord): userRecord is LiveUser => !!userRecord.live);
  const activeCount = userList.filter(
    (userRecord) => userRecord.lastSync && currentTime - userRecord.lastSync < 7 * 86400000,
  ).length;
  const disabledCount = userList.filter((userRecord) => userRecord.disabled).length;

  return (
    <div className="mx-auto w-full max-w-160">
      <div className="mt-2 mb-4.5 flex items-end justify-between gap-3">
        <button
          className="flex size-9 flex-none items-center justify-center rounded-full bg-card text-lg text-foreground transition duration-140 active:scale-95 active:bg-muted"
          onClick={() => void navigate({ to: "/settings" })}
          aria-label="Back"
        >
          <Icon name="chevronLeft" />
        </button>
        <div className="ml-2 min-w-0 flex-1">
          <h1 className="m-0 text-4xl leading-none font-bold tracking-tight">Admin</h1>
          <div className="mt-1 text-base tracking-tight text-foreground/60">
            {users ? userList.length + " users · " + activeCount + " active this week" : "Loading…"}
          </div>
        </div>
        <button
          className="flex size-9 flex-none items-center justify-center rounded-full bg-card text-lg text-foreground transition duration-140 active:scale-95 active:bg-muted"
          onClick={() => {
            void usersQuery.refetch();
            void invitesQuery.refetch();
          }}
          aria-label="refresh"
        >
          ↻
        </button>
      </div>

      {(usersQuery.isError || invitesQuery.isError) && (
        <div className="mb-3 rounded-lg bg-muted px-3.5 py-3 text-sm leading-snug text-destructive">
          {usersQuery.isError
            ? usersQuery.error.message || "Failed to load users."
            : invitesQuery.error?.message || "Failed to load invite codes."}
        </div>
      )}

      <Grid columns={{ default: 2, lg: 4 }} className="mb-3">
        <MetricCard>
          <div className="flex items-center gap-1.5 text-sm text-foreground/60">Users</div>
          <div className="mt-1 text-3xl leading-tight font-semibold tracking-tight">
            {users ? userList.length : "—"}
          </div>
        </MetricCard>
        <MetricCard>
          <div className="flex items-center gap-1.5 text-sm text-foreground/60">Training now</div>
          <div
            className={`mt-1 text-3xl leading-tight font-semibold tracking-tight ${liveUsers.length > 0 ? "text-primary" : ""}`}
          >
            {users ? liveUsers.length : "—"}
          </div>
        </MetricCard>
        <MetricCard>
          <div className="flex items-center gap-1.5 text-sm text-foreground/60">Active 7d</div>
          <div className="mt-1 text-3xl leading-tight font-semibold tracking-tight">
            {users ? activeCount : "—"}
          </div>
        </MetricCard>
        <MetricCard>
          <div className="flex items-center gap-1.5 text-sm text-foreground/60">Disabled</div>
          <div className="mt-1 text-3xl leading-tight font-semibold tracking-tight">
            {users ? disabledCount : "—"}
          </div>
        </MetricCard>
      </Grid>

      {liveUsers.length > 0 && (
        <div className="mb-3 rounded-lg border border-primary bg-card p-4">
          <h2 className="mb-2 flex items-center gap-1.5 text-sm font-normal tracking-tight text-foreground/60">
            <Icon name="dot" className="text-xs text-green-500" />
            Training now
          </h2>
          {liveUsers.map((userRecord) => (
            <button
              type="button"
              key={userRecord.id}
              className="flex w-full items-center justify-between gap-3 border-b border-border/60 px-0.5 py-2 text-left"
              onClick={() => openUser(userRecord.id)}
            >
              <div>
                <div className="text-sm leading-snug font-semibold">{userRecord.name}</div>
                <div className="text-xs text-muted-foreground">
                  {userRecord.live.name} · ex {userRecord.live.exIdx}/{userRecord.live.exTotal} ·{" "}
                  {userRecord.live.setsDone}/{userRecord.live.setsTotal} sets
                </div>
              </div>
              <span className="inline-flex items-center gap-1 rounded-sm bg-primary/15 px-2 py-0.5 text-xs font-medium text-primary">
                {formatDuration(currentTime - userRecord.live.startedAt)}
              </span>
            </button>
          ))}
        </div>
      )}

      <InvitesCard invites={invites} />

      <h4 className="mt-5.5 mb-2 px-1 text-sm font-normal tracking-tight text-foreground/60">
        Users
      </h4>
      <Grid columns={{ default: 1, lg: 2 }} gap="xs">
        {userList.map((userRecord) => (
          <button
            type="button"
            key={userRecord.id}
            className={`flex min-h-15 w-full items-center gap-3 rounded-lg bg-card px-3 py-2.5 text-left transition-colors duration-140 active:bg-muted ${userRecord.disabled ? "opacity-50" : ""}`}
            onClick={() => openUser(userRecord.id)}
          >
            <div className="min-w-0 flex-1">
              <div className="text-base leading-tight tracking-tight">
                {userRecord.live && (
                  <Icon name="dot" className="mr-1.5 inline-block text-xs text-green-500" />
                )}
                {userRecord.name}{" "}
                {userRecord.admin && (
                  <span className="ml-1 inline-flex items-center gap-1 rounded-sm bg-primary/15 px-2 py-0.5 text-xs font-medium text-primary">
                    admin
                  </span>
                )}
                {userRecord.disabled && (
                  <span className="ml-1 inline-flex items-center gap-1 rounded-sm bg-muted px-2 py-0.5 text-xs font-medium text-destructive">
                    off
                  </span>
                )}
              </div>
              <div className="mt-0.5 text-sm text-foreground/60">
                {userRecord.live
                  ? "training now · " + userRecord.live.name
                  : userRecord.workouts +
                    " workouts" +
                    (userRecord.lastWorkout
                      ? " · last " + fmtDate(t, userRecord.lastWorkout)
                      : "") +
                    " · synced " +
                    formatRelativeTime(userRecord.lastSync)}
              </div>
            </div>
            {userRecord.hasPush && (
              <span title="push enabled">
                <Icon name="bell" className="text-base text-muted-foreground" />
              </span>
            )}
            <Icon name="chevronRight" className="flex-none text-base text-foreground" />
          </button>
        ))}
        {users && userList.length === 0 && (
          <div className="px-5 py-11 text-center text-base leading-normal text-foreground/60">
            No users yet.
          </div>
        )}
      </Grid>
      <Sheet
        open={detailUserId !== null}
        onOpenChange={(open) => {
          if (!open) setDetailUserId(null);
        }}
      >
        <SheetContent
          side="bottom"
          className="max-h-screen touch-pan-y overflow-y-auto overscroll-contain rounded-2xl bg-sheet p-2 px-4.5 pb-5 lg:inset-x-auto lg:left-1/2 lg:w-160 lg:-translate-x-1/2"
          showCloseButton={false}
        >
          <SheetTitle className="sr-only">User details</SheetTitle>
          <div className="mx-auto mt-1.5 mb-3.5 h-1 w-9 rounded-full bg-foreground/20" />
          {detailUserId && (
            <UserDetail
              id={detailUserId}
              onChanged={() =>
                void queryClient.invalidateQueries({
                  queryKey: ["admin", "users"],
                })
              }
              close={() => {
                setDetailUserId(null);
                return Promise.resolve();
              }}
            />
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}

export default function Admin() {
  return <AdminContent />;
}
