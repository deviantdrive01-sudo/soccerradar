"use client";

import { useSyncExternalStore } from "react";

export type ViewMode = "cards" | "table";

// Stored per device class (not one global value) so picking "cards" on
// desktop doesn't also override mobile's own sensible default — table needs
// horizontal scrolling there, so mobile should keep defaulting to cards
// unless someone explicitly overrides *on mobile*.
function storageKey(isMobile: boolean): string {
  return `soccerradar:viewMode:${isMobile ? "mobile" : "desktop"}`;
}

const listeners = new Set<() => void>();

function readStorage(isMobile: boolean): ViewMode | null {
  try {
    const v = window.localStorage.getItem(storageKey(isMobile));
    return v === "cards" || v === "table" ? v : null;
  } catch {
    return null;
  }
}

function subscribe(callback: () => void) {
  listeners.add(callback);
  return () => listeners.delete(callback);
}

function getServerSnapshot(): ViewMode | null {
  return null; // no stored preference on the server — falls back to the caller's responsive default until hydrated
}

/**
 * A user's explicit card/table choice, remembered across visits instead of
 * resetting to the responsive default every time they load the site. Null
 * means "no explicit choice yet for this device class" — the caller should
 * fall back to its own responsive default in that case.
 */
export function useStoredViewMode(isMobile: boolean): ViewMode | null {
  return useSyncExternalStore(subscribe, () => readStorage(isMobile), getServerSnapshot);
}

export function setStoredViewMode(isMobile: boolean, mode: ViewMode): void {
  try {
    window.localStorage.setItem(storageKey(isMobile), mode);
  } catch {
    // Private browsing / storage blocked — the in-session URL param (where the caller has one) still works.
  }
  for (const cb of listeners) cb();
}
