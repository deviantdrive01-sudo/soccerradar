"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, X } from "lucide-react";
import { useAccount } from "@/components/account-provider";
import { Button } from "@/components/ui/button";
import { MatchCard } from "@/components/match-card";
import { PredictionsTable } from "@/components/predictions-table";
import { ShareButtons } from "@/components/share-buttons";
import { renameCollection, deleteCollection, toggleCollectionItem } from "@/app/account/collections/actions";
import { cn } from "cn";
import type { Prediction } from "@/lib/supabase/types";

type ViewMode = "cards" | "table";

export function CollectionManage({
  collectionId,
  ownerId,
  ownerLabel,
  initialTitle,
  predictions,
  leagueById,
  shareUrl,
}: {
  collectionId: number;
  ownerId: string;
  ownerLabel: string;
  initialTitle: string;
  predictions: Prediction[];
  leagueById: Map<number, { name: string }>;
  shareUrl: string;
}) {
  const { user } = useAccount();
  const router = useRouter();
  const isOwner = user?.userId === ownerId;

  const [viewModeOverride, setViewModeOverride] = useState<ViewMode | null>(null);
  const viewMode = viewModeOverride ?? "table";

  const [items, setItems] = useState(predictions);
  const [title, setTitle] = useState(initialTitle);
  const [renaming, setRenaming] = useState(false);
  const [titleDraft, setTitleDraft] = useState(initialTitle);

  async function handleRemove(predictionId: number) {
    setItems((prev) => prev.filter((p) => p.id !== predictionId));
    try {
      await toggleCollectionItem(collectionId, predictionId);
    } catch {
      // Best effort — a page refresh will reconcile if this failed silently.
    }
  }

  async function handleDelete() {
    if (!confirm("Delete this collection? This can't be undone.")) return;
    await deleteCollection(collectionId);
    router.push("/account/collections");
  }

  async function handleRename() {
    if (!titleDraft.trim()) return;
    await renameCollection(collectionId, titleDraft);
    setTitle(titleDraft.trim());
    setRenaming(false);
  }

  return (
    <div className="space-y-4">
      {isOwner ? (
        <Link href="/account/collections" className="inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-foreground">
          <ArrowLeft className="size-4" />
          My Collections
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

          <div className="inline-flex rounded-md border border-border/60 p-0.5">
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={() => setViewModeOverride("cards")}
              className={cn("h-7 px-3", viewMode === "cards" && "bg-primary text-primary-foreground hover:bg-primary/90 hover:text-primary-foreground")}
            >
              Cards
            </Button>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={() => setViewModeOverride("table")}
              className={cn("h-7 px-3", viewMode === "table" && "bg-primary text-primary-foreground hover:bg-primary/90 hover:text-primary-foreground")}
            >
              Table
            </Button>
          </div>

          <div className="rounded-md border border-border/60 bg-muted/40 px-2.5 py-1">
            <ShareButtons url={shareUrl} title={`${title} — a SoccerRadar bookmark collection by ${ownerLabel}`} />
          </div>
        </div>
      </div>

      {items.length === 0 ? (
        <div className="py-16 text-center text-sm text-muted-foreground">No matches in this collection.</div>
      ) : viewMode === "table" ? (
        <PredictionsTable
          predictions={items}
          leagueById={leagueById}
          marketFilter="all"
          showInFeedAds={false}
          rowAction={
            isOwner
              ? (prediction) => (
                  <button
                    type="button"
                    onClick={() => handleRemove(prediction.id)}
                    aria-label="Remove from collection"
                    className="inline-flex size-6 items-center justify-center rounded-full border border-border/60 hover:bg-muted"
                  >
                    <X className="size-3.5" />
                  </button>
                )
              : undefined
          }
        />
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((prediction) => (
            <div key={prediction.id} className="relative">
              <MatchCard
                prediction={prediction}
                leagueName={leagueById.get(prediction.league_id)?.name ?? ""}
                marketFilter="all"
              />
              {isOwner && (
                <button
                  type="button"
                  onClick={() => handleRemove(prediction.id)}
                  aria-label="Remove from collection"
                  className="absolute right-2 top-2 z-10 flex size-6 items-center justify-center rounded-full bg-background/90 text-foreground shadow-sm backdrop-blur hover:bg-background"
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
