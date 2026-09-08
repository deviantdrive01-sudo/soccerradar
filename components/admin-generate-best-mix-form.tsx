"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { generateBestMixAction } from "@/app/admin/(authed)/mixes/actions";

const FIELD = "h-8 w-full rounded-md border border-border/60 bg-background px-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50";
const LABEL = "mb-1 block text-xs font-medium text-muted-foreground";

export interface LeagueOption {
  id: number;
  label: string;
}

export function AdminGenerateBestMixForm({ leagues }: { leagues: LeagueOption[] }) {
  const [numberOfGames, setNumberOfGames] = useState(7);
  const [minConfidence, setMinConfidence] = useState(68);
  const [title, setTitle] = useState("");
  const [selectedLeagueIds, setSelectedLeagueIds] = useState<number[]>([]);
  const [pending, setPending] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const router = useRouter();

  function toggleLeague(id: number) {
    setSelectedLeagueIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setPending(true);
    setResult(null);
    try {
      const outcome = await generateBestMixAction({
        minConfidence,
        picksPerBooking: numberOfGames,
        title: title.trim() || undefined,
        leagueIds: selectedLeagueIds.length > 0 ? selectedLeagueIds : undefined,
      });
      if ("error" in outcome) {
        setResult(outcome.error);
      } else {
        const booking = outcome.bookings[0];
        setResult(
          booking
            ? `Created: ${booking.title} (${booking.pickCount} pick${booking.pickCount === 1 ? "" : "s"}, ${outcome.totalQualifyingMatches} qualified)`
            : "No mix created.",
        );
        router.refresh();
      }
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div>
          <label className={LABEL}>Number of games</label>
          <input
            type="number"
            min={1}
            max={20}
            value={numberOfGames}
            onChange={(e) => setNumberOfGames(Number(e.target.value))}
            className={FIELD}
          />
        </div>
        <div>
          <label className={LABEL}>Minimum confidence %</label>
          <input
            type="number"
            min={1}
            max={100}
            value={minConfidence}
            onChange={(e) => setMinConfidence(Number(e.target.value))}
            className={FIELD}
          />
        </div>
      </div>

      <div>
        <label className={LABEL}>Title (optional — auto-generated if left blank)</label>
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Best Mix · today's date"
          className={FIELD}
        />
      </div>

      <div>
        <label className={LABEL}>Preferred leagues (optional — leave empty for all)</label>
        <div className="mt-1 max-h-40 space-y-1 overflow-y-auto rounded-md border border-border/60 p-2">
          {leagues.map((league) => (
            <label key={league.id} className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={selectedLeagueIds.includes(league.id)}
                onChange={() => toggleLeague(league.id)}
                className="size-3.5"
              />
              {league.label}
            </label>
          ))}
          {leagues.length === 0 && <p className="text-sm text-muted-foreground">No leagues available.</p>}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="submit"
          disabled={pending}
          className="h-9 shrink-0 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-60"
        >
          {pending ? "Generating…" : "Generate"}
        </button>
        {result && <p className="text-sm text-muted-foreground">{result}</p>}
      </div>
    </form>
  );
}
