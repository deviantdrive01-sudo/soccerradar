import { Flame, ListChecks, Percent, Trophy } from "lucide-react";
import { isPredicted } from "@/lib/supabase/types";
import type { Prediction } from "@/lib/supabase/types";

function Stat({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
}) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <Icon className="size-3.5 text-primary" />
      <span className="font-semibold text-foreground">{value}</span>
      {label}
    </span>
  );
}

export function StatsSummary({ predictions }: { predictions: Prediction[] }) {
  const matchCount = predictions.length;
  const leagueCount = new Set(predictions.map((p) => p.league_id)).size;
  // Confidence only exists once a prediction has been generated — pending
  // fixtures (crawled, not yet predicted) don't count toward these two.
  const predicted = predictions.filter(isPredicted);
  const avgConfidence = predicted.length
    ? Math.round(predicted.reduce((sum, p) => sum + p.confidence, 0) / predicted.length)
    : 0;
  const highConfidenceCount = predicted.filter((p) => p.confidence >= 70).length;

  return (
    <div className="flex flex-wrap items-center gap-x-5 gap-y-1 text-xs text-muted-foreground">
      <Stat icon={ListChecks} label="matches" value={String(matchCount)} />
      <Stat icon={Trophy} label="leagues" value={String(leagueCount)} />
      <Stat icon={Percent} label="avg. confidence" value={`${avgConfidence}%`} />
      <Stat icon={Flame} label="high-confidence picks" value={String(highConfidenceCount)} />
    </div>
  );
}
