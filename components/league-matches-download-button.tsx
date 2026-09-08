"use client";

import { Download } from "lucide-react";
import { withViewerTimeZone } from "@/lib/viewer-timezone";

const ICON_BUTTON = "inline-flex size-6 shrink-0 items-center justify-center rounded-md border border-border/60 hover:bg-muted/60";

/** Downloads a "Matchday" fixture-list graphic for exactly the matches in this league group — appears right after the league header, both in table view and cards view. */
export function LeagueMatchesDownloadButton({ predictionIds }: { predictionIds: number[] }) {
  if (predictionIds.length === 0) return null;

  const imageUrl = withViewerTimeZone(`/api/league-matches-image?ids=${predictionIds.join(",")}`);

  return (
    <a href={imageUrl} download aria-label="Download this league's matches" className={ICON_BUTTON}>
      <Download className="size-3.5" />
    </a>
  );
}
