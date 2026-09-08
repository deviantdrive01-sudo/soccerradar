"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { generateBestMixAction } from "@/app/admin/(authed)/bookings/actions";

export function AdminGenerateBestMixButton() {
  const [pending, setPending] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const router = useRouter();

  async function handleClick() {
    setPending(true);
    setResult(null);
    try {
      const outcome = await generateBestMixAction();
      if ("error" in outcome) {
        setResult(outcome.error);
      } else {
        const titles = outcome.bookings.map((b) => `${b.title} (${b.pickCount} picks)`).join(", ");
        setResult(outcome.bookings.length > 0 ? `Created: ${titles}` : "No bookings created.");
        router.refresh();
      }
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-3">
      <button
        type="button"
        onClick={handleClick}
        disabled={pending}
        className="h-9 shrink-0 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-60"
      >
        {pending ? "Generating…" : "Generate Best Mix"}
      </button>
      {result && <p className="text-sm text-muted-foreground">{result}</p>}
    </div>
  );
}
