"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, X } from "lucide-react";
import { useAccount } from "@/components/account-provider";
import { ShareButtons } from "@/components/share-buttons";
import { renameBooking, deleteBooking, toggleBookingItem } from "@/app/account/bookings/actions";
import { marketPredictionLabel, MARKET_LABELS } from "@/lib/hydrate";
import type { MarketKey } from "@/lib/hydrate";
import type { Prediction } from "@/lib/supabase/types";

export interface BookingPick {
  prediction: Prediction;
  marketKey: MarketKey;
}

export function BookingManage({
  bookingId,
  ownerId,
  ownerLabel,
  initialTitle,
  picks,
  leagueById,
  shareUrl,
}: {
  bookingId: number;
  ownerId: string;
  ownerLabel: string;
  initialTitle: string;
  picks: BookingPick[];
  leagueById: Map<number, { name: string }>;
  shareUrl: string;
}) {
  const { user } = useAccount();
  const router = useRouter();
  const isOwner = user?.userId === ownerId;

  const [items, setItems] = useState(picks);
  const [title, setTitle] = useState(initialTitle);
  const [renaming, setRenaming] = useState(false);
  const [titleDraft, setTitleDraft] = useState(initialTitle);

  async function handleRemove(predictionId: number, marketKey: MarketKey) {
    setItems((prev) => prev.filter((p) => !(p.prediction.id === predictionId && p.marketKey === marketKey)));
    try {
      await toggleBookingItem(bookingId, predictionId, marketKey);
    } catch {
      // Best effort — a page refresh will reconcile if this failed silently.
    }
  }

  async function handleDelete() {
    if (!confirm("Delete this booking? This can't be undone.")) return;
    await deleteBooking(bookingId);
    router.push("/account/bookings");
  }

  async function handleRename() {
    if (!titleDraft.trim()) return;
    await renameBooking(bookingId, titleDraft);
    setTitle(titleDraft.trim());
    setRenaming(false);
  }

  return (
    <div className="space-y-4">
      {isOwner ? (
        <Link href="/account/bookings" className="inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-foreground">
          <ArrowLeft className="size-4" />
          My Bookings
        </Link>
      ) : (
        <Link href="/" className="inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-foreground">
          <ArrowLeft className="size-4" />
          All predictions
        </Link>
      )}

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          {renaming ? (
            <div className="flex items-center gap-2">
              <input
                value={titleDraft}
                onChange={(e) => setTitleDraft(e.target.value)}
                autoFocus
                className="h-9 rounded-md border border-border/60 bg-background px-2 text-xl font-bold tracking-tight outline-none"
              />
              <button
                type="button"
                onClick={handleRename}
                className="h-8 rounded-md bg-primary px-3 text-xs font-medium text-primary-foreground hover:bg-primary/90"
              >
                Save
              </button>
              <button
                type="button"
                onClick={() => {
                  setRenaming(false);
                  setTitleDraft(title);
                }}
                className="h-8 rounded-md border border-border/60 px-3 text-xs font-medium hover:bg-muted"
              >
                Cancel
              </button>
            </div>
          ) : (
            <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
          )}
          <p className="text-sm text-muted-foreground">by {ownerLabel}</p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {isOwner && !renaming && (
            <>
              <button
                type="button"
                onClick={() => setRenaming(true)}
                className="h-8 rounded-md border border-border/60 px-3 text-xs font-medium hover:bg-muted"
              >
                Rename
              </button>
              <button
                type="button"
                onClick={handleDelete}
                className="h-8 rounded-md border border-destructive/40 px-3 text-xs font-medium text-destructive hover:bg-destructive/10"
              >
                Delete
              </button>
            </>
          )}
          <div className="rounded-md border border-border/60 bg-muted/40 px-2.5 py-1">
            <ShareButtons url={shareUrl} title={`${title} — a SoccerRadar booking by ${ownerLabel}`} />
          </div>
        </div>
      </div>

      {items.length === 0 ? (
        <div className="py-16 text-center text-sm text-muted-foreground">No picks in this booking.</div>
      ) : (
        <div className="divide-y divide-border/60 rounded-md border border-border/60">
          {items.map(({ prediction, marketKey }) => (
            <div key={`${prediction.id}-${marketKey}`} className="flex items-center justify-between gap-2 px-3 py-2.5">
              <Link href={`/match/${prediction.id}`} className="min-w-0 flex-1">
                <div className="truncate text-sm font-medium hover:text-primary hover:underline">
                  {prediction.home_team} <span className="font-normal text-muted-foreground">vs</span> {prediction.away_team}
                </div>
                <div className="text-xs text-muted-foreground">
                  {leagueById.get(prediction.league_id)?.name ?? ""} · {MARKET_LABELS[marketKey]}:{" "}
                  <span className="font-medium text-foreground">{marketPredictionLabel(prediction.markets, marketKey)}</span>
                </div>
              </Link>
              {isOwner && (
                <button
                  type="button"
                  onClick={() => handleRemove(prediction.id, marketKey)}
                  aria-label="Remove this pick"
                  className="inline-flex size-7 shrink-0 items-center justify-center rounded-full border border-border/60 hover:bg-muted"
                >
                  <X className="size-3.5" />
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
