import type { Workout } from "@/shared/lib/types";
import { isoOf, weekKey } from "@/shared/lib/format";

export function volumeTrend(workouts: Workout[], today: string, weeks = 6) {
  const monday = new Date(today + "T12:00:00");
  monday.setDate(monday.getDate() - ((monday.getDay() + 6) % 7));
  const count = Math.max(1, Math.min(52, Math.trunc(weeks) || 1));
  return Array.from({ length: count }, (_, index) => {
    const date = new Date(monday);
    date.setDate(date.getDate() - (count - index - 1) * 7);
    const key = weekKey(isoOf(date));
    const sessions = workouts.filter((workout) => workout.d <= today && weekKey(workout.d) === key);
    return {
      date: isoOf(date),
      volume: sessions.reduce((total, workout) => total + workout.vol, 0),
      sessions: sessions.length,
    };
  });
}

export function weeklySummary(workouts: Workout[], today: string) {
  const [previous, current] = volumeTrend(workouts, today, 2);
  const thisWeek = workouts.filter(
    (workout) => workout.d <= today && weekKey(workout.d) === weekKey(today),
  );
  return {
    sessions: current?.sessions ?? 0,
    volume: current?.volume ?? 0,
    records: thisWeek.reduce((total, workout) => total + workout.prs.length, 0),
    change: previous?.volume
      ? Math.round((((current?.volume ?? 0) - previous.volume) / previous.volume) * 100)
      : null,
  };
}
