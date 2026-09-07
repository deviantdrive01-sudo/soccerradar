"use client";

/**
 * Tracks whether the user has navigated client-side at least once within
 * this app session — the reliable signal BackLink needs. Neither
 * `window.history.length` nor `document.referrer` work for this: history
 * length counts the browser's initial about:blank entry too (a fresh direct
 * load can already read > 1), and referrer is frozen at whichever hard page
 * load started this tab's session, never updated by History API navigation
 * (which is all client-side <Link> routing ever does).
 */
let navigated = false;
const listeners = new Set<() => void>();

export function markNavigatedWithinApp() {
  if (navigated) return;
  navigated = true;
  for (const listener of listeners) listener();
}

export function subscribeNavigatedWithinApp(callback: () => void) {
  listeners.add(callback);
  return () => listeners.delete(callback);
}

export function getNavigatedWithinAppSnapshot() {
  return navigated;
}

export function getNavigatedWithinAppServerSnapshot() {
  return false;
}
