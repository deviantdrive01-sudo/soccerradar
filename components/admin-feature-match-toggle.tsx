"use client";

import { useState, useTransition } from "react";
import { toggleFeaturedMatch } from "@/app/admin/(authed)/matches/actions";
import { cn } from "@/lib/utils";

export function AdminFeatureMatchToggle({ predictionId, initialFeatured }: { predictionId: number; initialFeatured: boolean }) {
  const [featured, setFeatured] = useState(initialFeatured);
  const [pending, startTransition] = useTransition();

  function handleClick() {
    const next = !featured;
    setFeatured(next); // optimistic — toggleFeaturedMatch is a simple boolean flip, safe to assume it lands
    startTransition(async () => {
      await toggleFeaturedMatch(predictionId, next);
    });
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={pending}
      className={cn(
        "shrink-0 rounded-full border px-2.5 py-1 text-xs font-medium transition-colors disabled:opacity-60",
        featured ? "border-primary/40 bg-primary/15 text-primary" : "border-border/60 text-muted-foreground hover:bg-muted/60",
      )}
    >
      {featured ? "★ Featured" : "Feature"}
    </button>
  );
}
