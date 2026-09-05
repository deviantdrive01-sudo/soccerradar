import { Badge } from "@/components/ui/badge";
import { summarizeSettledMarkets, type ActualMarkets, type HydratedMarkets } from "@/lib/hydrate";

/**
 * Renders one badge per tracked market for a settled match, showing both
 * what was predicted and whether it landed — e.g. "FT Draw: No ✓" rather than
 * a bare "FT Draw ✓", which reads as "there was a draw" when it actually
 * means "we correctly called no draw".
 */
export function SettledMarketBadges({ predicted, actual }: { predicted: HydratedMarkets; actual: ActualMarkets }) {
  const results = summarizeSettledMarkets(predicted, actual);

  return (
    <div className="flex flex-wrap gap-1.5">
      {results.map((r) => (
        <Badge
          key={r.key}
          variant="outline"
          className={
            r.correct === null
              ? "text-muted-foreground"
              : r.correct
                ? "border-emerald-500/30 text-emerald-400"
                : "border-red-500/30 text-red-400"
          }
        >
          {r.label}: {r.value} {r.correct === null ? "–" : r.correct ? "✓" : "✗"}
        </Badge>
      ))}
    </div>
  );
}
