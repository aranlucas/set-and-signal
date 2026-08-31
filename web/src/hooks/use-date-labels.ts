import { useTranslation } from "react-i18next";

export function useDateLabels() {
  const { t } = useTranslation();
  return {
    weekdays: [
      t("date.weekday.sunday", "Sunday"),
      t("date.weekday.monday", "Monday"),
      t("date.weekday.tuesday", "Tuesday"),
      t("date.weekday.wednesday", "Wednesday"),
      t("date.weekday.thursday", "Thursday"),
      t("date.weekday.friday", "Friday"),
      t("date.weekday.saturday", "Saturday"),
    ],
    weekdaysShort: [
      t("date.weekdayShort.sunday", "Su"),
      t("date.weekdayShort.monday", "Mo"),
      t("date.weekdayShort.tuesday", "Tu"),
      t("date.weekdayShort.wednesday", "We"),
      t("date.weekdayShort.thursday", "Th"),
      t("date.weekdayShort.friday", "Fr"),
      t("date.weekdayShort.saturday", "Sa"),
    ],
    monthsShort: [
      t("date.monthShort.january", "Jan"),
      t("date.monthShort.february", "Feb"),
      t("date.monthShort.march", "Mar"),
      t("date.monthShort.april", "Apr"),
      t("date.monthShort.may", "May"),
      t("date.monthShort.june", "Jun"),
      t("date.monthShort.july", "Jul"),
      t("date.monthShort.august", "Aug"),
      t("date.monthShort.september", "Sep"),
      t("date.monthShort.october", "Oct"),
      t("date.monthShort.november", "Nov"),
      t("date.monthShort.december", "Dec"),
    ],
    monthsLong: [
      t("date.monthLong.january", "January"),
      t("date.monthLong.february", "February"),
      t("date.monthLong.march", "March"),
      t("date.monthLong.april", "April"),
      t("date.monthLong.may", "May"),
      t("date.monthLong.june", "June"),
      t("date.monthLong.july", "July"),
      t("date.monthLong.august", "August"),
      t("date.monthLong.september", "September"),
      t("date.monthLong.october", "October"),
      t("date.monthLong.november", "November"),
      t("date.monthLong.december", "December"),
    ],
  };
}
