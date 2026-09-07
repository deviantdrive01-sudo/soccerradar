"use client";

import { useRef, useSyncExternalStore } from "react";
import { AllLeaguesBadge } from "@/components/all-leagues-badge";

const STORAGE_KEY = "soccerradar-league-fab-position";
const SIZE = 64; // px, matches the size-16 badge below
const DRAG_THRESHOLD = 8; // px of movement before a press counts as a drag, not a tap
const MARGIN = 8;
// Keeps the badge clear of the header above and the sticky bottom nav /
// cookie banner below, matching their fixed heights in app/layout.tsx and
// components/mobile-bottom-nav.tsx.
const TOP_CLEARANCE = 64;
// Measured: the bottom nav's top edge sits ~70px up, the (dismissible)
// cookie banner's top edge ~209px up on a 390x800 viewport with wrapped
// text — clear both with margin so a first-time visitor's FAB isn't parked
// behind either.
const BOTTOM_CLEARANCE = 280;

type Position = { x: number; y: number };

function clamp(x: number, y: number): Position {
  const maxX = window.innerWidth - SIZE - MARGIN;
  const maxY = window.innerHeight - BOTTOM_CLEARANCE;
  return {
    x: Math.min(Math.max(x, MARGIN), Math.max(MARGIN, maxX)),
    y: Math.min(Math.max(y, TOP_CLEARANCE), Math.max(TOP_CLEARANCE, maxY)),
  };
}

function defaultPosition(): Position {
  return clamp(window.innerWidth - SIZE - MARGIN, window.innerHeight - BOTTOM_CLEARANCE);
}

/**
 * Minimal external store for the FAB's dragged position — a plain useState
 * can't hold this: the initial value has to come from localStorage/viewport
 * size, both client-only, and setting it from an effect trips the
 * no-setState-in-effect lint rule. Routing reads AND writes through
 * useSyncExternalStore (same pattern as lib/use-is-mobile.ts) avoids both
 * problems: getSnapshot computes/caches the restored position once, and
 * drag handlers call setPosition directly from event handlers, not effects.
 */
let cached: Position | null = null;
const listeners = new Set<() => void>();

function setPosition(next: Position) {
  cached = next;
  for (const listener of listeners) listener();
}

function subscribe(callback: () => void) {
  listeners.add(callback);
  return () => listeners.delete(callback);
}

function getSnapshot(): Position {
  if (cached) return cached;
  let restored: Position | null = null;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) restored = JSON.parse(raw);
  } catch {
    // Storage unavailable or corrupt value — fall back to the default position.
  }
  cached = restored ? clamp(restored.x, restored.y) : defaultPosition();
  return cached;
}

function getServerSnapshot(): Position | null {
  return null;
}

/**
 * Floating "All Leagues" badge — draggable so it never permanently blocks
 * content underneath. Position persists per-browser via localStorage; a tap
 * (movement under DRAG_THRESHOLD) opens the league drawer instead of
 * counting as a drag.
 */
export function DraggableLeagueFab({ hasActiveFilter, onOpen }: { hasActiveFilter: boolean; onOpen: () => void }) {
  const pos = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const dragRef = useRef<{ startX: number; startY: number; originX: number; originY: number; moved: boolean } | null>(null);

  function handlePointerDown(e: React.PointerEvent<HTMLButtonElement>) {
    if (!pos) return;
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      // Some touch browsers reject capture for a given pointer id — the
      // drag/tap tracking below doesn't actually depend on capture succeeding.
    }
    dragRef.current = { startX: e.clientX, startY: e.clientY, originX: pos.x, originY: pos.y, moved: false };
  }

  function handlePointerMove(e: React.PointerEvent<HTMLButtonElement>) {
    const drag = dragRef.current;
    if (!drag) return;
    const dx = e.clientX - drag.startX;
    const dy = e.clientY - drag.startY;
    if (Math.abs(dx) > DRAG_THRESHOLD || Math.abs(dy) > DRAG_THRESHOLD) drag.moved = true;
    if (drag.moved) setPosition(clamp(drag.originX + dx, drag.originY + dy));
  }

  function handlePointerUp(e: React.PointerEvent<HTMLButtonElement>) {
    const drag = dragRef.current;
    dragRef.current = null;
    if (!drag) return;
    if (!drag.moved) {
      // On touch devices the browser also synthesizes a click from this same
      // tap, landing just after this handler runs. If the drawer opens
      // synchronously, that stray click hits a league row rendered at this
      // exact spot and immediately closes the drawer again. Deferring the
      // open to the next tick lets the synthetic click resolve first,
      // against the old page (a harmless no-op), before the drawer exists.
      e.preventDefault();
      setTimeout(onOpen, 0);
      return;
    }
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(cached));
    } catch {
      // Storage unavailable — position just won't persist across reloads.
    }
  }

  if (!pos) return null;

  return (
    <button
      type="button"
      data-tour="league-sidebar"
      aria-label="Change league"
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
      style={{ left: pos.x, top: pos.y, width: SIZE, height: SIZE, touchAction: "none" }}
      className="fixed z-20 rounded-full lg:hidden"
    >
      <span className="pointer-events-none absolute inset-0 -z-10 animate-pulse rounded-full bg-primary opacity-60 blur-lg motion-reduce:animate-none" />
      <AllLeaguesBadge className="size-16" />
      {hasActiveFilter && (
        <span className="absolute right-0 top-0 size-3.5 rounded-full border-2 border-background bg-red-500" />
      )}
    </button>
  );
}
