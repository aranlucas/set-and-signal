import { translate } from "../lib/translate";
import { toast } from "../lib/toast";
import { parseImport } from "../lib/import-csv";
import type { ParseResult } from "../lib/import-csv";
import { getAppState } from "./shared";

export type ParsedImport = Exclude<ParseResult, { error: string }>;

export function importFromApp(file: File, onParsed: (parsed: ParsedImport) => void): void {
  void file
    .text()
    .then((contents) => {
      let parsed: ParseResult;
      try {
        parsed = parseImport(contents, { unit: getAppState().unit });
      } catch {
        toast(translate("import.couldNotReadFile", "Could not read that file"));
        return;
      }
      if ("error" in parsed) {
        if (parsed.error === "empty") {
          toast(translate("import.fileEmpty", "That file is empty"));
          return;
        }
        toast(
          translate(
            "import.fileSColumnsArenT",
            "That file's columns aren't recognised — see the docs for supported apps.",
          ),
        );
        return;
      }
      if (
        parsed.kind === "bodyweight" ? parsed.bodyweight.length === 0 : parsed.workouts.length === 0
      ) {
        toast(translate("import.nothingImportFile", "Nothing to import from that file"));
        return;
      }
      onParsed(parsed);
    })
    .catch(() => toast(translate("import.couldNotReadFile", "Could not read that file")));
}
