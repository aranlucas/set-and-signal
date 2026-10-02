import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "@tanstack/react-router";
import { useStore } from "@/app/store/useStore";
import { exOr } from "@/domain/exercises/exercises";
import { exLine, modeOf } from "@/domain/training/history";
import {
  adaptSession,
  canUndoSessionCopy,
  createSessionRoutine,
  estimateSessionMinutes,
  fitSession,
  SESSION_EQUIPMENT,
  validSessionConfig,
  validSessionConstraints,
} from "@/domain/training/session-planner";
import type { SessionChoice, SessionRow } from "@/domain/training/session-planner";
import { uid } from "@/shared/lib/format";
import { Header } from "@/shared/components/Header";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import { Label } from "@/shared/ui/label";
import { NativeSelect, NativeSelectOption } from "@/shared/ui/native-select";
import { loadSessionDraft, saveSessionDraft } from "./session-draft";
import type { SessionDraft } from "./session-draft";
import { useSessionPlannerLabels } from "./use-session-planner-labels";
import { SessionPlanSummary } from "./SessionPlanSummary";

export default function SessionPlannerPage() {
  const account = useStore((store) => store.user?.id ?? null);
  return <SessionPlanner key={account ?? "guest"} account={account} />;
}

function SessionPlanner({ account }: { account: string | null }) {
  const { t } = useTranslation();
  const labels = useSessionPlannerLabels();
  const nav = useNavigate();
  const state = useStore((store) => store.appState);
  const update = useStore((store) => store.update);
  const [draft, setDraft] = useState<SessionDraft | null>(
    () =>
      loadSessionDraft(account) ??
      (state.routines[0]
        ? {
            source: structuredClone(state.routines[0]),
            copyId: uid(),
            name: `${state.routines[0].name} · ${t("sessionPlan.copySuffix", "Travel")}`.slice(
              0,
              60,
            ),
            constraints: {
              equipment: [],
              budgetMin: 30,
              restSec: Math.min(600, Math.max(0, Math.round(state.restSec))),
            },
            choices: [],
          }
        : null),
  );
  const [message, setMessage] = useState("");
  const [draftError, setDraftError] = useState(false);
  const changeDraft = (next: SessionDraft) => {
    try {
      saveSessionDraft(account, next);
      setDraftError(false);
    } catch {
      setDraftError(true);
    }
    setDraft(next);
  };

  const selectSource = (id: string) => {
    const source = state.routines.find((routine) => routine.id === id);
    if (!source) return;
    changeDraft({
      source: structuredClone(source),
      copyId: uid(),
      name: `${source.name} · ${t("sessionPlan.copySuffix", "Travel")}`.slice(0, 60),
      constraints: draft?.constraints ?? { equipment: [], budgetMin: 30, restSec: state.restSec },
      choices: [],
    });
    setMessage("");
  };
  const rows = draft ? adaptSession(draft.source, draft.constraints, draft.choices) : [];
  const configs = rows.flatMap(({ planned }) => (planned ? [planned] : []));
  const estimate = estimateSessionMinutes(configs, draft?.constraints.restSec ?? 0);
  const duplicate = new Set(configs.map((config) => config.id)).size !== configs.length;
  const valid =
    !!draft && validSessionConstraints(draft.constraints) && configs.every(validSessionConfig);
  const saved = draft ? state.routines.find((routine) => routine.id === draft.copyId) : undefined;
  const undoable = draft?.savedCopy && canUndoSessionCopy(state, draft.savedCopy);
  const changeChoice = (index: number, change: Partial<SessionChoice>) => {
    if (!draft) return;
    const choices = [...draft.choices];
    // Fill missing positions: sparse arrays serialize to null and cannot resume.
    while (choices.length <= index) choices.push({});
    choices[index] = { ...choices[index], ...change };
    changeDraft({ ...draft, choices });
  };
  const save = () => {
    if (!draft || saved) return;
    try {
      const copy = createSessionRoutine(
        draft.source,
        draft.constraints,
        rows,
        draft.copyId,
        draft.name.trim(),
      );
      update((next) => {
        if (next.routines.some((routine) => routine.id === copy.id))
          throw new Error("Copy already saved");
        next.routines.push(copy);
      });
      changeDraft({ ...draft, savedCopy: copy });
      setMessage(
        t(
          "sessionPlan.saved",
          "Copy saved in Plan. Edit it or choose it from Start workout when you are ready.",
        ),
      );
    } catch {
      setMessage(
        t(
          "sessionPlan.saveFailed",
          "Could not save the copy. Your original routine and draft are preserved. Review the constraints or retry when storage is available.",
        ),
      );
    }
  };
  const undo = () => {
    if (!draft?.savedCopy) return;
    try {
      update((next) => {
        if (!draft.savedCopy || !canUndoSessionCopy(next, draft.savedCopy))
          throw new Error("Copy is in use");
        next.routines = next.routines.filter((routine) => routine.id !== draft.copyId);
      });
      changeDraft({ ...draft, savedCopy: undefined });
      setMessage(t("sessionPlan.undone", "Saved copy removed. Your planning draft is still here."));
    } catch {
      setMessage(
        t(
          "sessionPlan.undoFailed",
          "The copy was edited, scheduled or used, so it cannot be undone here. Logged history is preserved.",
        ),
      );
    }
  };
  return (
    <div className="mx-auto w-full max-w-180">
      <Header
        variant="h1"
        className="mt-2 mb-4"
        description={t(
          "sessionPlan.intro",
          "Adapt a routine to the equipment and time you have today. Review every change, then save a separate copy.",
        )}
      >
        {t("sessionPlan.title", "Equipment & time")}
      </Header>
      <Button variant="link" onClick={() => void nav({ to: "/plan" })}>
        {t("sessionPlan.back", "Back to Plan")}
      </Button>
      {state.routines.length === 0 && !draft ? (
        <p className="mt-4">
          {t("sessionPlan.noSource", "Add a routine or a curated plan first, then adapt it here.")}
        </p>
      ) : (
        <>
          <section
            className="my-4 space-y-4"
            aria-label={t("sessionPlan.constraints", "Session constraints")}
          >
            <div className="space-y-2">
              <Label htmlFor="session-source">{t("sessionPlan.source", "Source routine")}</Label>
              <NativeSelect
                id="session-source"
                className="w-full"
                value={draft?.source.id ?? ""}
                disabled={!!saved}
                onChange={(event) => selectSource(event.target.value)}
              >
                {draft && !state.routines.some((routine) => routine.id === draft.source.id) && (
                  <NativeSelectOption value={draft.source.id}>
                    {draft.source.name}
                  </NativeSelectOption>
                )}
                {state.routines
                  .filter((routine) => routine.id !== draft?.copyId)
                  .map((routine) => (
                    <NativeSelectOption key={routine.id} value={routine.id}>
                      {routine.name}
                    </NativeSelectOption>
                  ))}
              </NativeSelect>
              <p className="text-sm text-muted-foreground">
                {t(
                  "sessionPlan.draftHelp",
                  "Drafts resume on this device for this profile. The source snapshot stays as it was when selected.",
                )}
              </p>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="session-minutes">
                  {t("sessionPlan.minutes", "Time budget (min)")}
                </Label>
                <Input
                  id="session-minutes"
                  type="number"
                  min={5}
                  max={180}
                  value={draft?.constraints.budgetMin ?? 30}
                  disabled={!!saved}
                  onChange={(event) =>
                    draft &&
                    changeDraft({
                      ...draft,
                      constraints: { ...draft.constraints, budgetMin: Number(event.target.value) },
                    })
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="session-rest">
                  {t("sessionPlan.rest", "Rest between sets (sec)")}
                </Label>
                <Input
                  id="session-rest"
                  type="number"
                  min={0}
                  max={600}
                  value={draft?.constraints.restSec ?? 90}
                  disabled={!!saved}
                  onChange={(event) =>
                    draft &&
                    changeDraft({
                      ...draft,
                      constraints: { ...draft.constraints, restSec: Number(event.target.value) },
                    })
                  }
                />
              </div>
            </div>
            <div>
              <h2 className="mb-2 font-medium">
                {t("sessionPlan.available", "Available equipment")}
              </h2>
              <p className="mb-3 text-sm text-muted-foreground">
                {t(
                  "sessionPlan.equipmentHelp",
                  "No equipment is needed for floor movements. Select each machine you actually have; benches, racks and bars must be selected separately.",
                )}
              </p>
              <div className="flex flex-wrap gap-2">
                {SESSION_EQUIPMENT.map((equipment) => (
                  <Button
                    key={equipment}
                    variant="chip"
                    disabled={!!saved}
                    aria-pressed={draft?.constraints.equipment.includes(equipment) ?? false}
                    onClick={() =>
                      draft &&
                      changeDraft({
                        ...draft,
                        constraints: {
                          ...draft.constraints,
                          equipment: draft.constraints.equipment.includes(equipment)
                            ? draft.constraints.equipment.filter((item) => item !== equipment)
                            : [...draft.constraints.equipment, equipment],
                        },
                      })
                    }
                  >
                    {labels.equipment(equipment)}
                  </Button>
                ))}
              </div>
            </div>
          </section>
          <section className="space-y-3" aria-label={t("sessionPlan.review", "Review changes")}>
            <h2 className="text-lg font-semibold">{t("sessionPlan.review", "Review changes")}</h2>
            <p className="text-sm text-muted-foreground">
              {t(
                "sessionPlan.alternativesHelp",
                "Suggestions share a general movement pattern, not identical training effects. Swaps reset load and speed. Review targets; automatic progression and supersets are off for this copy.",
              )}
            </p>
            {rows.map((row, index) => (
              <SessionPlannerRow
                key={row.key}
                row={row}
                index={index}
                choice={draft?.choices[index]}
                unit={state.unit}
                disabled={!!saved}
                onChange={(change) => changeChoice(index, change)}
              />
            ))}
            {!rows.length && (
              <p>
                {t(
                  "sessionPlan.noExercises",
                  "This source has no exercises. Choose another routine.",
                )}
              </p>
            )}
          </section>
          <section className="my-5 space-y-3 rounded-lg bg-card p-4">
            <p className="font-semibold" aria-live="polite">
              {t("sessionPlan.estimate", "Approximately {{estimate}} / {{budget}} min", {
                estimate,
                budget: draft?.constraints.budgetMin ?? 30,
              })}
            </p>
            <p className="text-sm text-muted-foreground">
              {t(
                "sessionPlan.estimateHelp",
                "Assumes 5 min preparation, 1 min setup per exercise, 3 sec per rep, and your selected rest between sets. Actual duration varies. Extra work or rests will change it.",
              )}
            </p>
            {!valid && (
              <p className="text-sm text-destructive">
                {t(
                  "sessionPlan.invalid",
                  "Use a 5–180 min budget, 0–600 sec rest, 1–12 sets, and positive targets (up to 100 reps, 600 sec or 180 min).",
                )}
              </p>
            )}
            {duplicate && (
              <p className="text-sm text-destructive">
                {t(
                  "sessionPlan.duplicate",
                  "Two rows use the same exercise. Choose a different alternative or omit one before saving.",
                )}
              </p>
            )}
            {!configs.length && (
              <p className="text-sm text-muted-foreground">
                {t(
                  "sessionPlan.empty",
                  "No exercises fit the current equipment or choices. Add equipment, choose an alternative, or return to the source routine.",
                )}
              </p>
            )}
            {draft && !saved && (
              <div className="flex flex-wrap gap-2">
                <Button
                  size="sm"
                  disabled={!valid || duplicate || !configs.length}
                  onClick={() =>
                    changeDraft({ ...draft, choices: fitSession(rows, draft.constraints) })
                  }
                >
                  {t("sessionPlan.fit", "Fit to time budget")}
                </Button>
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => changeDraft({ ...draft, choices: [] })}
                >
                  {t("sessionPlan.reset", "Undo suggestions & edits")}
                </Button>
              </div>
            )}
            {!saved && estimate > (draft?.constraints.budgetMin ?? 30) && (
              <p className="text-sm text-destructive">
                {t(
                  "sessionPlan.overBudget",
                  "Over budget. Reduce work, omit an exercise, or increase the available time before saving.",
                )}
              </p>
            )}
            <div className="space-y-2">
              <Label htmlFor="session-name">{t("sessionPlan.copyName", "Copy name")}</Label>
              <Input
                id="session-name"
                maxLength={60}
                value={draft?.name ?? ""}
                disabled={!!saved}
                onChange={(event) => draft && changeDraft({ ...draft, name: event.target.value })}
              />
            </div>
            {saved ? (
              <div className="flex flex-wrap gap-2">
                <Button onClick={() => void nav({ to: "/plan/r/$id", params: { id: saved.id } })}>
                  {t("sessionPlan.editCopy", "Edit saved copy")}
                </Button>
                <Button variant="secondary" disabled={!undoable} onClick={undo}>
                  {t("sessionPlan.undoSave", "Undo save")}
                </Button>
                <Button variant="secondary" onClick={() => draft && selectSource(draft.source.id)}>
                  {t("sessionPlan.newDraft", "Plan another copy")}
                </Button>
              </div>
            ) : (
              <Button
                disabled={
                  !valid ||
                  duplicate ||
                  !configs.length ||
                  estimate > (draft?.constraints.budgetMin ?? 30) ||
                  !draft?.name.trim() ||
                  draft.name.trim().length > 60
                }
                onClick={save}
              >
                {t("sessionPlan.saveCopy", "Save separate copy")}
              </Button>
            )}
            {saved && !undoable && (
              <p className="text-sm text-muted-foreground">
                {t(
                  "sessionPlan.undoFailed",
                  "The copy was edited, scheduled or used, so it cannot be undone here. Logged history is preserved.",
                )}
              </p>
            )}
            {message && <output className="block text-sm">{message}</output>}
            {draftError && (
              <p role="alert" className="text-sm text-destructive">
                {t(
                  "sessionPlan.draftFailed",
                  "Device storage is unavailable. This planning draft cannot resume after closing the page.",
                )}
              </p>
            )}
          </section>
          {draft?.savedCopy?.sessionPlan && (
            <SessionPlanSummary plan={draft.savedCopy.sessionPlan} unit={state.unit} />
          )}
        </>
      )}
    </div>
  );
}

