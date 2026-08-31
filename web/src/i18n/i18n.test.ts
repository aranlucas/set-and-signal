import { afterEach, describe, expect, it } from "vitest";
import { fmtDate, formatDate } from "@/shared/lib/format";
import { i18n, setLang } from "@/i18n/i18n";
import { LANGUAGES, normalizeLanguage } from "@/i18n/languages";
import { translate } from "@/i18n/translate";

const activeLanguage = () => normalizeLanguage(i18n.resolvedLanguage || i18n.language);

afterEach(async () => {
  await setLang("en");
});

describe("i18next adapter", () => {
  it("bundles English and lazily loads another UI locale", async () => {
    await setLang("en");
    expect(i18n.hasResourceBundle("en", "translation")).toBe(true);
    expect(i18n.hasResourceBundle("es", "translation")).toBe(false);

    await setLang("es");

    expect(i18n.hasResourceBundle("es", "translation")).toBe(true);
    expect(activeLanguage()).toBe("es");
    expect(LANGUAGES[activeLanguage()].locale).toBe("es-ES");
    expect(translate("navigation.home", "Home")).toBe("Inicio");
  });

  it("uses named interpolation and numeric count plural selection", async () => {
    await setLang("en");
    expect(translate("home.hi", "Hi {{name}}", { name: "Ada" })).toBe("Hi Ada");
    expect(translate("common.workoutCount", "{{count}} workout", { count: 0 })).toBe("0 workouts");
    expect(translate("common.workoutCount", "{{count}} workout", { count: 1 })).toBe("1 workout");
    expect(translate("common.workoutCount", "{{count}} workouts", { count: 2 })).toBe("2 workouts");

    await setLang("ru");
    expect(translate("common.workoutCount", "{{count}} workouts", { count: 1 })).toBe(
      "Тренировок: 1",
    );
    expect(translate("common.workoutCount", "{{count}} workouts", { count: 2 })).toBe(
      "Тренировок: 2",
    );
    expect(translate("common.workoutCount", "{{count}} workouts", { count: 5 })).toBe(
      "Тренировок: 5",
    );
  });

  it("formats Date values through i18next's datetime formatter", async () => {
    const date = new Date("2026-08-25T12:00:00");

    await setLang("en");
    expect(formatDate(i18n.t, date, { weekday: "long", day: "numeric", month: "long" })).toBe(
      new Intl.DateTimeFormat("en-GB", {
        weekday: "long",
        day: "numeric",
        month: "long",
      }).format(date),
    );
    expect(fmtDate(i18n.t, "2026-08-25", true)).toBe(
      new Intl.DateTimeFormat("en-GB", {
        weekday: "short",
        day: "numeric",
        month: "short",
      }).format(date),
    );

    await setLang("es");
    expect(formatDate(i18n.t, date, { weekday: "long", day: "numeric", month: "long" })).toBe(
      new Intl.DateTimeFormat("es-ES", {
        weekday: "long",
        day: "numeric",
        month: "long",
      }).format(date),
    );
  });

  it("does not fall back to an uncounted plural base key", async () => {
    await setLang("en");
    expect(i18n.exists("common.workoutCount")).toBe(false);
    expect(i18n.getResource("en", "translation", "common.workoutCount")).toBeUndefined();
  });

  it("falls back to English for missing UI translations", async () => {
    await setLang("pt");

    expect(activeLanguage()).toBe("pt");
    expect(LANGUAGES[activeLanguage()].locale).toBe("pt-PT");
    expect(translate("account.tagline", "Your training, set by set.")).toBe(
      "Your training, set by set.",
    );
    i18n.removeResourceBundle("pt", "translation");
    expect(i18n.t("home.welcome", "Welcome!")).toBe("Welcome!");
    await i18n.reloadResources("pt", "translation");

    await setLang("not-a-language");
    expect(activeLanguage()).toBe("en");
    expect(LANGUAGES[activeLanguage()].locale).toBe("en-GB");
  });

  it.each(Object.keys(LANGUAGES))("can activate supported UI locale %s", async (language) => {
    await setLang(language);
    expect(activeLanguage()).toBe(language);
    expect(translate("navigation.home", "Home")).not.toBe("navigation.home");
  });

  it("keeps the newest rapid language change", async () => {
    const spanish = setLang("es");
    const french = setLang("fr");
    await Promise.all([spanish, french]);

    expect(activeLanguage()).toBe("fr");
    expect(translate("navigation.home", "Home")).toBe("Accueil");
  });
});
