import { useTranslation } from "react-i18next";
import { useStore } from "@/app/store/useStore";
import { fmtDate } from "@/shared/lib/format";
import { effortOf } from "@/domain/training/history";
import { toast } from "@/shared/lib/toast";
import { mergeImport } from "@/features/settings/import-csv";
import type { ParseResult } from "@/features/settings/import-csv";
import type { SheetClose } from "@/shared/lib/types";
import { Button } from "@/shared/ui/button";
import { Grid } from "@/shared/components/Grid";
import { MetricCard } from "@/shared/components/MetricCard";
import { SpaceBetween } from "@/shared/components/SpaceBetween";
import { updateAppState } from "@/features/exercises/sheet-shared";

type ParsedOk = Exclude<ParseResult, { error: string }>;

export function ImportSummary({ parsed, close }: { parsed: ParsedOk; close: SheetClose }) {
  const { t } = useTranslation();
  const st = useStore((store) => store.appState);
  const isBW = parsed.kind === "bodyweight";
  const mixedUnits = parsed.kind === "workouts" && parsed.mixedUnits;
  const have = isBW
    ? parsed.bodyweight.filter((b) => st.bodyweight.some((x) => x.d === b.d)).length
    : parsed.workouts.filter((w) => st.workouts.some((x) => x.d === w.d)).length;
  const fresh = (isBW ? parsed.bodyweight.length : parsed.workouts.length) - have;
  const doImport = () => {
    let added = 0;
    updateAppState((appState) => {
      added = mergeImport(appState, parsed).added;
    });
    void close();
    toast(
      isBW
        ? t("import.weighInsImported", "{{count}} weigh-ins imported", { count: added })
        : t("import.workoutsImported", "{{count}} workouts imported", { count: added }),
    );
  };
  return (
    <>
      <h3>
        {parsed.source
          ? t("import.importFrom", "Import from {{source}}", { source: parsed.source })
          : t("import.importHistory", "Import history")}
      </h3>
      <div className="mb-3 text-sm leading-snug text-foreground/60">
        {parsed.from && parsed.to
          ? parsed.from === parsed.to
            ? fmtDate(t, parsed.from, true)
            : fmtDate(t, parsed.from, true) + " – " + fmtDate(t, parsed.to, true)
          : ""}
      </div>
      <Grid columns={2} className="mb-3">
        {isBW ? (
          <>
            <MetricCard>
              <div className="flex items-center gap-1.5 text-sm text-foreground/60">
                {t("import.weighIns", "Weigh-ins")}
              </div>
              <div className="mt-1.5 text-lg leading-tight font-semibold tracking-tight">
                {parsed.bodyweight.length}
              </div>
            </MetricCard>
            <MetricCard>
              <div className="flex items-center gap-1.5 text-sm text-foreground/60">
                {t("common.new", "New")}
              </div>
              <div className="mt-1.5 text-lg leading-tight font-semibold tracking-tight">
                {fresh}
              </div>
            </MetricCard>
          </>
        ) : (
          <>
            <MetricCard>
              <div className="flex items-center gap-1.5 text-sm text-foreground/60">
                {t("stats.workouts", "Workouts")}
              </div>
              <div className="mt-1.5 text-lg leading-tight font-semibold tracking-tight">
                {parsed.workouts.length}
              </div>
            </MetricCard>
            <MetricCard>
              <div className="flex items-center gap-1.5 text-sm text-foreground/60">
                {t("exercise.sets", "Sets")}
              </div>
              <div className="mt-1.5 text-lg leading-tight font-semibold tracking-tight">
                {parsed.sets}
              </div>
            </MetricCard>
            <MetricCard>
              <div className="flex items-center gap-1.5 text-sm text-foreground/60">
                {t("import.exercisesMatched", "Exercises matched")}
              </div>
              <div className="mt-1.5 text-lg leading-tight font-semibold tracking-tight">
                {parsed.matched}
              </div>
            </MetricCard>
            <MetricCard>
              <div className="flex items-center gap-1.5 text-sm text-foreground/60">
                {t("import.addedOwn", "Added as your own")}
              </div>
              <div className="mt-1.5 text-lg leading-tight font-semibold tracking-tight">
                {parsed.created}
              </div>
            </MetricCard>
          </>
        )}
      </Grid>
      {mixedUnits ? (
        <div className="mb-2.5 text-sm leading-snug text-warning">
          {t(
            "import.fileMixesKgLbEach",
            "The file mixes kg and lb — each set is converted to {{unit}}.",
            {
              unit: st.unit,
            },
          )}
        </div>
      ) : parsed.converted ? (
        <div className="mb-2.5 text-sm leading-snug text-warning">
          {t(
            "import.fileInProfileInWeightsConverted",
            "The file is in {{fileUnit}} and your profile is in {{profileUnit}} — weights will be converted.",
            {
              fileUnit: parsed.fileUnit,
              profileUnit: st.unit,
            },
          )}
        </div>
      ) : null}
      {!isBW && !parsed.fileUnit && !mixedUnits && (
        <div className="mb-2.5 text-sm leading-snug text-muted-foreground">
          {t(
            "import.fileNotSayWhichUnit",
            "The file does not say which unit it uses — numbers are imported as they are.",
          )}
        </div>
      )}
      {have > 0 && (
        <div className="mb-2.5 text-sm leading-snug text-muted-foreground">
          {t(
            "import.daysAlreadyHaveDataHere",
            "{{count}} days already have data here and will be left alone.",
            {
              count: have,
            },
          )}
        </div>
      )}
      {!isBW && parsed.rirSets + parsed.rpeSets > 0 && (
        <div className="mb-2.5 text-sm leading-snug text-muted-foreground">
          {effortOf(st) === "none"
            ? t(
                "effort.setsBringThemSwitchEffort",
                "{{count}} sets bring an {{scale}} with them — switch on Effort per set in Settings to see it.",
                {
                  count: parsed.rirSets || parsed.rpeSets,
                  scale: parsed.rirSets ? "RIR" : "RPE",
                },
              )
            : t("effort.setsBringThem", "{{count}} sets bring an {{scale}} with them.", {
                count: parsed.rirSets || parsed.rpeSets,
                scale: parsed.rirSets ? "RIR" : "RPE",
              })}
        </div>
      )}
      {!isBW && parsed.unmatchedNames.length > 0 && (
        <>
          <h4 className="my-5.5 mb-2 px-1 text-sm font-normal tracking-tight text-foreground/60">
            {t(
              "import.notLibraryAddedOwnExercises",
              "Not in the library — added as your own exercises",
            )}
          </h4>
          <div className="mt-1 mb-3 flex flex-wrap gap-1.5">
            {parsed.unmatchedNames.slice(0, 12).map((n) => (
              <span
                key={n}
                className="rounded-full bg-muted px-2.5 py-1 text-xs text-foreground/60 capitalize"
              >
                {n}
              </span>
            ))}
            {parsed.unmatchedNames.length > 12 && (
              <span className="rounded-full bg-muted px-2.5 py-1 text-xs text-foreground/60">
                +{parsed.unmatchedNames.length - 12}
              </span>
            )}
          </div>
        </>
      )}
      <SpaceBetween size="xs">
        <Button className="w-full" variant="default" onClick={doImport} disabled={!fresh}>
          {fresh
            ? t("common.import", "Import")
            : t("import.nothingNewImport", "Nothing new to import")}
        </Button>
        <Button variant="ghost" className="w-full text-muted-foreground" onClick={close}>
          {t("common.cancel", "Cancel")}
        </Button>
      </SpaceBetween>
    </>
  );
}
