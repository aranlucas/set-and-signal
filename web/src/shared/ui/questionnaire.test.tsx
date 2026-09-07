import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { QuestionnaireChoice } from "@/shared/ui/questionnaire";
import { Questionnaire } from "@shadcn/react/questionnaire";

function renderCheckedChoice(multiple: boolean) {
  return renderToStaticMarkup(
    <Questionnaire.Root
      defaultItem="preferences"
      items={[{ name: "preferences", choices: [{ value: "option" }] }]}
    >
      <Questionnaire.Item name="preferences" multiple={multiple}>
        <QuestionnaireChoice value="option" checked>
          Option
        </QuestionnaireChoice>
      </Questionnaire.Item>
    </Questionnaire.Root>,
  );
}

describe("QuestionnaireChoice indicator", () => {
  it("shows the dot only for a checked radio choice", () => {
    const radioMarkup = renderCheckedChoice(false);
    const checkboxMarkup = renderCheckedChoice(true);
    const radioCheckedDotVariant =
      "group-data-[type=radio]/questionnaire-choice:group-data-checked/questionnaire-choice:block";
    const radioDotClass = /data-slot="questionnaire-choice-indicator-dot" class="([^"]+)"/.exec(
      radioMarkup,
    )?.[1];
    const checkboxDotClass = /data-slot="questionnaire-choice-indicator-dot" class="([^"]+)"/.exec(
      checkboxMarkup,
    )?.[1];

    expect(radioMarkup).toContain('data-type="radio"');
    expect(radioMarkup).toContain("data-checked");
    expect(radioDotClass?.split(" ")).toContain(radioCheckedDotVariant);
    expect(radioDotClass?.split(" ")).not.toContain(
      "group-data-checked/questionnaire-choice:block",
    );

    expect(checkboxMarkup).toContain('data-type="checkbox"');
    expect(checkboxMarkup).toContain("data-checked");
    expect(checkboxDotClass?.split(" ")).toContain(radioCheckedDotVariant);
    expect(checkboxDotClass?.split(" ")).not.toContain(
      "group-data-checked/questionnaire-choice:block",
    );
  });
});
