"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { X } from "lucide-react";
import { useAdSettings } from "@/components/ad-settings-provider";

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

function fireAdEvent(type: "impression" | "click") {
  try {
    fetch("/api/ad-events", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type }),
      keepalive: true,
    }).catch(() => {});
  } catch {
    // Best-effort tracking — never let this block or break the ad itself.
  }
}

const IMAGE_EXTENSIONS = [".jpg", ".jpeg", ".png", ".webp", ".gif", ".avif"];

function isImagePath(path: string): boolean {
  const clean = path.split("?")[0].toLowerCase();
  return IMAGE_EXTENSIONS.some((ext) => clean.endsWith(ext));
}

function HouseAd({
  className,
  orientation,
  videoPath,
  clickUrl,
}: {
  className?: string;
  orientation: AdOrientation;
  videoPath: string;
  clickUrl: string;
}) {
  useEffect(() => {
    fireAdEvent("impression");
  }, []);

  const mediaClassName =
    orientation === "vertical" ? "aspect-9/16 w-full object-cover" : "aspect-video w-full object-cover";

  return (
    <div className={`overflow-hidden rounded-lg border border-border/60 bg-muted/30 ${className ?? ""}`}>
      <div className="border-b border-border/60 bg-muted/50 px-2 py-1">
        <span className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">Advertisement</span>
      </div>
      <a href={clickUrl} target="_blank" rel="noopener noreferrer" onClick={() => fireAdEvent("click")}>
        {isImagePath(videoPath) ? (
          // eslint-disable-next-line @next/next/no-img-element -- external, admin-controlled URL; not worth the Image optimizer round-trip
          <img src={videoPath} alt="Advertisement" className={mediaClassName} />
        ) : (
          <video
            src={videoPath}
            poster="/ads/placeholder-ad-poster.jpg"
            autoPlay
            muted
            loop
            playsInline
            className={mediaClassName}
          />
        )}
      </a>
    </div>
  );
}

/**
 * Which ad "wins" is a weighted coin flip (house-ad weight from admin settings),
 * but the flip itself must stay stable per tab and match between server and
 * client during hydration. So only the random roll (0-1) is memoized via
 * useSyncExternalStore (server always sees a fixed 0); the actual house/google
 * decision is a pure derivation from that roll + the settings, computed in render.
 */
let cachedRoll: number | null = null;

function subscribeRoll() {
  return () => {};
}

function getRollSnapshot(): number {
  if (cachedRoll === null) {
    cachedRoll = Math.random();
  }
  return cachedRoll;
}

function getRollServerSnapshot(): number {
  return 0;
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
  const settings = useAdSettings();
  const roll = useSyncExternalStore(subscribeRoll, getRollSnapshot, getRollServerSnapshot);
  const variant: AdVariant = settings.googleEnabled && roll * 100 >= settings.houseWeight ? "google" : "house";
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
      <HouseAd
        className={dismissible ? undefined : className}
        orientation={orientation}
        videoPath={settings.houseVideoPath}
        clickUrl={settings.houseClickUrl}
      />
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
