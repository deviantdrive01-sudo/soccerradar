import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { BackLink } from "@/components/back-link";
import { createSupabaseReadClient } from "@/lib/supabase/client";
import { Badge } from "@/components/ui/badge";
import { AdSlot } from "@/components/ad-slot";
import { ShareButtons } from "@/components/share-buttons";
import { FavoriteButton } from "@/components/favorite-button";
import { CollectionPickerButton } from "@/components/collection-picker-button";
import { BookingPickButton } from "@/components/booking-pick-button";
import { SettledMarketBadges } from "@/components/settled-market-badges";
import { isDrawOrOver2_5, isFullTimeDraw, settledMarketTally, summarizeSettledMarkets, winEitherHalfCode } from "@/lib/hydrate";
import { SITE_URL } from "@/lib/site";
import { isPredicted } from "@/lib/supabase/types";
import type { MarketKey, HydratedMarkets } from "@/lib/hydrate";
import type { Prediction, League } from "@/lib/supabase/types";

export const revalidate = 300;

async function getMatchData(id: number): Promise<{ prediction: Prediction; league: League | null } | null> {
  const supabase = createSupabaseReadClient();
  const { data: prediction } = await supabase.from("predictions").select("*").eq("id", id).maybeSingle();
  if (!prediction) return null;
  const { data: league } = await supabase.from("leagues").select("*").eq("id", prediction.league_id).maybeSingle();
  return { prediction, league: league ?? null };
}

export async function generateMetadata({ params }: PageProps<"/match/[id]">): Promise<Metadata> {
  const { id } = await params;
  const numericId = Number(id);
  if (!Number.isInteger(numericId)) return { title: "Match not found" };

  const data = await getMatchData(numericId);
  if (!data) return { title: "Match not found" };

  const { prediction, league } = data;
  const title = `${prediction.home_team} vs ${prediction.away_team} Prediction${league ? ` — ${league.name}` : ""}`;
  const description = prediction.summary || `AI-generated prediction for ${prediction.home_team} vs ${prediction.away_team}.`;
  const url = `${SITE_URL}/match/${prediction.id}`;

  return {
    title,
    description,
    alternates: { canonical: url },
    openGraph: { title, description, url, type: "article" },
    twitter: { card: "summary", title, description },
  };
}

function confidenceClass(confidence: number): string {
  if (confidence >= 70) return "bg-primary/15 text-primary border-primary/30";
  if (confidence >= 50) return "bg-amber-500/15 text-amber-400 border-amber-500/30";
  return "bg-red-500/15 text-red-400 border-red-500/30";
}

function YesNoBadge({
  label,
  value,
  predictionId,
  marketKey,
  markets,
}: {
  label: string;
  value: boolean;
  predictionId: number;
  marketKey: MarketKey;
  markets: HydratedMarkets;
}) {
  return (
    <span className="inline-flex items-center gap-1">
      <Badge variant="outline" className={value ? "border-primary/30 text-primary" : "text-muted-foreground"}>
        {label} {value ? "✓" : "✗"}
      </Badge>
      <BookingPickButton predictionId={predictionId} marketKey={marketKey} markets={markets} />
    </span>
  );
}

