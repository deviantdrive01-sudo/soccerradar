"use client";

import { Star } from "lucide-react";
import { useAccount } from "@/components/account-provider";
import { cn } from "cn";

type FavoriteTarget =
  | { type: "country"; country: string }
  | { type: "league"; leagueId: number }
  | { type: "match"; predictionId: number };

export function FavoriteButton({ target, className }: { target: FavoriteTarget; className?: string }) {
  const { favoriteCountries, favoriteLeagueIds, favoriteMatchIds, toggleCountry, toggleLeague, toggleMatch } =
    useAccount();

  const favorited =
    target.type === "country"
      ? favoriteCountries.has(target.country)
      : target.type === "league"
        ? favoriteLeagueIds.has(target.leagueId)
        : favoriteMatchIds.has(target.predictionId);

  function handleClick(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    if (target.type === "country") toggleCountry(target.country);
    else if (target.type === "league") toggleLeague(target.leagueId);
    else toggleMatch(target.predictionId);
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      aria-label={favorited ? "Remove favorite" : "Add favorite"}
      aria-pressed={favorited}
      className={cn("inline-flex shrink-0 items-center justify-center rounded p-1 hover:bg-muted", className)}
    >
      <Star className={cn("size-3.5", favorited ? "fill-amber-400 text-amber-400" : "text-muted-foreground")} />
    </button>
  );
}
