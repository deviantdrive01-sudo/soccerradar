"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { generateLinkCode, unlinkTelegram } from "@/app/account/telegram/actions";

export function TelegramLinkPanel({ isLinked, botUsername }: { isLinked: boolean; botUsername: string | null }) {
  const [code, setCode] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const router = useRouter();

  async function handleGenerate() {
    setPending(true);
    setError(null);
    try {
      const result = await generateLinkCode();
      if (result.error) setError(result.error);
      else setCode(result.code ?? null);
    } finally {
      setPending(false);
    }
  }

  async function handleUnlink() {
    setPending(true);
    try {
      await unlinkTelegram();
      setCode(null);
      router.refresh();
    } finally {
      setPending(false);
    }
  }

  if (isLinked) {
    return (
      <div className="flex items-center justify-between rounded-md border border-border/60 p-4">
        <div>
          <div className="text-sm font-medium text-primary">Linked ✓</div>
          <div className="text-xs text-muted-foreground">Your Telegram account is connected.</div>
        </div>
        <button
          type="button"
          onClick={handleUnlink}
          disabled={pending}
          className="h-9 shrink-0 rounded-md border border-border/60 px-3 text-sm font-medium hover:bg-muted/60 disabled:opacity-60"
        >
          {pending ? "…" : "Unlink"}
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3 rounded-md border border-border/60 p-4">
      {!code ? (
        <>
          <p className="text-sm text-muted-foreground">Not linked yet.</p>
          <button
            type="button"
            onClick={handleGenerate}
            disabled={pending}
            className="h-9 w-fit rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-60"
          >
            {pending ? "Generating…" : "Get linking code"}
          </button>
          {error && <p className="text-xs text-destructive">{error}</p>}
        </>
      ) : (
        <>
          <div>
            <div className="text-xs text-muted-foreground">Your code (expires in 15 minutes):</div>
            <div className="text-2xl font-bold tracking-widest">{code}</div>
          </div>
          {botUsername ? (
            <a
              href={`https://t.me/${botUsername}?start=${code}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex h-9 w-fit items-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/90"
            >
              Open in Telegram
            </a>
          ) : (
            <p className="text-sm text-muted-foreground">
              Send <code className="rounded bg-muted px-1 py-0.5">/link {code}</code> to the SoccerRadar bot on Telegram.
            </p>
          )}
        </>
      )}
    </div>
  );
}
