"use client";

import { useEffect, useState } from "react";

interface LivePollingState<T> {
  data: T | null;
  error: string | null;
  loading: boolean;
}

/**
 * Polls `url` on `intervalMs` while the tab is visible, pausing when it
 * isn't (battery/request-volume friendly for a PWA users may leave open in
 * the background). Restarts immediately whenever `url` changes.
 */
export function useLivePolling<T>(url: string, intervalMs: number): LivePollingState<T> {
  const [state, setState] = useState<LivePollingState<T>>({ data: null, error: null, loading: true });

  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setInterval> | null = null;

    async function load() {
      try {
        const res = await fetch(url, { cache: "no-store" });
        if (!res.ok) throw new Error(`Request failed: ${res.status}`);
        const data = (await res.json()) as T;
        if (!cancelled) setState({ data, error: null, loading: false });
      } catch (err) {
        if (!cancelled) {
          setState((prev) => ({ ...prev, error: err instanceof Error ? err.message : "Failed to load", loading: false }));
        }
      }
    }

    function start() {
      load();
      timer = setInterval(load, intervalMs);
    }

    function stop() {
      if (timer) clearInterval(timer);
      timer = null;
    }

    function handleVisibility() {
      if (document.visibilityState === "visible") start();
      else stop();
    }

    if (document.visibilityState === "visible") start();
    document.addEventListener("visibilitychange", handleVisibility);

    return () => {
      cancelled = true;
      stop();
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, [url, intervalMs]);

  return state;
}
