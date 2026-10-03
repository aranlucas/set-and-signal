import * as v from "valibot";
import { routine } from "@/shared/lib/schemas";
import { SESSION_EQUIPMENT } from "@/domain/training/session-planner";

const number = v.pipe(
  v.number(),
  v.check((value: number) => Number.isFinite(value)),
);

const sessionDraft = v.object({
  source: routine,
  copyId: v.string(),
  name: v.string(),
  constraints: v.object({
    equipment: v.array(v.picklist(SESSION_EQUIPMENT)),
    budgetMin: number,
    restSec: number,
  }),
  choices: v.array(
    v.object({ id: v.optional(v.string()), sets: v.optional(number), amount: v.optional(number) }),
  ),
  savedCopy: v.optional(routine),
});

export type SessionDraft = v.InferOutput<typeof sessionDraft>;

const keyFor = (account: string | null) =>
  `gym_session_plan_v1:${account ? `account:${account}` : "guest"}`;

export function loadSessionDraft(account: string | null): SessionDraft | null {
  try {
    const raw = localStorage.getItem(keyFor(account));

    if (!raw) return null;
    const parsed = v.safeParse(sessionDraft, JSON.parse(raw));

    return parsed.success ? parsed.output : null;
  } catch {
    return null;
  }
}

export function saveSessionDraft(account: string | null, draft: SessionDraft) {
  localStorage.setItem(keyFor(account), JSON.stringify(draft));
}
