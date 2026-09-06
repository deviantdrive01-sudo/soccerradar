"use client";

import { useState } from "react";
import { Check, Link2 } from "lucide-react";

function openShareWindow(url: string) {
  window.open(url, "_blank", "noopener,noreferrer,width=600,height=500");
}

export function ShareButtons({ url, title }: { url: string; title: string }) {
  const [copied, setCopied] = useState(false);

  async function handleCopyLink() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard API unavailable (e.g. insecure context) — nothing more we can do.
    }
  }

  function handleShareX() {
    openShareWindow(`https://twitter.com/intent/tweet?text=${encodeURIComponent(title)}&url=${encodeURIComponent(url)}`);
  }

  function handleShareFacebook() {
    openShareWindow(`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`);
  }

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <span className="text-xs font-medium text-muted-foreground">Share:</span>
      <button
        type="button"
        onClick={handleShareX}
        className="h-7 rounded-md border border-border/60 px-2.5 text-xs font-medium hover:bg-muted/60"
      >
        X
      </button>
      <button
        type="button"
        onClick={handleShareFacebook}
        className="h-7 rounded-md border border-border/60 px-2.5 text-xs font-medium hover:bg-muted/60"
      >
        Facebook
      </button>
      <button
        type="button"
        onClick={handleCopyLink}
        className="inline-flex h-7 items-center gap-1 rounded-md border border-border/60 px-2.5 text-xs font-medium hover:bg-muted/60"
      >
        {copied ? <Check className="size-3.5 text-emerald-500" /> : <Link2 className="size-3.5" />}
        {copied ? "Copied!" : "Copy link"}
      </button>
    </div>
  );
}
