"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { triggerBroadcastAction } from "@/app/admin/(authed)/telegram/actions";
import type { ScheduledBroadcastType } from "@/lib/telegram-broadcasts";

export function AdminTelegramTriggerButton({ type }: { type: ScheduledBroadcastType }) {
  const [pending, setPending] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const router = useRouter();

  async function handleClick() {
    setPending(true);
    setResult(null);
    try {
      const outcome = await triggerBroadcastAction(type);
      setResult(outcome.reason ?? (outcome.posted > 0 ? `Posted (${outcome.posted})` : "Posted"));
      router.refresh();
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        type="button"
        onClick={handleClick}
        disabled={pending}
        className="h-7 shrink-0 rounded-md border border-border/60 px-2.5 text-xs font-medium hover:bg-muted/60 disabled:opacity-60"
      >
        {pending ? "Sending…" : "Send now"}
      </button>
      {result && <span className="max-w-48 text-right text-[11px] text-muted-foreground">{result}</span>}
    </div>
  );
}
