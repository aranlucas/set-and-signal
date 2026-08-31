// The Push/Pull/Legs starter plan. Resolve it by its stable key so adding or reordering
// curated plans cannot silently change the demo seed or first-run experience.
import { CURATED, curatedRoutines } from "./curated.js";
import type { Routine } from "./types.js";

export const starterRoutines = (): Routine[] => {
  const starterPlan = CURATED.find((plan) => plan.key === "ppl");
  if (!starterPlan) throw new Error("Push / Pull / Legs starter plan is missing");
  return curatedRoutines(starterPlan);
};
