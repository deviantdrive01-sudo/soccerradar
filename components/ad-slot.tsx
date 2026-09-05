"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { X } from "lucide-react";

const ADSENSE_CLIENT_ID = "ca-pub-8047973291517576";
const VIEW_COUNT_KEY = "soccerradar-ad-views";
const VIEW_COUNT_EVENT = "soccerradar-ad-view-changed";

/** Per-tab session count, not persisted across browser restarts — resets when the tab/session ends. */
function subscribeSessionViewCount(callback: () => void) {
  window.addEventListener(VIEW_COUNT_EVENT, callback);
  return () => window.removeEventListener(VIEW_COUNT_EVENT, callback);
}

function getSessionViewCount(): number {
  try {
    return Number(sessionStorage.getItem(VIEW_COUNT_KEY) ?? "0");
  } catch {
    return 0;
  }
}

function getSessionViewCountServerSnapshot(): number {
  return 0;
}

declare global {
  interface Window {
    adsbygoogle?: unknown[];
  }
}

type AdVariant = "house" | "google";
type AdOrientation = "vertical" | "horizontal";

function HouseAd({ className, orientation }: { className?: string; orientation: AdOrientation }) {
  return (
    <div className={`overflow-hidden rounded-lg border border-border/60 bg-muted/30 ${className ?? ""}`}>
      <div className="border-b border-border/60 bg-muted/50 px-2 py-1">
        <span className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">Advertisement</span>
      </div>
      <a href="https://getordara.com" target="_blank" rel="noopener noreferrer">
        <video
          src="/ads/placeholder-ad.mp4"
          autoPlay
          muted
          loop
          playsInline
          className={orientation === "vertical" ? "aspect-9/16 w-full object-cover" : "aspect-video w-full object-cover"}
        />
      </a>
    </div>
  );
}

/** Picked once per browser tab (module-level cache) so useSyncExternalStore's snapshot stays stable across calls. */
let cachedVariant: AdVariant | null = null;

function subscribe() {
  return () => {};
}

function getSnapshot(): AdVariant {
  if (cachedVariant === null) {
    cachedVariant = Math.random() < 0.5 ? "google" : "house";
  }
  return cachedVariant;
}

function getServerSnapshot(): AdVariant {
  return "house";
}

/**
 * Rotates between our own house ad and a live AdSense unit. The pick is made
 * once per page load — client-side only, swapping in right after hydration —
 * never on a timer, since AdSense policy treats refreshing/swapping a slot
 * without a real new pageview as invalid traffic.
 */
export function AdSlot({
  slotId,
  className,
  orientation = "vertical",
  dismissible = false,
  autoHideMs,
  maxViewsPerSession,
}: {
  slotId?: string;
  className?: string;
  orientation?: AdOrientation;
  /** Shows a close (X) button that hides the ad for the rest of this page view. */
  dismissible?: boolean;
  /** Auto-hides the ad this many ms after it first renders (e.g. 60000 for one minute). */
  autoHideMs?: number;
  /** Once this many page loads in the current tab session have shown an ad slot, stop showing it. */
  maxViewsPerSession?: number;
}) {
  const variant = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const sessionViews = useSyncExternalStore(
    subscribeSessionViewCount,
    getSessionViewCount,
    getSessionViewCountServerSnapshot,
  );
  const [dismissed, setDismissed] = useState(false);
  const overSessionLimit = maxViewsPerSession !== undefined && sessionViews >= maxViewsPerSession;

  useEffect(() => {
    if (maxViewsPerSession === undefined) return;
    try {
      const next = Number(sessionStorage.getItem(VIEW_COUNT_KEY) ?? "0") + 1;
      sessionStorage.setItem(VIEW_COUNT_KEY, String(next));
      window.dispatchEvent(new Event(VIEW_COUNT_EVENT));
    } catch {
      // Storage unavailable — the session cap just won't apply this session.
    }
    // Runs once per mount to record this view; not meant to re-fire if the prop changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!autoHideMs) return;
    const timer = setTimeout(() => setDismissed(true), autoHideMs);
    return () => clearTimeout(timer);
  }, [autoHideMs]);

  useEffect(() => {
    if (!slotId || variant !== "google") return;
    try {
      (window.adsbygoogle = window.adsbygoogle || []).push({});
    } catch {
      // AdSense script not loaded yet (e.g. blocked by an ad blocker) — safe to ignore.
    }
  }, [slotId, variant]);

  if (dismissed || overSessionLimit) return null;

  const adContent =
    !slotId || variant === "house" ? (
      <HouseAd className={dismissible ? undefined : className} orientation={orientation} />
    ) : (
      <ins
        className={`adsbygoogle block ${dismissible ? "" : (className ?? "")}`}
        style={{ display: "block" }}
        data-ad-client={ADSENSE_CLIENT_ID}
        data-ad-slot={slotId}
        data-ad-format="auto"
        data-full-width-responsive="true"
      />
    );

  if (!dismissible) return adContent;

  return (
    <div className={`relative ${className ?? ""}`}>
      {adContent}
      <button
        type="button"
        onClick={() => setDismissed(true)}
        aria-label="Dismiss ad"
        className="absolute right-1.5 top-1.5 flex size-5 items-center justify-center rounded-full bg-background/80 text-foreground shadow-sm backdrop-blur hover:bg-background"
      >
        <X className="size-3" />
      </button>
    </div>
  );
}
