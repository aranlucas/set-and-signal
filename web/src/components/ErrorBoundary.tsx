import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { ErrorBoundary as ReactErrorBoundary } from "react-error-boundary";
import { useStore } from "../store/useStore";
import Icon from "./Icon";
import { Button } from "./ui/button";

interface ErrorBoundaryProps {
  children?: ReactNode;
}

/**
 * Last line of defence: one bad render used to blank the whole app, with no way back —
 * a workout referencing an exercise the build doesn't know would white-screen and, since
 * the running workout is persisted, do it again on every reload.
 *
 * Sits inside #app so the tab bar stays usable; the shell keys this subtree on the route,
 * so switching tabs re-mounts it and clears the error by itself.
 */
function Fallback() {
  const { t } = useTranslation();
  const activeWorkout = useStore((state) => state.appState.active);

  return (
    <div className="mx-auto w-full max-w-160">
      <div className="mt-24 px-5 py-11 text-center text-base leading-normal text-foreground/60">
        <div className="mb-3 flex justify-center text-4xl text-foreground/60">
          <Icon name="info" />
        </div>
        <div className="mb-1.5 font-semibold">
          {t("sharing.somethingWentWrong", "Something went wrong")}
        </div>
        {t(
          "sharing.screenCouldNotDrawnData",
          "This screen could not be drawn. Your data is safe on this device.",
        )}
      </div>
      <Button className="w-full" variant="default" onClick={() => location.reload()}>
        <Icon name="reset" />
        {t("error.reloadApp", "Reload Set & Signal")}
      </Button>
      {activeWorkout && (
        <>
          <div className="h-2" />
          <Button
            className="w-full"
            variant="destructive"
            onClick={() => {
              useStore.getState().update((state) => {
                state.active = null;
              });
              location.reload();
            }}
          >
            <Icon name="trash" />
            {t("sharing.discardRunningWorkout", "Discard the running workout")}
          </Button>
        </>
      )}
    </div>
  );
}

function logError(error: unknown) {
  console.error("Set & Signal render error:", error);
}

export default function ErrorBoundary({ children }: ErrorBoundaryProps) {
  return (
    <ReactErrorBoundary FallbackComponent={Fallback} onError={logError}>
      {children}
    </ReactErrorBoundary>
  );
}