function SessionPlannerRow({
  row,
  index,
  choice,
  unit,
  disabled,
  onChange,
}: {
  row: SessionRow;
  index: number;
  choice?: SessionChoice;
  unit: "kg" | "lb";
  disabled: boolean;
  onChange: (choice: Partial<SessionChoice>) => void;
}) {
  const { t } = useTranslation();
  const labels = useSessionPlannerLabels();
  const mode = modeOf(row.original);
  const amount = row.planned
    ? mode === "cardio"
      ? (row.planned.min ?? 20)
      : mode === "time"
        ? (row.planned.sec ?? 45)
        : (row.planned.reps ?? 10)
    : 0;
  const reason =
    row.reason === "unknown"
      ? t(
          "sessionPlan.reason.unknown",
          "Equipment requirements and alternatives have not been reviewed for this exercise. It is omitted; you can keep using the original routine.",
        )
      : row.reason === "duplicate"
        ? t(
            "sessionPlan.reason.duplicate",
            "Available alternatives are already used in another row. Omitted to keep each exercise distinct; you can edit the choices.",
          )
        : row.reason === "stale"
          ? t(
              "sessionPlan.reason.stale",
              "Your selected exercise needs equipment that is unavailable. Choose another alternative or omit this row.",
            )
          : row.reason === "unavailable"
            ? t(
                "sessionPlan.reason.unavailable",
                "No reviewed alternative uses the selected equipment. Omitted from this copy.",
              )
            : row.reason === "rejected"
              ? t(
                  "sessionPlan.reason.rejected",
                  "Omitted by your choice or time adjustment. Select an alternative to include it again.",
                )
              : row.reason === "kept"
                ? t(
                    "sessionPlan.reason.kept",
                    "Original exercise kept: its required equipment is available.",
                  )
                : t(
                    "sessionPlan.reason.swap",
                    "Same general pattern: {{movement}}. Uses {{equipment}}. Original load and speed are not transferred.",
                    {
                      movement: labels.movements[row.options[0]?.movement ?? ""],
                      equipment:
                        row.options
                          .find((option) => option.id === row.planned?.id)
                          ?.needs.map(labels.equipment)
                          .join(", ") || t("sessionPlan.floor", "no equipment"),
                    },
                  );
  return (
    <article className="space-y-3 rounded-lg bg-card p-4">
      <div>
        <h3 className="font-medium">{exOr(row.original.id).n}</h3>
        <p className="text-sm text-muted-foreground">
          {t("sessionPlan.original", "Original: {{target}}", {
            target: exLine(row.original, unit),
          })}
        </p>
      </div>
      <p className="text-sm text-muted-foreground">{reason}</p>
      <div className="space-y-2">
        <Label htmlFor={`session-choice-${index}`}>
          {t("sessionPlan.useExercise", "Exercise for this copy")}
        </Label>
        <NativeSelect
          id={`session-choice-${index}`}
          className="w-full"
          disabled={disabled}
          value={choice?.id ?? "auto"}
          onChange={(event) =>
            onChange({ id: event.target.value === "auto" ? undefined : event.target.value })
          }
        >
          <NativeSelectOption value="auto">
            {t("sessionPlan.auto", "Suggested choice")}
            {row.planned ? `: ${exOr(row.planned.id).n}` : ""}
          </NativeSelectOption>
          <NativeSelectOption value="">
            {t("sessionPlan.omit", "Omit from copy")}
          </NativeSelectOption>
          {row.options.map((option) => (
            <NativeSelectOption key={option.id} value={option.id}>
              {exOr(option.id).n}
            </NativeSelectOption>
          ))}
        </NativeSelect>
      </div>
      {row.planned && (
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-2">
            <Label htmlFor={`session-sets-${index}`}>{t("sessionPlan.sets", "Sets")}</Label>
            <Input
              id={`session-sets-${index}`}
              type="number"
              min={1}
              max={12}
              disabled={disabled}
              value={row.planned.sets}
              onChange={(event) => onChange({ sets: Number(event.target.value) })}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor={`session-amount-${index}`}>
              {mode === "cardio"
                ? t("sessionPlan.durationMin", "Minutes per set")
                : mode === "time"
                  ? t("sessionPlan.durationSec", "Seconds per set")
                  : t("sessionPlan.reps", "Reps per set (total)")}
            </Label>
            <Input
              id={`session-amount-${index}`}
              type="number"
              min={1}
              max={mode === "cardio" ? 180 : mode === "time" ? 600 : 100}
              disabled={disabled}
              value={amount}
              onChange={(event) => onChange({ amount: Number(event.target.value) })}
            />
          </div>
        </div>
      )}
    </article>
  );
}
