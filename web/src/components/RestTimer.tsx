import { useTranslation } from "react-i18next";
import { useWorkoutTimer } from "../store/useWorkoutTimer";
import { Button } from "./ui/button";
import Icon from "./Icon";

const clock = (sec: number) => Math.floor(sec / 60) + ":" + String(sec % 60).padStart(2, "0");

// One bar, two meanings: the rest countdown between sets, and the work countdown during a
// timed set (issue #16). They are mutually exclusive by construction — startWork() stops any
// running rest — so the bar can never have to show both, and a work set gets its own colour
// plus a "Done" that logs the time actually held.
export default function RestTimer() {
  const { t } = useTranslation();
  const timer = useWorkoutTimer((state) => state.timer);
  const work = useWorkoutTimer((state) => state.work);
  const addRest = useWorkoutTimer((state) => state.addRest);
  const stopRest = useWorkoutTimer((state) => state.stopRest);
  const finishWorkEarly = useWorkoutTimer((state) => state.finishWorkEarly);
  const stopWork = useWorkoutTimer((state) => state.stopWork);
  const on = work || timer;
  if (!on) return null;
  const pct = (on.left / on.total) * 100;

  if (work)
    return (
      <div
        id="timer"
        className="fixed inset-x-3 bottom-24 z-60 flex animate-in items-center gap-3 rounded-xl border border-primary bg-card/95 px-3.5 py-3 shadow-xl backdrop-blur-xl backdrop-saturate-180 duration-200 ease-out slide-in-from-bottom-4 lg:right-auto lg:bottom-28 lg:left-1/2 lg:-ml-64 lg:w-130"
      >
        <div className="min-w-16.5 text-3xl font-semibold tracking-tight text-primary tabular-nums">
          {clock(work.left)}
        </div>
        <div className="min-w-0 flex-1">
          {work.label && (
            <div className="mb-1.5 overflow-hidden text-xs text-ellipsis whitespace-nowrap text-foreground/60 capitalize">
              {work.label}
            </div>
          )}
          <div className="h-1 flex-1 overflow-hidden rounded-full bg-input">
            <i
              className="block h-full bg-primary transition-all duration-1000 ease-linear"
              style={{ width: pct + "%" }}
            />
          </div>
        </div>
        <Button size="sm" className="w-auto" onClick={stopWork}>
          {t("common.cancel", "Cancel")}
        </Button>
        <Button size="sm" variant="default" className="w-auto" onClick={finishWorkEarly}>
          <Icon name="check" />
          {t("common.done", "Done")}
        </Button>
      </div>
    );
  // Three controls plus the clock don't fit one line on a phone — at 360px the bar is left
  // with about 30px and stops saying anything. So the rest variant stacks: clock and bar
  // read at a glance, controls get their own row. −15 and +15 sit together in number-line
  // order; Skip is pushed to the far edge, away from the button you tap to buy more time.
  if (!timer) return null;
  return (
    <div
      id="timer"
      className="fixed inset-x-3 bottom-24 z-60 flex animate-in flex-col items-stretch gap-2.5 rounded-xl bg-card/95 px-3.5 py-3 shadow-xl backdrop-blur-xl backdrop-saturate-180 duration-200 ease-out slide-in-from-bottom-4 lg:right-auto lg:bottom-28 lg:left-1/2 lg:-ml-64 lg:w-130 lg:flex-row lg:items-center lg:gap-3.5"
    >
      <div className="flex items-center gap-3 lg:min-w-0 lg:flex-1">
        <div className="min-w-16.5 text-3xl font-semibold tracking-tight tabular-nums">
          {clock(timer.left)}
        </div>
        <div className="h-1 flex-1 overflow-hidden rounded-full bg-input">
          <i
            className="block h-full bg-primary transition-all duration-1000 ease-linear"
            style={{ width: pct + "%" }}
          />
        </div>
      </div>
      <div className="flex items-center gap-2">
        <Button
          size="sm"
          className="min-h-11 w-auto py-3"
          aria-label={t("restTimer.reduce15Seconds", "Reduce rest by 15 seconds")}
          onClick={() => addRest(-15)}
        >
          <Icon name="minus" />
          15s
        </Button>
        <Button
          size="sm"
          className="min-h-11 w-auto py-3"
          aria-label={t("restTimer.add15Seconds", "Add 15 seconds")}
          onClick={() => addRest(15)}
        >
          <Icon name="plus" />
          15s
        </Button>
        <Button
          size="sm"
          variant="default"
          className="ml-auto w-auto min-w-21 py-3"
          onClick={stopRest}
        >
          {t("common.skip", "Skip")}
        </Button>
      </div>
    </div>
  );
}
