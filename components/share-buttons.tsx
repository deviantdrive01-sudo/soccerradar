"use client";

import { useState } from "react";
import { Check, Download, Link2 } from "lucide-react";

function openShareWindow(url: string) {
  window.open(url, "_blank", "noopener,noreferrer,width=600,height=500");
}

function XIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" {...props}>
      <path d="M18.901 1.153h3.68l-8.04 9.19L24 22.846h-7.406l-5.8-7.584-6.638 7.584H.474l8.6-9.83L0 1.154h7.594l5.243 6.932ZM17.61 20.644h2.039L6.486 3.24H4.298Z" />
    </svg>
  );
}

function FacebookIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" {...props}>
      <path d="M9.101 23.691V15.951H6.627V13.09h2.474V10.5c0-2.492 1.514-3.83 3.883-3.83c1.107 0 2.056.083 2.335.117v2.706l-1.6.001c-1.254 0-1.499.6-1.499 1.478v1.99h2.995l-.394 2.86h-2.601v7.741z" />
    </svg>
  );
}

export function TelegramIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" {...props}>
      <path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.831-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z" />
    </svg>
  );
}

const ICON_BUTTON = "inline-flex size-7 shrink-0 items-center justify-center rounded-md border border-border/60 hover:bg-muted/60";

export function ShareButtons({ url, title, imageUrl }: { url: string; title: string; imageUrl?: string }) {
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

  function handleShareTelegram() {
    openShareWindow(`https://t.me/share/url?url=${encodeURIComponent(url)}&text=${encodeURIComponent(title)}`);
  }

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <span className="text-xs font-medium text-muted-foreground">Share:</span>
      <button type="button" onClick={handleShareX} aria-label="Share on X" className={ICON_BUTTON}>
        <XIcon className="size-3.5" />
      </button>
      <button type="button" onClick={handleShareFacebook} aria-label="Share on Facebook" className={ICON_BUTTON}>
        <FacebookIcon className="size-3.5" />
      </button>
      <button type="button" onClick={handleShareTelegram} aria-label="Share on Telegram" className={ICON_BUTTON}>
        <TelegramIcon className="size-3.5" />
      </button>
      <button type="button" onClick={handleCopyLink} aria-label={copied ? "Link copied" : "Copy link"} className={ICON_BUTTON}>
        {copied ? <Check className="size-3.5 text-emerald-500" /> : <Link2 className="size-3.5" />}
      </button>
      {imageUrl && (
        <a href={imageUrl} download aria-label="Download image" className={ICON_BUTTON}>
          <Download className="size-3.5" />
        </a>
      )}
    </div>
  );
}
