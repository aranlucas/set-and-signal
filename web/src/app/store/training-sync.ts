import { ConvexClient } from "convex/browser";
import { makeFunctionReference } from "convex/server";
import { api } from "@/shared/lib/api";
import { parseStoredState, type ParsedAppStatePatch } from "@/shared/lib/schemas";
import type { AppState } from "@/shared/lib/types";
import { joinState, splitState } from "../../../convex/model";

export type SyncPhase = "loading" | "saving" | "saved" | "offline" | "error" | "conflict";
export type SyncStatus = { phase: SyncPhase; pending: number };
export type SyncConflict = { key: string; local: string | null; remote: string | null };
type Change = { key: string; expected: string | null; value: string | null };
const snapshot = makeFunctionReference<"query", Record<string, never>, unknown>(
  "training:snapshot",
);
const commit = makeFunctionReference<"mutation", { changes: Change[] }, null>("training:commit");
export function changesBetween(before: Partial<AppState>, after: Partial<AppState>): Change[] {
  const old = new Map(splitState(before).map((row) => [row.key, row.value]));
  const next = new Map(splitState(after).map((row) => [row.key, row.value]));
  return [...new Set([...old.keys(), ...next.keys()])].flatMap((key) => {
    const expected = old.get(key) ?? null;
    const value = next.get(key) ?? null;
    return expected === value ? [] : [{ key, expected, value }];
  });
}
async function credentials(uid: string) {
  const result = await api("/api/convex/token");
  if (
    !result ||
    typeof result !== "object" ||
    !("token" in result) ||
    typeof result.token !== "string" ||
    !("url" in result) ||
    typeof result.url !== "string" ||
    !("userId" in result) ||
    result.userId !== uid
  )
    throw new Error("Your session changed. Sign in again.");
  return { token: result.token, url: result.url };
}
function readQueue(key: string): Change[][] {
  const parsed: unknown = JSON.parse(localStorage.getItem(key) ?? "[]");
  if (!Array.isArray(parsed)) throw new Error("Invalid pending training edits");
  return parsed.map((batch: unknown) => {
    if (!Array.isArray(batch)) throw new Error("Invalid pending training edits");
    return batch.map((entry: unknown) => {
      if (
        !entry ||
        typeof entry !== "object" ||
        !("key" in entry) ||
        typeof entry.key !== "string" ||
        !("expected" in entry) ||
        !(entry.expected === null || typeof entry.expected === "string") ||
        !("value" in entry) ||
        !(entry.value === null || typeof entry.value === "string")
      )
        throw new Error("Invalid pending training edit");
      return { key: entry.key, expected: entry.expected, value: entry.value };
    });
  });
}
export class TrainingSync {
  private client: ConvexClient | undefined;
  private stop: (() => void) | undefined;
  private stopConnection: (() => void) | undefined;
  private problem: "error" | "conflict" | undefined;
  private closed = false;
  private queue: Change[][];
  private known = new Map<string, string>();
  private flushing: Promise<void> | undefined;
  private readonly key: string;
  private readonly uid: string;
  private readonly receive: (state: ParsedAppStatePatch) => void;
  private readonly failed: (error: unknown) => void;
  private readonly status: (status: SyncStatus) => void;
  constructor(
    uid: string,
    receive: (state: ParsedAppStatePatch) => void,
    failed: (error: unknown) => void,
    status: (status: SyncStatus) => void = () => {},
  ) {
    this.uid = uid;
    this.receive = receive;
    this.status = status;
    this.failed = (error) => {
      if (this.closed) return;
      this.problem =
        error instanceof Error && error.message.includes("CONFLICT") ? "conflict" : "error";
      this.publish();
      failed(error);
    };
    this.key = `gym_pending_convex:${uid}`;
    const cached = parseStoredState(localStorage.getItem(`gym_cache:${uid}`));
    this.known = new Map(splitState(cached ?? {}).map((row) => [row.key, row.value]));
    this.queue = readQueue(this.key);
    for (const batch of this.queue)
      for (const change of batch) {
        if (change.value === null) this.known.delete(change.key);
        else this.known.set(change.key, change.value);
      }
  }
  private publish() {
    if (this.closed) return;
    const online = typeof navigator === "undefined" || navigator.onLine !== false;
    const phase = !online ? "offline" : (this.problem ?? (this.queue.length ? "saving" : "saved"));
    this.status({ phase, pending: this.queue.length });
  }
  private showPending() {
    const state = parseStoredState(
      JSON.stringify(
        joinState(
          [...this.known].map(([key, value]) => ({ key, value })),
          0,
        ),
      ),
    );
    if (state) this.receive(state);
  }
  async start() {
    if (this.queue.length) this.showPending();
    this.status({ phase: "loading", pending: this.queue.length });
    let initial;
    try {
      initial = await credentials(this.uid);
    } catch (error) {
      this.failed(error);
      throw error;
    }
    if (this.closed) return;
    const client = new ConvexClient(initial.url);
    this.client = client;
    this.stopConnection = client.subscribeToConnectionState((connection) => {
      if (this.closed || this.problem) return;
      if (!connection.isWebSocketConnected)
        this.status({ phase: "offline", pending: this.queue.length });
      else this.publish();
    });
    client.setAuth(async () => (this.closed ? null : (await credentials(this.uid)).token));
    this.stop = client.onUpdate(
      snapshot,
      {},
      (value) => {
        if (!this.closed && !this.queue.length) this.accept(value);
      },
      this.failed,
    );
    try {
      await this.flush();
      const value = await client.query(snapshot, {});
      if (!this.closed && !this.queue.length) this.accept(value);
    } catch (error) {
      this.failed(error);
      throw error;
    }
  }
  private accept(value: unknown) {
    if (value === null) {
      this.known.clear();
      this.receive({});
      this.problem = undefined;
      this.publish();
      return;
    }
    const state = parseStoredState(JSON.stringify(value));
    if (!state) throw new Error("Invalid training data from Convex");
    this.known = new Map(splitState(state).map((row) => [row.key, row.value]));
    this.receive(state);
    this.problem = undefined;
    this.publish();
  }
  enqueue(before: Partial<AppState>, after: Partial<AppState>) {
    const changes = changesBetween(before, after).map((change) => ({
      key: change.key,
      value: change.value,
      expected: this.known.get(change.key) ?? null,
    }));
    if (!changes.length) return;
    for (const change of changes) {
      if (change.value === null) this.known.delete(change.key);
      else this.known.set(change.key, change.value);
    }
    this.queue.push(changes);
    localStorage.setItem(this.key, JSON.stringify(this.queue));
    this.publish();
    if (this.client && !this.problem) void this.flush().catch(this.failed);
  }
  flush(): Promise<void> {
    if (this.flushing) return this.flushing;
    this.flushing = this.drain().then(
      () => {
        this.flushing = undefined;
        if (this.queue.length && this.client && !this.closed) return this.flush();
      },
      (error: unknown) => {
        this.flushing = undefined;
        throw error;
      },
    );
    return this.flushing;
  }
  private async drain() {
    const client = this.client;
    if (this.closed) return;
    if (!client) {
      if (this.queue.length)
        throw new Error("Connect to save your pending edits before signing out.");
      return;
    }
    while (this.queue.length && !this.closed) {
      const changes = this.queue[0];
      if (!changes) break;
      // Each batch assumes the preceding batch committed; parallel writes break revisions.
      // eslint-disable-next-line no-await-in-loop
      await client.mutation(commit, { changes });
      if (this.closed) return;
      this.queue.shift();
      localStorage.setItem(this.key, JSON.stringify(this.queue));
    }
    const value = await client.query(snapshot, {});
    if (!this.closed && !this.queue.length) this.accept(value);
  }
  saveRecovery() {
    const url = URL.createObjectURL(
      new Blob([JSON.stringify(this.queue, null, 2)], { type: "application/json" }),
    );
    const link = document.createElement("a");
    link.href = url;
    link.download = "set-and-signal-pending-edits.json";
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  async conflicts(): Promise<SyncConflict[]> {
    if (!this.client) throw new Error("Reconnect to review changes.");
    const value: unknown = await this.client.query(snapshot, {});
    const remote = new Map(
      splitState(parseStoredState(JSON.stringify(value)) ?? {}).map((row) => [row.key, row.value]),
    );
    return (this.queue[0] ?? [])
      .filter((change) => {
        const current = remote.get(change.key) ?? null;
        return current !== change.expected && current !== change.value;
      })
      .map((change) => ({
        key: change.key,
        local: this.known.get(change.key) ?? null,
        remote: remote.get(change.key) ?? null,
      }));
  }
  async resolve(conflicts: SyncConflict[], choice: "local" | "remote") {
    // Retain both the original pending edits and the reviewed remote versions.
    localStorage.setItem(
      `${this.key}:recovery:${Date.now()}`,
      JSON.stringify({ queue: this.queue, conflicts }),
    );
    const reviewed = new Map(conflicts.map((conflict) => [conflict.key, conflict]));
    const seen = new Set<string>();
    this.queue = this.queue
      .map((batch) =>
        batch.flatMap((change) => {
          const conflict = reviewed.get(change.key);
          if (!conflict) return [change];
          if (choice === "remote") return [];
          if (seen.has(change.key)) return [change];
          seen.add(change.key);
          return [{ ...change, expected: conflict.remote }];
        }),
      )
      .filter((batch) => batch.length);
    localStorage.setItem(this.key, JSON.stringify(this.queue));
    this.problem = undefined;
    this.publish();
    try {
      await this.flush();
    } catch (error) {
      this.failed(error);
      throw error;
    }
  }
  async close() {
    this.closed = true;
    this.stop?.();
    this.stopConnection?.();
    await this.client?.close();
  }
}