export default async function MatchPage({ params }: PageProps<"/match/[id]">) {
  const { id } = await params;
  const numericId = Number(id);
  if (!Number.isInteger(numericId)) notFound();

  const data = await getMatchData(numericId);
  if (!data) notFound();
  const { prediction, league } = data;

  const kickoff = new Date(prediction.match_date);

  if (!isPredicted(prediction)) {
    return (
      <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-6 px-4 py-6">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <BackLink fallbackHref="/" fallbackLabel="All predictions" />
          <div className="flex items-center gap-2">
            <FavoriteButton
              target={{ type: "match", predictionId: prediction.id }}
              className="rounded-md border border-border/60"
            />
            <CollectionPickerButton predictionId={prediction.id} />
            <ShareButtons
              url={`${SITE_URL}/match/${prediction.id}`}
              title={`${prediction.home_team} vs ${prediction.away_team} prediction — SoccerRadar`}
            />
          </div>
        </div>

        <div className="space-y-3 rounded-lg border border-border/60 bg-muted/60 p-5">
          <div className="flex flex-wrap items-center justify-between gap-2 text-sm font-medium text-foreground/80">
            <span>{league ? `${league.country} · ${league.name}` : "Unknown league"}</span>
            <span>
              {kickoff.toLocaleDateString("en-GB", { weekday: "short", month: "short", day: "numeric", timeZone: "UTC" })}
              {" · "}
              {kickoff.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", timeZone: "UTC" })}
            </span>
          </div>

          <div className="flex flex-wrap items-start justify-between gap-2">
            <h1 className="min-w-0 text-2xl font-bold leading-tight">
              {prediction.home_team}
              <span className="mx-2 text-muted-foreground font-medium">vs</span>
              {prediction.away_team}
            </h1>
            <Badge variant="outline" className="text-muted-foreground">
              Prediction pending
            </Badge>
          </div>

          <p className="text-sm text-muted-foreground">
            We&apos;ve spotted this fixture — the AI prediction is being generated and will appear here shortly.
          </p>
        </div>

        <AdSlot orientation="horizontal" />
      </main>
    );
  }

  const markets = prediction.markets;
  const winEitherHalf = winEitherHalfCode(markets);
  const actual = prediction.actual_result;
  const settled = actual
    ? { results: summarizeSettledMarkets(markets, actual.markets), tally: settledMarketTally(summarizeSettledMarkets(markets, actual.markets)) }
    : null;

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-6 px-4 py-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <BackLink fallbackHref="/" fallbackLabel="All predictions" />
        <div className="flex items-center gap-2">
          <FavoriteButton
            target={{ type: "match", predictionId: prediction.id }}
            className="rounded-md border border-border/60"
          />
          <CollectionPickerButton predictionId={prediction.id} />
          <ShareButtons
            url={`${SITE_URL}/match/${prediction.id}`}
            title={`${prediction.home_team} vs ${prediction.away_team} prediction — SoccerRadar`}
          />
        </div>
      </div>

      <div className="space-y-3 rounded-lg border border-border/60 bg-muted/60 p-5">
        <div className="flex flex-wrap items-center justify-between gap-2 text-sm font-medium text-foreground/80">
          <span>{league ? `${league.country} · ${league.name}` : "Unknown league"}</span>
          <span>
            {kickoff.toLocaleDateString("en-GB", { weekday: "short", month: "short", day: "numeric", timeZone: "UTC" })}
            {" · "}
            {kickoff.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", timeZone: "UTC" })}
          </span>
        </div>

        <div className="flex flex-wrap items-start justify-between gap-2">
          <h1 className="min-w-0 text-2xl font-bold leading-tight">
            {prediction.home_team}
            <span className="mx-2 text-muted-foreground font-medium">vs</span>
            {prediction.away_team}
          </h1>
          <Badge variant="outline" className={confidenceClass(prediction.confidence)}>
            {prediction.confidence}% confidence
          </Badge>
        </div>

        {settled && actual && (
          <div className="space-y-2 rounded-lg border border-border/60 bg-background/60 p-3">
            <div className="flex items-center justify-between">
              <div className="text-sm font-semibold">
                Final {actual.raw.finalScore.home}–{actual.raw.finalScore.away}
              </div>
              {settled.tally.known > 0 && (
                <Badge
                  variant="outline"
                  className={
                    settled.tally.correct / settled.tally.known >= 0.5
                      ? "border-emerald-500/30 text-emerald-400"
                      : "border-red-500/30 text-red-400"
                  }
                >
                  {settled.tally.correct}/{settled.tally.known} correct
                </Badge>
              )}
            </div>
            <SettledMarketBadges predicted={markets} actual={actual.markets} />
          </div>
        )}

        <div className="space-y-1.5">
          <div className="text-[11px] font-medium uppercase tracking-wide text-foreground/70">Outcome</div>
          <div className="flex flex-wrap gap-1.5">
            <YesNoBadge label="FT Draw" value={isFullTimeDraw(markets)} predictionId={prediction.id} marketKey="fullTimeDraw" markets={markets} />
            <span className="inline-flex items-center gap-1">
              <Badge variant="secondary" className="font-medium">
                1H: {markets.firstHalfOutcome.label}
              </Badge>
              <BookingPickButton predictionId={prediction.id} marketKey="firstHalfOutcome" markets={markets} />
            </span>
            <span className="inline-flex items-center gap-1">
              <Badge variant="secondary" className="font-medium">
                {markets.highestScoringHalf.label}
              </Badge>
              <BookingPickButton predictionId={prediction.id} marketKey="highestScoringHalf" markets={markets} />
            </span>
            <span className="inline-flex items-center gap-1">
              <Badge variant="secondary" className="font-medium">
                Win Either Half:{" "}
                {winEitherHalf === null ? "–" : winEitherHalf === "1" ? prediction.home_team : prediction.away_team}
              </Badge>
              <BookingPickButton predictionId={prediction.id} marketKey="winEitherHalf" markets={markets} />
            </span>
          </div>
        </div>

        <div className="space-y-1.5">
          <div className="text-[11px] font-medium uppercase tracking-wide text-foreground/70">Goals</div>
          <div className="flex flex-wrap gap-1.5">
            <YesNoBadge label="O1.5" value={markets.goals.over1_5} predictionId={prediction.id} marketKey="over1_5" markets={markets} />
            <YesNoBadge label="O2.5" value={markets.goals.over2_5} predictionId={prediction.id} marketKey="over2_5" markets={markets} />
            <YesNoBadge
              label="Draw/O2.5"
              value={isDrawOrOver2_5(markets)}
              predictionId={prediction.id}
              marketKey="drawOrOver2_5" markets={markets}
            />
          </div>
        </div>

        <div className="space-y-1.5">
          <div className="text-[11px] font-medium uppercase tracking-wide text-foreground/70">Corners</div>
          <div className="flex flex-wrap gap-1.5">
            <YesNoBadge label="O7.5" value={markets.corners.over7_5} predictionId={prediction.id} marketKey="over7_5" markets={markets} />
            <YesNoBadge label="O8.5" value={markets.corners.over8_5} predictionId={prediction.id} marketKey="over8_5" markets={markets} />
            <YesNoBadge
              label="1H O3.5"
              value={markets.corners.firstHalfOver3_5}
              predictionId={prediction.id}
              marketKey="firstHalfOver3_5" markets={markets}
            />
          </div>
        </div>

        {prediction.h2h && prediction.h2h.length > 0 && (
          <div className="space-y-1.5 border-t border-border/60 pt-3">
            <div className="text-[11px] font-medium uppercase tracking-wide text-foreground/70">
              Head-to-Head — last {prediction.h2h.length} meeting{prediction.h2h.length === 1 ? "" : "s"}
            </div>
            <div className="space-y-1.5">
              {prediction.h2h.map((meeting, i) => (
                <div
                  key={i}
                  className="flex items-center justify-between gap-2 rounded-md border border-border/60 bg-background/60 px-3 py-2"
                >
                  <div className="min-w-0">
                    <div className="truncate text-sm font-medium">
                      {meeting.home} {meeting.homeScore}–{meeting.awayScore} {meeting.away}
                    </div>
                    <div className="truncate text-xs text-muted-foreground">
                      {meeting.date}
                      {meeting.competition ? ` · ${meeting.competition}` : ""}
                    </div>
                  </div>
                  {meeting.corners && (
                    <div className="shrink-0 text-xs text-muted-foreground">
                      Corners {meeting.corners.home}–{meeting.corners.away}
                    </div>
                  )}
                </div>
              ))}
            </div>
            <p className="text-[11px] text-muted-foreground">
              The same head-to-head data this prediction&apos;s corner read was based on.
            </p>
          </div>
        )}

        {prediction.summary && (
          <div className="space-y-1 border-t border-border/60 pt-3">
            <div className="text-[11px] font-medium uppercase tracking-wide text-foreground/70">Tactical summary</div>
            <p className="text-sm font-medium text-foreground/90">{prediction.summary}</p>
          </div>
        )}
      </div>

      <AdSlot orientation="horizontal" />
    </main>
  );
}
