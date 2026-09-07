"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { X, CheckCircle2, XCircle } from "lucide-react";
import { BackLink } from "@/components/back-link";
import { useAccount } from "@/components/account-provider";
import { ShareButtons } from "@/components/share-buttons";
import { renameBooking, deleteBooking, toggleBookingItem, setBookingVisibility } from "@/app/account/bookings/actions";
import { marketPredictionLabel, marketPredictionValue, marketValueLabel, MARKET_LABELS } from "@/lib/hydrate";
import { gradePicks, tallyGraded } from "@/lib/booking-grading";
import { accuracyPct, pctClass } from "@/lib/accuracy";
import { cn } from "@/lib/utils";
import type { HydratedMarkets, MarketKey } from "@/lib/hydrate";
import type { Prediction } from "@/lib/supabase/types";

export interface BookingPick {
  // A booking can only ever reference an already-predicted match (there's no
  // pick-a-market UI for a pending fixture), so this is narrower than the
  // base Prediction type — see isPredicted() in lib/supabase/types.ts.
  prediction: Prediction & { markets: HydratedMarkets; confidence: number; summary: string };
  marketKey: MarketKey;
  /** The user's own call for this market, when it diverges from SoccerRadar's prediction. */
  userValue?: string | null;
}

export function BookingManage({
  bookingId,
  ownerId,
  ownerLabel,
  initialTitle,
  initialIsPublic,
  picks,
  leagueById,
  shareUrl,
}: {
  bookingId: number;
  ownerId: string;
  ownerLabel: string;
  initialTitle: string;
  initialIsPublic: boolean;
  picks: BookingPick[];
  leagueById: Map<number, { name: string; country: string }>;
  shareUrl: string;
}) {
  const { user } = useAccount();
  const router = useRouter();
  const isOwner = user?.userId === ownerId;

  const [items, setItems] = useState(picks);
  const [title, setTitle] = useState(initialTitle);
  const [renaming, setRenaming] = useState(false);
  const [titleDraft, setTitleDraft] = useState(initialTitle);
  const [isPublic, setIsPublic] = useState(initialIsPublic);
  const [visibilityPending, setVisibilityPending] = useState(false);

  const graded = gradePicks(items);
  const { settled, correct } = tallyGraded(graded);
  const gradedByKey = new Map(graded.map((g) => [`${g.prediction.id}-${g.marketKey}`, g.correct]));

  async function handleToggleVisibility() {
    const next = !isPublic;
    setIsPublic(next);
    setVisibilityPending(true);
    try {
      await setBookingVisibility(bookingId, next);
    } catch {
      setIsPublic(!next);
    } finally {
      setVisibilityPending(false);
    }
  }

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
        <BackLink fallbackHref="/account/bookings" fallbackLabel="My Bookings" />
      ) : (
        <BackLink fallbackHref="/" fallbackLabel="All predictions" />
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
          {settled > 0 && (
            <p className={cn("mt-1 text-sm font-medium", pctClass(accuracyPct(correct, settled), settled))}>
              {correct}/{settled} settled · {accuracyPct(correct, settled)}% win rate
            </p>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {isOwner && (
            <button
              type="button"
              onClick={handleToggleVisibility}
              disabled={visibilityPending}
              className={cn(
                "h-8 rounded-md px-3 text-xs font-medium disabled:opacity-60",
                isPublic
                  ? "bg-primary/15 text-primary hover:bg-primary/25"
                  : "border border-border/60 hover:bg-muted",
              )}
              title={isPublic ? "Listed on Top Bookings — click to make private" : "Not listed on Top Bookings — click to publish"}
            >
              {isPublic ? "Make Private" : "Publish to Public"}
            </button>
          )}
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
            <ShareButtons
              url={shareUrl}
              title={`${title} — a SoccerRadar booking by ${ownerLabel}`}
              imageUrl={`${shareUrl}/opengraph-image`}
            />
          </div>
        </div>
      </div>

      {items.length === 0 ? (
        <div className="py-16 text-center text-sm text-muted-foreground">No picks in this booking.</div>
      ) : (
        <div className="divide-y divide-border/60 rounded-md border border-border/60">
          {items.map(({ prediction, marketKey, userValue }) => {
            const correctness = gradedByKey.get(`${prediction.id}-${marketKey}`) ?? null;
            const kickoff = new Date(prediction.match_date);
            const league = leagueById.get(prediction.league_id);
            const leagueLabel = league ? `${league.country} · ${league.name}` : "";
            const pickLabel = userValue ? marketValueLabel(marketKey, userValue) : marketPredictionLabel(prediction.markets, marketKey);
            const isOverride = !!userValue && userValue !== marketPredictionValue(prediction.markets, marketKey);
            return (
              <div key={`${prediction.id}-${marketKey}`} className="flex items-center justify-between gap-2 px-3 py-2.5">
                {correctness === true && <CheckCircle2 className="size-4 shrink-0 text-emerald-400" aria-label="Correct" />}
                {correctness === false && <XCircle className="size-4 shrink-0 text-red-400" aria-label="Incorrect" />}
                <Link href={`/match/${prediction.id}`} className="min-w-0 flex-1">
                  <div className="truncate text-sm font-medium hover:text-primary hover:underline">
                    {prediction.home_team} <span className="font-normal text-muted-foreground">vs</span> {prediction.away_team}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {leagueLabel} ·{" "}
                    {kickoff.toLocaleDateString("en-GB", { weekday: "short", month: "short", day: "numeric", timeZone: "UTC" })}
                    {", "}
                    {kickoff.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", timeZone: "UTC" })}
                    {" · "}
                    {MARKET_LABELS[marketKey]}:{" "}
                    <span className="font-medium text-foreground">{pickLabel}</span>
                    {isOverride && (
                      <span className="ml-1.5 text-amber-500">
                        (vs SoccerRadar: {marketPredictionLabel(prediction.markets, marketKey)})
                      </span>
                    )}
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
            );
          })}
        </div>
      )}
    </div>
  );
}
