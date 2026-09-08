"use client";

import { useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ChevronLeft, Ticket } from "lucide-react";
import { useAccount, bookingItemKey } from "@/components/account-provider";
import { MARKET_KEYS, MARKET_LABELS, marketPredictionLabel, marketPredictionValue, marketOptions } from "@/lib/hydrate";
import { cn } from "cn";
import type { MarketKey, HydratedMarkets } from "@/lib/hydrate";

/**
 * For contexts where the relevant market isn't already fixed by the page
 * (the homepage's cards/table, where every market is visible at once) —
 * adds a "pick a market first" step before the usual booking list/create,
 * matching how the user described the feature: pick a market, then add it.
 * See components/booking-pick-button.tsx for the single-market version used
 * on the match detail page and Top Picks, where the market is already known.
 */
export function BookingAddButton({
  predictionId,
  markets,
  className,
}: {
  predictionId: number;
  markets: HydratedMarkets;
  className?: string;
}) {
  const { user, bookings, toggleBookingItem, createBooking } = useAccount();
  const triggerRef = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState<{ top: number; left: number } | null>(null);
  const [selectedMarketKey, setSelectedMarketKey] = useState<MarketKey | null>(null);
  const [selectedValue, setSelectedValue] = useState<string | null>(null);
  const [newTitle, setNewTitle] = useState("");
  const [creating, setCreating] = useState(false);

  const inAnyBooking = MARKET_KEYS.some((key) => bookings.some((b) => b.items.has(bookingItemKey(predictionId, key))));

  function selectMarket(key: MarketKey) {
    setSelectedMarketKey(key);
    setSelectedValue(marketPredictionValue(markets, key));
  }

  function handleOpen() {
    const rect = triggerRef.current?.getBoundingClientRect();
    if (rect) {
      // Fixed (viewport) positioning + a portal to <body> so the popover
      // escapes the match card's `overflow-hidden` (needed for rounded
      // corners) instead of being clipped inside the compact card.
      const width = 256; // matches the popover's w-64
      const left = Math.min(rect.left, window.innerWidth - width - 8);
      setPosition({ top: rect.bottom + 4, left: Math.max(8, left) });
    }
    setOpen(true);
  }

  function handleClose() {
    setOpen(false);
    setSelectedMarketKey(null);
    setSelectedValue(null);
    setNewTitle("");
  }

  async function handleCreate() {
    if (!newTitle.trim() || !selectedMarketKey) return;
    setCreating(true);
    const id = await createBooking(newTitle);
    setCreating(false);
    setNewTitle("");
    if (id !== null) toggleBookingItem(id, predictionId, selectedMarketKey, selectedValue);
  }

  return (
    <div className="relative inline-block" data-tour="booking-button">
      <button
        ref={triggerRef}
        type="button"
        onClick={() => (open ? handleClose() : handleOpen())}
        aria-label="Add a pick from this match to a mix"
        className={cn(
          "inline-flex size-6 shrink-0 items-center justify-center rounded-md border border-border/60 hover:bg-muted/60",
          className,
        )}
      >
        <Ticket className={inAnyBooking ? "size-3.5 text-primary" : "size-3.5 text-muted-foreground"} />
      </button>

      {open &&
        position &&
        createPortal(
          <>
            <div className="fixed inset-0 z-40" onClick={handleClose} />
            <div
              style={{ top: position.top, left: position.left }}
              className="fixed z-50 w-64 rounded-md border border-border/60 bg-popover p-2 shadow-lg"
            >
              {!user ? (
                <p className="p-2 text-[11px] text-muted-foreground">Log in to add picks to a mix.</p>
              ) : selectedMarketKey === null ? (
                <>
                  <p className="px-1 pb-1.5 text-[11px] font-medium text-muted-foreground">Pick a market</p>
                  <div className="max-h-48 space-y-0.5 overflow-y-auto">
                    {MARKET_KEYS.map((key) => (
                      <button
                        key={key}
                        type="button"
                        onClick={() => selectMarket(key)}
                        className="flex w-full items-center justify-between rounded px-1.5 py-1.5 text-left text-xs hover:bg-muted"
                      >
                        <span>{MARKET_LABELS[key]}</span>
                        <span className="text-[11px] font-medium text-muted-foreground">{marketPredictionLabel(markets, key)}</span>
                      </button>
                    ))}
                  </div>
                </>
              ) : (
                <>
                  <button
                    type="button"
                    onClick={() => setSelectedMarketKey(null)}
                    className="mb-1.5 inline-flex items-center gap-1 text-[11px] font-medium text-muted-foreground hover:text-foreground"
                  >
                    <ChevronLeft className="size-3.5" />
                    {MARKET_LABELS[selectedMarketKey]}
                  </button>

                  <div className="mb-1.5 flex flex-wrap gap-1">
                    {marketOptions(selectedMarketKey).map((option) => (
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
                  {selectedValue !== null && selectedValue !== marketPredictionValue(markets, selectedMarketKey) && (
                    <p className="mb-1.5 px-1 text-[10px] text-muted-foreground">
                      SoccerRadar predicts {marketPredictionLabel(markets, selectedMarketKey)} — you&apos;re going against it.
                    </p>
                  )}

                  {bookings.length === 0 && <p className="px-1 pb-2 text-[11px] text-muted-foreground">No mixes yet.</p>}
                  <div className="max-h-40 space-y-0.5 overflow-y-auto">
                    {bookings.map((b) => (
                      <label
                        key={b.id}
                        className="flex cursor-pointer items-center gap-2 rounded px-1.5 py-1.5 text-xs hover:bg-muted"
                      >
                        <input
                          type="checkbox"
                          checked={b.items.has(bookingItemKey(predictionId, selectedMarketKey))}
                          onChange={() => toggleBookingItem(b.id, predictionId, selectedMarketKey, selectedValue)}
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
                      className="h-7 flex-1 rounded-md border border-border/60 bg-background px-2 text-[11px] outline-none"
                    />
                    <button
                      type="button"
                      onClick={handleCreate}
                      disabled={creating || !newTitle.trim()}
                      className="h-7 shrink-0 rounded-md bg-primary px-2 text-[11px] font-medium text-primary-foreground disabled:opacity-60"
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
