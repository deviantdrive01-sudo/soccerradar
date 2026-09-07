import { ImageResponse } from "next/og";
import { createSupabaseReadClient } from "@/lib/supabase/client";
import { ShareImageTemplate, SHARE_IMAGE_SIZE, type ShareImageItem } from "@/lib/share-image";
import { MARKET_LABELS, marketPredictionLabel } from "@/lib/hydrate";
import { todayKey, dateKey } from "@/lib/date-key";
import { matchesQuickFilter, quickFilterOptionBySlug } from "@/lib/quick-filter";
import { isPredicted } from "@/lib/supabase/types";

export const alt = "SoccerRadar top picks";
export const size = SHARE_IMAGE_SIZE;
export const contentType = "image/png";

export default async function Image({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const option = quickFilterOptionBySlug(slug);

  let title = "Top Picks";
  let items: ShareImageItem[] = [];

  if (option) {
    title = option.collectionTitle;
    const supabase = createSupabaseReadClient();
    const [{ data: predictions }, { data: leagues }] = await Promise.all([
      supabase.from("predictions").select("*").order("match_date", { ascending: true }),
      supabase.from("leagues").select("id, name"),
    ]);
    const leagueById = new Map((leagues ?? []).map((l) => [l.id, l.name]));

    const today = todayKey();
    items = (predictions ?? [])
      .filter((p) => dateKey(p.match_date) === today && matchesQuickFilter(p, option.value))
      .map((p) => {
        if (!isPredicted(p)) return null;
        return {
          home: p.home_team,
          away: p.away_team,
          detail: `${leagueById.get(p.league_id) ?? ""} · ${MARKET_LABELS[option.marketKey]}: ${marketPredictionLabel(p.markets, option.marketKey)}`,
        };
      })
      .filter((i): i is ShareImageItem => i !== null);
  }

  return new ImageResponse(<ShareImageTemplate title={title} ownerLabel="SoccerRadar" items={items} />, size);
}
