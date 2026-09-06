"use client";

import { useCallback, useEffect, useState } from "react";
import { X } from "lucide-react";
import { TOUR_STEPS } from "@/lib/tour-steps";

const COMPLETED_KEY = "soccerradar-tour-completed";
const REQUEST_KEY = "soccerradar-tour-requested";
export const TOUR_REQUEST_EVENT = "soccerradar-tour-requested-event";

interface Rect {
  top: number;
  left: number;
  width: number;
  height: number;
}

function measure(el: Element): Rect {
  const r = el.getBoundingClientRect();
  return { top: r.top, left: r.left, width: r.width, height: r.height };
}

/**
 * Some anchors exist twice — a desktop version and a mobile version sharing
 * the same `data-tour` value, toggled with Tailwind's `hidden`/`lg:hidden`.
 * `hidden` is `display: none`, so the element stays in the DOM with a
 * zero-size rect rather than disappearing — plain querySelector would still
 * "find" it and highlight nothing. Pick the first instance actually laid out.
 */
function findVisibleTarget(dataTour: string): Element | null {
  const candidates = document.querySelectorAll(`[data-tour="${dataTour}"]`);
  for (const el of Array.from(candidates)) {
    const r = el.getBoundingClientRect();
    if (r.width > 0 && r.height > 0) return el;
  }
  return null;
}

