"use client";

import { Download } from "lucide-react";
import { withViewerTimeZone } from "@/lib/viewer-timezone";

/** Downloads the "every market clearing 50% for this match" graphic. */
export function MatchBestPicksDownloadButton({ predictionId }: { predictionId: number }) {
  const imageUrl = withViewerTimeZone(`/match/${predictionId}/best-picks-image`);

  return (
    <a
      href={imageUrl}
      download
      className="inline-flex h-8 items-center gap-1.5 rounded-md bg-primary px-3 text-xs font-medium text-primary-foreground hover:bg-primary/90"
    >
      <Download className="size-3.5" />
      Download
    </a>
  );
}
