import { useEffect, useState } from "react";
import { Check, CloudOff, RefreshCw, ArrowUpRight, Smartphone } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useStore } from "@/app/store/useStore";
import type { SyncConflict } from "@/app/store/training-sync";
import { Button } from "@/shared/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/shared/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/shared/ui/table";
import { conflictTitle, conflictRows } from "@/app/store/sync-review";

export default function SyncStatus() {
  const { t } = useTranslation();
  const user = useStore((state) => state.user);
  const status = useStore((state) => state.syncStatus);
  const pull = useStore((state) => state.pullState);
  const [online, setOnline] = useState(typeof navigator === "undefined" || navigator.onLine);
  const [open, setOpen] = useState(false);
  const [conflicts, setConflicts] = useState<SyncConflict[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => {
    const connected = () => {
      setOnline(true);
      void pull().catch(() => {});
    };
    const disconnected = () => setOnline(false);
    window.addEventListener("online", connected);
    window.addEventListener("offline", disconnected);
    return () => {
      window.removeEventListener("online", connected);
      window.removeEventListener("offline", disconnected);
    };
  }, [pull]);
  const phase = online ? status.phase : "offline";
  const retry = async () => {
    setBusy(true);
    setError("");
    try {
      await pull();
    } catch {
      setError(
        t("sync.retryError", "Still unable to connect. Your edits are kept on this device."),
      );
    } finally {
      setBusy(false);
    }
  };
  const review = async () => {
    setOpen(true);
    setBusy(true);
    setError("");
    setConflicts([]);
    try {
      setConflicts(await useStore.getState().reviewChanges());
    } catch {
      setError(
        t("sync.reviewError", "Connect to review the other version. Your edits are safe here."),
      );
    } finally {
      setBusy(false);
    }
  };
  const resolve = async (choice: "local" | "remote") => {
    setBusy(true);
    setError("");
    try {
      await useStore.getState().resolveChanges(conflicts, choice);
      setOpen(false);
    } catch {
      setError(
        t(
          "sync.resolveError",
          "Another change arrived, or the connection was lost. Close and review again; both versions are preserved.",
        ),
      );
    } finally {
      setBusy(false);
    }
  };
  const label = !user
    ? t("sync.deviceOnly", "Saved on this device")
    : phase === "offline"
      ? t("sync.offline", "Offline · changes saved on this device")
      : phase === "conflict"
        ? t("sync.conflict", "Changes to review")
        : phase === "error"
          ? t("sync.error", "Changes haven’t synced")
          : phase === "loading"
            ? t("sync.loading", "Connecting…")
            : phase === "saving"
              ? t("sync.saving", "Saving…")
              : t("sync.saved", "Saved");
  return (
    <>
      <div className="record-status">
        <span className="min-w-0 truncate" title={user?.name}>
          {user ? user.name : t("sync.localProfile", "Local training log")}
        </span>
        <output className="flex min-w-0 items-center gap-1.5 text-right">
          {!user ? (
            <Smartphone size={14} />
          ) : phase === "saved" ? (
            <Check size={14} className="text-system-blue" />
          ) : phase === "offline" ? (
            <CloudOff size={14} />
          ) : (
            <RefreshCw size={14} />
          )}
          {label}
        </output>
      </div>
      {user && (phase === "conflict" || phase === "error" || phase === "offline") && (
        <div className="mb-5 border-b border-border pb-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="max-w-prose text-sm leading-relaxed text-muted-foreground">
              {phase === "conflict"
                ? t(
                    "sync.explanation",
                    "An item changed on another device. Keep training; your edits are preserved until you review them.",
                  )
                : t(
                    "sync.pendingExplanation",
                    "Keep training here. Reconnect to save changes to your account.",
                  )}
            </p>
            <Button
              variant="ghost"
              size="sm"
              disabled={busy}
              onClick={() => void (phase === "conflict" ? review() : retry())}
            >
              {phase === "conflict"
                ? t("sync.review", "Review changes")
                : busy
                  ? t("sync.retrying", "Connecting…")
                  : t("sync.retry", "Try again")}
              <ArrowUpRight size={16} />
            </Button>
          </div>
          {error && !open && (
            <p role="alert" className="mt-2 text-sm text-destructive">
              {error}
            </p>
          )}
        </div>
      )}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-dvh overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle className="pr-8 font-heading text-2xl">
              {t("sync.reviewTitle", "Two versions. Your choice.")}
            </DialogTitle>
            <DialogDescription>
              {t(
                "sync.reviewDescription",
                "Compare what changed below. Unrelated edits will still save. We keep a recovery copy whichever version you choose.",
              )}
            </DialogDescription>
          </DialogHeader>
          {busy && <output>{t("sync.working", "Checking your changes…")}</output>}
          {error && (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          )}
          {conflicts.map((conflict) => (
            <section key={conflict.key}>
              <h3 className="mb-3 text-xl">{conflictTitle(conflict)}</h3>
              <div className="overflow-x-auto">
                <Table className="table-fixed text-left">
                  <TableHeader>
                    <TableRow className="border-b border-foreground">
                      <TableHead className="w-1/3 p-2 whitespace-normal">
                        {t("sync.detail", "Detail")}
                      </TableHead>
                      <TableHead className="p-2 whitespace-normal">
                        {t("sync.thisDevice", "This device")}
                      </TableHead>
                      <TableHead className="p-2 whitespace-normal">
                        {t("sync.otherVersion", "Other version")}
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {conflictRows(conflict).map((row) => (
                      <TableRow key={row.label} className="border-b border-border">
                        <TableHead className="p-2 align-top font-normal wrap-anywhere whitespace-normal text-muted-foreground">
                          {row.label}
                        </TableHead>
                        <TableCell className="p-2 align-top wrap-anywhere whitespace-normal">
                          {row.local}
                        </TableCell>
                        <TableCell className="p-2 align-top wrap-anywhere whitespace-normal">
                          {row.remote}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </section>
          ))}
          {!busy && !error && conflicts.length === 0 && (
            <div>
              <p>
                {t(
                  "sync.noConflict",
                  "No competing edits remain. Close this review and try saving again.",
                )}
              </p>
              <Button variant="outline" className="mt-3" onClick={() => void retry()}>
                {t("sync.retry", "Try again")}
              </Button>
            </div>
          )}
          <div className="flex flex-wrap gap-2 border-t border-border pt-4">
            <Button
              disabled={busy || !conflicts.length || !!error}
              onClick={() => void resolve("local")}
            >
              {t("sync.keepLocal", "Keep my version")}
            </Button>
            <Button
              variant="outline"
              disabled={busy || !conflicts.length || !!error}
              onClick={() => void resolve("remote")}
            >
              {t("sync.keepRemote", "Keep the other version")}
            </Button>
            <Button variant="ghost" onClick={() => useStore.getState().saveRecovery()}>
              {t("sync.download", "Download my edits")}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