export function ProductTour() {
  const [active, setActive] = useState(false);
  const [stepIndex, setStepIndex] = useState(0);
  const [rect, setRect] = useState<Rect | null>(null);

  const finish = useCallback(() => {
    setActive(false);
    try {
      localStorage.setItem(COMPLETED_KEY, "1");
    } catch {
      // Storage unavailable — the tour will just offer to run again next visit.
    }
  }, []);

  const start = useCallback(() => {
    setStepIndex(0);
    setActive(true);
  }, []);

  // First-time auto-start, plus pickup of a cross-page "take the tour" request.
  useEffect(() => {
    let requested = false;
    try {
      requested = sessionStorage.getItem(REQUEST_KEY) === "1";
      if (requested) sessionStorage.removeItem(REQUEST_KEY);
    } catch {
      // ignore
    }

    let completed = false;
    try {
      completed = localStorage.getItem(COMPLETED_KEY) === "1";
    } catch {
      // If storage is unavailable, treat as not completed — worst case the tour reappears.
    }

    if (requested || !completed) {
      const timer = setTimeout(start, requested ? 400 : 900);
      return () => clearTimeout(timer);
    }
  }, [start]);

  // Same-page "take the tour" trigger from the footer link.
  useEffect(() => {
    function onRequest() {
      start();
    }
    window.addEventListener(TOUR_REQUEST_EVENT, onRequest);
    return () => window.removeEventListener(TOUR_REQUEST_EVENT, onRequest);
  }, [start]);

  // Locate and measure the current step's target, skipping steps whose
  // target isn't rendered (e.g. a desktop-only anchor on a mobile layout).
  useEffect(() => {
    if (!active) return;

    let cancelled = false;
    let attempts = 0;

    function locate() {
      if (cancelled) return;
      const step = TOUR_STEPS[stepIndex];
      if (!step) {
        finish();
        return;
      }
      const el = findVisibleTarget(step.target);
      if (!el) {
        attempts += 1;
        if (attempts > 1) {
          // Genuinely not on this page/layout — move on rather than getting stuck.
          if (stepIndex < TOUR_STEPS.length - 1) setStepIndex((i) => i + 1);
          else finish();
          return;
        }
        // Give the page a beat to finish rendering, then try once more.
        setTimeout(locate, 300);
        return;
      }
      el.scrollIntoView({ block: "center", behavior: "smooth" });
      setTimeout(() => {
        if (!cancelled) setRect(measure(el));
      }, 350);
    }

    locate();
    return () => {
      cancelled = true;
    };
  }, [active, stepIndex, finish]);

  // Keep the highlight aligned on resize/scroll.
  useEffect(() => {
    if (!active) return;
    const step = TOUR_STEPS[stepIndex];
    if (!step) return;

    function reposition() {
      const el = findVisibleTarget(step.target);
      if (el) setRect(measure(el));
    }

    window.addEventListener("resize", reposition);
    window.addEventListener("scroll", reposition, true);
    return () => {
      window.removeEventListener("resize", reposition);
      window.removeEventListener("scroll", reposition, true);
    };
  }, [active, stepIndex]);

  useEffect(() => {
    if (!active) return;
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") finish();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [active, finish]);

  if (!active || !rect) return null;

  const step = TOUR_STEPS[stepIndex];
  const isLast = stepIndex === TOUR_STEPS.length - 1;
  const padding = 6;

  const spotlightStyle: React.CSSProperties = {
    position: "fixed",
    top: rect.top - padding,
    left: rect.left - padding,
    width: rect.width + padding * 2,
    height: rect.height + padding * 2,
    borderRadius: 10,
    boxShadow: "0 0 0 9999px rgba(0, 0, 0, 0.6)",
    zIndex: 100,
    pointerEvents: "none",
    transition: "top 0.25s ease, left 0.25s ease, width 0.25s ease, height 0.25s ease",
  };

  // Prefer placing the tooltip below the target; flip above if there's more
  // room there. Some targets (e.g. the whole league sidebar) are taller than
  // the viewport, so neither side may fit — the final clamp guarantees the
  // tooltip always stays fully on-screen even then.
  const viewportH = typeof window !== "undefined" ? window.innerHeight : 800;
  const viewportW = typeof window !== "undefined" ? window.innerWidth : 1200;
  const tooltipWidth = 320;
  const estimatedTooltipHeight = 200;
  const spaceBelow = viewportH - (rect.top + rect.height + padding);
  const spaceAbove = rect.top - padding;
  const placeAbove = spaceBelow < estimatedTooltipHeight && spaceAbove > spaceBelow;

  const rawTop = placeAbove
    ? rect.top - padding - 12 - estimatedTooltipHeight
    : rect.top + rect.height + padding + 12;
  const tooltipTop = Math.max(12, Math.min(rawTop, viewportH - estimatedTooltipHeight - 12));
  const tooltipLeft = Math.min(Math.max(12, rect.left), viewportW - tooltipWidth - 12);

  const tooltipStyle: React.CSSProperties = {
    position: "fixed",
    top: tooltipTop,
    left: tooltipLeft,
    width: tooltipWidth,
    zIndex: 101,
  };

  return (
    <>
      <div style={spotlightStyle} onClick={() => (isLast ? finish() : setStepIndex((i) => i + 1))} />
      <div
        style={tooltipStyle}
        className="rounded-lg border border-border/60 bg-popover p-4 text-popover-foreground shadow-xl"
      >
        <div className="flex items-start justify-between gap-2">
          <span className="text-xs font-medium text-muted-foreground">
            {stepIndex + 1} of {TOUR_STEPS.length}
          </span>
          <button
            type="button"
            onClick={finish}
            aria-label="Close tour"
            className="-mr-1 -mt-1 flex size-6 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            <X className="size-3.5" />
          </button>
        </div>
        <h3 className="mt-1 text-sm font-semibold">{step.title}</h3>
        <p className="mt-1 text-sm text-muted-foreground">{step.body}</p>
        <div className="mt-3 flex items-center justify-between">
          <button
            type="button"
            onClick={finish}
            className="text-xs font-medium text-muted-foreground hover:text-foreground"
          >
            Skip tour
          </button>
          <div className="flex items-center gap-2">
            {stepIndex > 0 && (
              <button
                type="button"
                onClick={() => setStepIndex((i) => i - 1)}
                className="h-7 rounded-md border border-border/60 px-2.5 text-xs font-medium hover:bg-muted"
              >
                Back
              </button>
            )}
            <button
              type="button"
              onClick={() => (isLast ? finish() : setStepIndex((i) => i + 1))}
              className="h-7 rounded-md bg-primary px-2.5 text-xs font-medium text-primary-foreground hover:bg-primary/90"
            >
              {isLast ? "Done" : "Next"}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
