import { useState } from "react";
import { useTranslation } from "react-i18next";
import type { MouseEvent } from "react";
import { imgSrc, gifSrc } from "../lib/exercises";
import { useStore } from "../store/useStore";
import Icon from "./Icon";
import type { CatalogExercise } from "../lib/types";
import { cn } from "../lib/utils";

// Big autoplaying animation; tap toggles to the still frame. `compact` shrinks it (superset cards).
// Custom exercises have no media — the animation stays blank by design (issue #11).
// `minimizable` (workout view) adds a persistent minimize/expand control so the animation stops
// eating the screen; the chosen size is saved to settings and carries across exercises and
// future workouts (issue #12).
export default function Media({
  exercise,
  id,
  compact,
  minimizable,
}: {
  exercise: CatalogExercise;
  id?: string;
  compact?: boolean;
  minimizable?: boolean;
}) {
  const { t } = useTranslation();
  const [playing, setPlaying] = useState(true);
  const gifSize = useStore((state) => state.appState.gifSize);
  const update = useStore((state) => state.update);
  if (!exercise.gif) return null;
  const isMinimized = minimizable && gifSize === "mini";
  const toggleSize = (event: MouseEvent<HTMLButtonElement>) => {
    event.stopPropagation();
    update((state) => {
      state.gifSize = isMinimized ? "full" : "mini";
    });
  };
  const togglePlayback = () => setPlaying((currentlyPlaying) => !currentlyPlaying);
  return (
    <div className="relative mb-3 shrink-0 overflow-hidden rounded-xl bg-white" id={id}>
      <button
        type="button"
        className="block w-full cursor-pointer bg-transparent p-0 text-left"
        aria-label={
          playing
            ? t("media.pauseAnimation", "Pause animation")
            : t("media.playAnimation", "Play animation")
        }
        onClick={togglePlayback}
      >
        <img
          className={cn(
            "block h-80 w-full object-contain",
            compact && "h-30",
            isMinimized && "h-21",
          )}
          decoding="async"
          src={playing ? gifSrc(exercise) : imgSrc(exercise)}
          alt={exercise.n}
        />
      </button>
      {minimizable && (
        <button
          type="button"
          className="absolute bottom-2.5 left-2.5 inline-flex min-h-11 items-center gap-1 rounded-full bg-black/45 px-3 py-1.5 text-xs font-medium text-white backdrop-blur-md"
          onClick={toggleSize}
          aria-label={
            isMinimized
              ? t("media.expandAnimation", "Expand animation")
              : t("media.minimizeAnimation", "Minimize animation")
          }
        >
          <Icon name={isMinimized ? "expand" : "minimize"} />
          {isMinimized
            ? t("customExercise.expand", "Expand")
            : t("customExercise.minimize", "Minimize")}
        </button>
      )}
      {!isMinimized && (
        <span className="absolute right-2.5 bottom-2.5 inline-flex items-center gap-1 rounded-full bg-black/45 px-3 py-1.5 text-xs font-medium text-white backdrop-blur-md">
          <Icon name={playing ? "pause" : "play"} />
          {playing ? t("media.tapPause", "tap to pause") : t("media.tapPlay", "tap to play")}
        </span>
      )}
    </div>
  );
}

export function Thumb({ exercise }: { exercise: CatalogExercise }) {
  if (!exercise.img)
    return (
      <div className="flex size-12.5 shrink-0 items-center justify-center rounded-md bg-muted text-2xl text-foreground/60">
        <Icon name="dumbbell" />
      </div>
    );
  return (
    <img
      className="size-12.5 shrink-0 rounded-md bg-white object-cover"
      loading="lazy"
      decoding="async"
      src={imgSrc(exercise)}
      alt=""
    />
  );
}
