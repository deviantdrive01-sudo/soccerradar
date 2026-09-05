"use client";

import { useSyncExternalStore } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";

const STORAGE_KEY = "soccerradar-cookie-consent";
const CONSENT_EVENT = "soccerradar-cookie-consent-changed";

function subscribe(callback: () => void) {
  window.addEventListener(CONSENT_EVENT, callback);
  return () => window.removeEventListener(CONSENT_EVENT, callback);
}

function getSnapshot(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY) === "accepted";
  } catch {
    // Storage unavailable (private mode, blocked) — don't trap the visitor behind a banner that can't be dismissed.
    return true;
  }
}

/** Assume consent during SSR/hydration so the banner doesn't flash for returning visitors. */
function getServerSnapshot(): boolean {
  return true;
}

export function CookieConsent() {
  const consented = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  if (consented) return null;

  function accept() {
    try {
      localStorage.setItem(STORAGE_KEY, "accepted");
    } catch {
      // If storage isn't available the banner will just reappear next visit — not worth surfacing an error for.
    }
    window.dispatchEvent(new Event(CONSENT_EVENT));
  }

  return (
    <div className="fixed inset-x-0 bottom-0 z-50 border-t border-border/60 bg-background/95 px-4 py-3 backdrop-blur supports-[backdrop-filter]:bg-background/80">
      <div className="mx-auto flex w-full max-w-6xl flex-col items-start gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-xs text-muted-foreground">
          We use cookies to support advertising (via Google AdSense) and remember your preferences. See our{" "}
          <Link href="/privacy" className="font-medium text-foreground underline underline-offset-2">
            Privacy Policy
          </Link>{" "}
          to learn more or opt out.
        </p>
        <Button type="button" size="sm" onClick={accept} className="w-full shrink-0 sm:w-auto">
          Accept
        </Button>
      </div>
    </div>
  );
}
