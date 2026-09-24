"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { X } from "lucide-react";

const DISMISS_KEY = "soccerradar-install-prompt-dismissed";
const DISMISS_EVENT = "soccerradar-install-prompt-dismissed-changed";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

function isIos(): boolean {
  return /iphone|ipad|ipod/i.test(window.navigator.userAgent);
}

function isStandalone(): boolean {
  const nav = window.navigator as Navigator & { standalone?: boolean };
  return window.matchMedia("(display-mode: standalone)").matches || nav.standalone === true;
}

function subscribeDismissed(callback: () => void) {
  window.addEventListener(DISMISS_EVENT, callback);
  return () => window.removeEventListener(DISMISS_EVENT, callback);
}

/** Already dismissed, or already installed — either way, nothing to show. */
function getDismissedSnapshot(): boolean {
  try {
    if (localStorage.getItem(DISMISS_KEY) === "1") return true;
  } catch {
    // Storage unavailable — treat as not dismissed rather than trapping the banner permanently hidden.
  }
  return isStandalone();
}

/** Match SSR (no window) — never dismissed, matches nothing to render below. */
function getDismissedServerSnapshot(): boolean {
  return true;
}

/** iOS-ness never changes after mount, so no subscription is needed — just an SSR-safe read. */
function subscribeNever() {
  return () => {};
}

function getIosServerSnapshot(): boolean {
  return false;
}

/**
 * Android/desktop Chrome fires `beforeinstallprompt`, which we capture and
 * replay on tap. iOS Safari never fires it, so we detect iOS instead and
 * show manual "Add to Home Screen" instructions. Dismissal is sticky
 * (localStorage) — same one-and-done pattern as `cookie-consent.tsx`, via
 * `useSyncExternalStore` rather than an effect that calls `setState`
 * directly (which cascades an extra render for every visitor).
 */
export function InstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const dismissed = useSyncExternalStore(subscribeDismissed, getDismissedSnapshot, getDismissedServerSnapshot);
  const isIosDevice = useSyncExternalStore(subscribeNever, isIos, getIosServerSnapshot);

  useEffect(() => {
    function handleBeforeInstall(event: Event) {
      event.preventDefault();
      setDeferredPrompt(event as BeforeInstallPromptEvent);
    }
    window.addEventListener("beforeinstallprompt", handleBeforeInstall);
    return () => window.removeEventListener("beforeinstallprompt", handleBeforeInstall);
  }, []);

  function dismiss() {
    try {
      localStorage.setItem(DISMISS_KEY, "1");
    } catch {
      // If storage isn't available the banner just reappears next visit — not worth surfacing an error for.
    }
    window.dispatchEvent(new Event(DISMISS_EVENT));
  }

  async function install() {
    if (!deferredPrompt) return;
    await deferredPrompt.prompt();
    await deferredPrompt.userChoice;
    setDeferredPrompt(null);
    dismiss();
  }

  if (dismissed || (!deferredPrompt && !isIosDevice)) return null;

  return (
    <div className="flex items-center justify-between gap-3 border-b border-border/60 bg-muted/60 px-4 py-2 text-sm">
      <p className="min-w-0 truncate text-muted-foreground">
        {deferredPrompt
          ? "Install SoccerRadar for quick access to live scores."
          : 'Install SoccerRadar: tap Share, then "Add to Home Screen."'}
      </p>
      <div className="flex shrink-0 items-center gap-2">
        {deferredPrompt && (
          <button
            type="button"
            onClick={install}
            className="rounded-full bg-primary px-3 py-1 text-xs font-medium text-primary-foreground"
          >
            Install
          </button>
        )}
        <button type="button" onClick={dismiss} aria-label="Dismiss" className="text-muted-foreground hover:text-foreground">
          <X className="size-4" />
        </button>
      </div>
    </div>
  );
}
