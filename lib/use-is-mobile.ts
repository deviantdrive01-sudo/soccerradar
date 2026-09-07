"use client";

import { useSyncExternalStore } from "react";

const QUERY = "(min-width: 1024px)"; // Tailwind's `lg` breakpoint, matches the `lg:hidden` cutoffs used across the dashboard

function subscribe(callback: () => void) {
  const mql = window.matchMedia(QUERY);
  mql.addEventListener("change", callback);
  return () => mql.removeEventListener("change", callback);
}

function getSnapshot() {
  return !window.matchMedia(QUERY).matches;
}

// Assume desktop on the server/first paint so SSR markup matches the initial
// client render; useSyncExternalStore then syncs to the real viewport right
// after mount, per React's documented fix for this exact hydration case.
function getServerSnapshot() {
  return false;
}

export function useIsMobile(): boolean {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
