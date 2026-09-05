import { Flame, ListChecks, Percent, Trophy } from "lucide-react";
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
  const avgConfidence = matchCount
    ? Math.round(predictions.reduce((sum, p) => sum + p.confidence, 0) / matchCount)
    : 0;
  const highConfidenceCount = predictions.filter((p) => p.confidence >= 70).length;

  return (
    <div className="flex flex-wrap items-center gap-x-5 gap-y-1 text-xs text-muted-foreground">
      <Stat icon={ListChecks} label="matches" value={String(matchCount)} />
      <Stat icon={Trophy} label="leagues" value={String(leagueCount)} />
      <Stat icon={Percent} label="avg. confidence" value={`${avgConfidence}%`} />
      <Stat icon={Flame} label="high-confidence picks" value={String(highConfidenceCount)} />
    </div>
  );
}
