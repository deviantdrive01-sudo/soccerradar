"use client";

import { useSyncExternalStore } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";

const STORAGE_KEY = "soccerradar-cookie-consent";
const CONSENT_EVENT = "soccerradar-cookie-consent-changed";

declare global {
  interface Window {
    gtag?: (...args: unknown[]) => void;
  }
}

function subscribe(callback: () => void) {
  window.addEventListener(CONSENT_EVENT, callback);
  return () => window.removeEventListener(CONSENT_EVENT, callback);
}

/** Any recorded choice (accepted or rejected) hides the banner — only a first-time visitor with no choice yet sees it. */
function getSnapshot(): boolean {
  try {
    const value = localStorage.getItem(STORAGE_KEY);
    return value === "accepted" || value === "rejected";
  } catch {
    // Storage unavailable (private mode, blocked) — don't trap the visitor behind a banner that can't be dismissed.
    return true;
  }
}

/** Assume a choice was already made during SSR/hydration so the banner doesn't flash for returning visitors. */
function getServerSnapshot(): boolean {
  return true;
}

function updateConsent(granted: boolean): void {
  const state = granted ? "granted" : "denied";
  window.gtag?.("consent", "update", {
    ad_storage: state,
    ad_user_data: state,
    ad_personalization: state,
    analytics_storage: state,
  });
}

export function CookieConsent() {
  const decided = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  if (decided) return null;

  function choose(accepted: boolean) {
    try {
      localStorage.setItem(STORAGE_KEY, accepted ? "accepted" : "rejected");
    } catch {
      // If storage isn't available the banner will just reappear next visit — not worth surfacing an error for.
    }
    updateConsent(accepted);
    window.dispatchEvent(new Event(CONSENT_EVENT));
  }

  return (
    <div className="fixed inset-x-0 bottom-24 z-50 border-t border-border/60 bg-background/95 px-4 py-3 backdrop-blur supports-[backdrop-filter]:bg-background/80 sm:bottom-0">
      <div className="mx-auto flex w-full max-w-6xl flex-col items-start gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-xs text-muted-foreground">
          We use cookies to support advertising (via Google AdSense) and remember your preferences. Accepting lets
          ads be personalized; rejecting keeps them non-personalized. See our{" "}
          <Link href="/privacy" className="font-medium text-foreground underline underline-offset-2">
            Privacy Policy
          </Link>{" "}
          to learn more or change your choice later.
        </p>
        <div className="flex w-full shrink-0 items-center gap-2 sm:w-auto">
          <Button type="button" size="sm" variant="outline" onClick={() => choose(false)} className="flex-1 sm:flex-none">
            Reject
          </Button>
          <Button type="button" size="sm" onClick={() => choose(true)} className="flex-1 sm:flex-none">
            Accept
          </Button>
        </div>
      </div>
    </div>
  );
}
