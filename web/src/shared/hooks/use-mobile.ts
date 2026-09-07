import * as React from "react";

const MOBILE_BREAKPOINT = 768;

const mobileMediaQuery = `(max-width: ${MOBILE_BREAKPOINT - 1}px)`;

function subscribeToMobileMediaQuery(onStoreChange: () => void) {
  const mediaQuery = window.matchMedia(mobileMediaQuery);
  mediaQuery.addEventListener("change", onStoreChange);
  return () => mediaQuery.removeEventListener("change", onStoreChange);
}

function getMobileSnapshot() {
  return window.innerWidth < MOBILE_BREAKPOINT;
}

function getServerMobileSnapshot() {
  return false;
}

export function useIsMobile() {
  return React.useSyncExternalStore(
    subscribeToMobileMediaQuery,
    getMobileSnapshot,
    getServerMobileSnapshot,
  );
}
