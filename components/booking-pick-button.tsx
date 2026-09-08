"use client";

import { useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Plus } from "lucide-react";
import { useAccount, bookingItemKey } from "@/components/account-provider";
import { marketOptions, marketPredictionLabel, marketPredictionValue } from "@/lib/hydrate";
import { cn } from "cn";
import type { HydratedMarkets, MarketKey } from "@/lib/hydrate";

export function BookingPickButton({
  predictionId,
  marketKey,
  markets,
  className,
}: {
  predictionId: number;
  marketKey: MarketKey;
  markets: HydratedMarkets;
  /** Merged into the trigger button — use for size/position overrides (e.g. overlaying a card corner). */
  className?: string;
}) {
  const { user, bookings, toggleBookingItem, createBooking } = useAccount();
  const triggerRef = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState<{ top: number; left: number } | null>(null);
  const [newTitle, setNewTitle] = useState("");
  const [creating, setCreating] = useState(false);
  const defaultValue = marketPredictionValue(markets, marketKey);
  const [selectedValue, setSelectedValue] = useState<string | null>(defaultValue);

  const key = bookingItemKey(predictionId, marketKey);
  const inAnyBooking = bookings.some((b) => b.items.has(key));

  function handleToggle() {
    if (open) {
      setOpen(false);
      return;
    }
    setSelectedValue(defaultValue);
    const rect = triggerRef.current?.getBoundingClientRect();
    if (rect) {
      // Fixed (viewport) positioning + a portal to <body> so the popover
      // escapes any card `overflow-hidden` and never overflows past the
      // right edge of a narrow (mobile) viewport.
      const width = 224; // matches the popover's w-56
      const left = Math.min(rect.left, window.innerWidth - width - 8);
      setPosition({ top: rect.bottom + 4, left: Math.max(8, left) });
    }
    setOpen(true);
  }

  async function handleCreate() {
    if (!newTitle.trim()) return;
    setCreating(true);
    const id = await createBooking(newTitle);
    setCreating(false);
    setNewTitle("");
    if (id !== null) toggleBookingItem(id, predictionId, marketKey, selectedValue);
  }

  return (
    <div className="relative inline-block">
      <button
        ref={triggerRef}
        type="button"
        onClick={handleToggle}
        aria-label="Add this pick to a booking"
        className={cn("inline-flex size-4 shrink-0 items-center justify-center rounded-full border border-border/60 hover:bg-muted/60", className)}
      >
        <Plus className={inAnyBooking ? "size-2.5 text-primary" : "size-2.5 text-muted-foreground"} />
      </button>

      {open &&
        position &&
        createPortal(
          <>
            <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
            <div
              style={{ top: position.top, left: position.left }}
              className="fixed z-50 w-56 rounded-md border border-border/60 bg-popover p-2 shadow-lg"
            >
              {!user ? (
                <p className="p-2 text-xs text-muted-foreground">Log in to add picks to a mix.</p>
              ) : (
                <>
                  <div className="mb-1.5 flex flex-wrap gap-1">
                    {marketOptions(marketKey).map((option) => (
                      <button
                        key={option.value}
                        type="button"
                        onClick={() => setSelectedValue(option.value)}
                        className={cn(
                          "rounded px-1.5 py-1 text-[11px] font-medium",
                          selectedValue === option.value
                            ? "bg-primary text-primary-foreground"
                            : "border border-border/60 text-muted-foreground hover:bg-muted",
                        )}
                      >
                        {option.label}
                      </button>
                    ))}
                  </div>
                  {selectedValue !== null && selectedValue !== defaultValue && (
                    <p className="mb-1.5 px-1 text-[10px] text-muted-foreground">
                      SoccerRadar predicts {marketPredictionLabel(markets, marketKey)} — you&apos;re going against it.
                    </p>
                  )}

                  {bookings.length === 0 && <p className="px-1 pb-2 text-xs text-muted-foreground">No mixes yet.</p>}
                  <div className="max-h-40 space-y-0.5 overflow-y-auto">
                    {bookings.map((b) => (
                      <label
                        key={b.id}
                        className="flex cursor-pointer items-center gap-2 rounded px-1.5 py-1.5 text-sm hover:bg-muted"
                      >
                        <input
                          type="checkbox"
                          checked={b.items.has(key)}
                          onChange={() => toggleBookingItem(b.id, predictionId, marketKey, selectedValue)}
                          className="size-3.5"
                        />
                        <span className="truncate">{b.title}</span>
                      </label>
                    ))}
                  </div>
                  <div className="mt-2 flex items-center gap-1 border-t border-border/60 pt-2">
                    <input
                      value={newTitle}
                      onChange={(e) => setNewTitle(e.target.value)}
                      placeholder="New mix"
                      className="h-7 flex-1 rounded-md border border-border/60 bg-background px-2 text-xs outline-none"
                    />
                    <button
                      type="button"
                      onClick={handleCreate}
                      disabled={creating || !newTitle.trim()}
                      className="h-7 shrink-0 rounded-md bg-primary px-2 text-xs font-medium text-primary-foreground disabled:opacity-60"
                    >
                      Add
                    </button>
                  </div>
                </>
              )}
            </div>
          </>,
          document.body,
        )}
    </div>
  );
}
