"use client";

import { useSyncExternalStore } from "react";

const DESKTOP_QUERY = "(min-width: 1024px)"; // matches Tailwind's `lg` breakpoint used elsewhere

function subscribeIsDesktop(callback: () => void) {
  const mql = window.matchMedia(DESKTOP_QUERY);
  mql.addEventListener("change", callback);
  return () => mql.removeEventListener("change", callback);
}

function getIsDesktopSnapshot(): boolean {
  return window.matchMedia(DESKTOP_QUERY).matches;
}

function getIsDesktopServerSnapshot(): boolean {
  return false;
}

/** Table's dense multi-column layout needs room a phone doesn't have — used to default to Cards on mobile, Table on desktop. */
export function useIsDesktop(): boolean {
  return useSyncExternalStore(subscribeIsDesktop, getIsDesktopSnapshot, getIsDesktopServerSnapshot);
}
