export interface SearchableExercise {
  n: string;
  tg?: string;
  eq?: string;
  desc?: string;
}

const normalize = (value: string) => value.toLocaleLowerCase().trim();

export function exerciseSearchScore(exercise: SearchableExercise, rawQuery: string): number | null {
  const query = normalize(rawQuery);
  if (!query) return 0;

  const name = normalize(exercise.n);
  const tokens = query.split(/\s+/);
  const haystack = normalize(
    [exercise.n, exercise.tg || "", exercise.eq || "", exercise.desc || ""].join(" "),
  );
  if (!tokens.every((token) => haystack.includes(token))) return null;
  if (name === query) return 0;
  if (name.includes(query)) return 1;
  if (tokens.every((token) => name.includes(token))) return 2;
  return 3;
}
