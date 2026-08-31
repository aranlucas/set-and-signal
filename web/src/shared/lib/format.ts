// Formatting + date helpers (ported from the vanilla app, unit taken from the store where needed).
import type { TFunction } from "i18next";
import { i18n } from "@/i18n/i18n";
import { LANGUAGES, normalizeLanguage } from "@/i18n/languages";
import type { Unit, Weekday } from "@/shared/lib/types";

const WEEKDAYS = [0, 1, 2, 3, 4, 5, 6] as const;

export const weekdayOf = (date: Date): Weekday => WEEKDAYS[date.getDay()] ?? 0;
export const weekdayFromNumber = (value: number): Weekday | null =>
  WEEKDAYS.find((weekday) => weekday === value) ?? null;

export const todayISO = (): string => {
  const date = new Date();
  return (
    date.getFullYear() +
    "-" +
    String(date.getMonth() + 1).padStart(2, "0") +
    "-" +
    String(date.getDate()).padStart(2, "0")
  );
};

export const isoOf = (date: Date): string =>
  date.getFullYear() +
  "-" +
  String(date.getMonth() + 1).padStart(2, "0") +
  "-" +
  String(date.getDate()).padStart(2, "0");

const currentLocale = (): string =>
  LANGUAGES[normalizeLanguage(i18n.resolvedLanguage || i18n.language)].locale;

export function formatDate(t: TFunction, date: Date, options: Intl.DateTimeFormatOptions): string {
  return t("date.value", "{{date, datetime}}", {
    date,
    formatParams: {
      date: { ...options, locale: currentLocale() },
    },
  });
}

export function fmtDate(t: TFunction, iso: string, long?: boolean): string {
  const date = new Date(iso + "T12:00:00");
  return formatDate(
    t,
    date,
    long
      ? { weekday: "short", day: "numeric", month: "short" }
      : { day: "numeric", month: "short" },
  );
}
export function fmtDur(ms: number): string {
  const totalMinutes = Math.floor(ms / 60000);
  return totalMinutes >= 60
    ? Math.floor(totalMinutes / 60) + "h " + (totalMinutes % 60) + "m"
    : totalMinutes + " min";
}
// Imported history has no clock — an unknown duration is left out rather than shown as "0 min".
export const durPart = (ms: number): string[] => (ms >= 60000 ? [fmtDur(ms)] : []);
// Numbers follow the UI language, like the dates above — a hardcoded locale put Swiss
// apostrophes ("7'535 kg") in front of every user, in every language.
export const fmtNum = (n: number): string =>
  (Math.round(n * 10) / 10).toLocaleString(currentLocale());
// Plate inventories include quarter-unit increments (for example 1.25 kg). Those values
// must stay exact in loading instructions even though the rest of the UI prefers one decimal.
export const fmtPlate = (n: number): string =>
  n.toLocaleString(currentLocale(), { maximumFractionDigits: 2 });
// Volume stays in the profile's unit throughout: the old shorthand turned anything over
// 10 000 into "t", which is wrong for a pound profile and made one list mix "18.8t" with
// "7'535 kg" — two numbers you can't compare at a glance.
export const fmtVol = (v: number, unit: Unit): string => fmtNum(v) + " " + unit;
export const exCount = (t: TFunction, n: number): string =>
  t("common.exerciseCount", "{{count}} exercise", { count: n });

export function weekKey(d: string): string {
  const weekDate = new Date(d + "T12:00:00");
  const weekdayOffset = (weekDate.getDay() + 6) % 7;
  weekDate.setDate(weekDate.getDate() - weekdayOffset + 3);
  const januaryFourth = new Date(weekDate.getFullYear(), 0, 4);
  // Date arithmetic goes through + (valueOf): TS has no Date operator overload.
  const isoWeek =
    1 +
    Math.round(
      ((+weekDate - +januaryFourth) / 86400000 - 3 + ((januaryFourth.getDay() + 6) % 7)) / 7,
    );
  return weekDate.getFullYear() + "-" + isoWeek;
}

export const localTZ = (): string => {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  } catch {
    return "UTC";
  }
};

export const uid = (): string => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
