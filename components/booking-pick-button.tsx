"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { useAccount, bookingItemKey } from "@/components/account-provider";
import { cn } from "cn";
import type { MarketKey } from "@/lib/hydrate";

export function BookingPickButton({
  predictionId,
  marketKey,
  className,
}: {
  predictionId: number;
  marketKey: MarketKey;
  /** Merged into the trigger button — use for size/position overrides (e.g. overlaying a card corner). */
  className?: string;
}) {
  const { user, bookings, toggleBookingItem, createBooking } = useAccount();
  const [open, setOpen] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [creating, setCreating] = useState(false);

  const key = bookingItemKey(predictionId, marketKey);
  const inAnyBooking = bookings.some((b) => b.items.has(key));

  async function handleCreate() {
    if (!newTitle.trim()) return;
    setCreating(true);
    const id = await createBooking(newTitle);
    setCreating(false);
    setNewTitle("");
    if (id !== null) toggleBookingItem(id, predictionId, marketKey);
  }

  return (
    <div className="relative inline-block">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label="Add this pick to a booking"
        className={cn("inline-flex size-4 shrink-0 items-center justify-center rounded-full border border-border/60 hover:bg-muted/60", className)}
      >
        <Plus className={inAnyBooking ? "size-2.5 text-primary" : "size-2.5 text-muted-foreground"} />
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute left-0 top-full z-20 mt-1 w-56 rounded-md border border-border/60 bg-popover p-2 shadow-lg">
            {!user ? (
              <p className="p-2 text-xs text-muted-foreground">Log in to add picks to a booking.</p>
            ) : (
              <>
                {bookings.length === 0 && <p className="px-1 pb-2 text-xs text-muted-foreground">No bookings yet.</p>}
                <div className="max-h-40 space-y-0.5 overflow-y-auto">
                  {bookings.map((b) => (
                    <label
                      key={b.id}
                      className="flex cursor-pointer items-center gap-2 rounded px-1.5 py-1.5 text-sm hover:bg-muted"
                    >
                      <input
                        type="checkbox"
                        checked={b.items.has(key)}
                        onChange={() => toggleBookingItem(b.id, predictionId, marketKey)}
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
                    placeholder="New booking"
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
        </>
      )}
    </div>
  );
}
