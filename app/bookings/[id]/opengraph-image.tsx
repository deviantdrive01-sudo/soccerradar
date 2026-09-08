import { ImageResponse } from "next/og";
import { createSupabaseReadClient } from "@/lib/supabase/client";
import { parseIdFromParam } from "@/lib/share-slug";
import { ShareImageTemplate, SHARE_IMAGE_SIZE_LARGE, SHARE_IMAGE_OPTIONS_LARGE, resolveAvatarDataUri, type ShareImageItem } from "@/lib/share-image";
import { MARKET_LABELS, marketPredictionLabel, marketValueLabel } from "@/lib/hydrate";
import { isPredicted } from "@/lib/supabase/types";
import type { MarketKey } from "@/lib/hydrate";
import type { Prediction } from "@/lib/supabase/types";

export const alt = "SoccerRadar booking";
export const size = SHARE_IMAGE_SIZE_LARGE;
export const contentType = "image/png";

export default async function Image({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const numericId = parseIdFromParam(id);

  const supabase = createSupabaseReadClient();
  let title = "Booking";
  let ownerLabel = "a SoccerRadar user";
  let avatarUrl: string | null = null;
  let items: ShareImageItem[] = [];

  if (numericId !== null) {
    const { data: booking } = await supabase.from("bookings").select("id, user_id, title").eq("id", numericId).maybeSingle();

    if (booking) {
      title = booking.title;
      const [{ data: owner }, { data: bookingItems }, { data: leagues }] = await Promise.all([
        supabase.from("profiles").select("username, avatar_url").eq("id", booking.user_id).maybeSingle(),
        supabase.from("booking_items").select("prediction_id, market_key, user_value").eq("booking_id", numericId),
        supabase.from("leagues").select("id, name"),
      ]);
      ownerLabel = owner?.username ?? ownerLabel;
      avatarUrl = await resolveAvatarDataUri(owner?.avatar_url);

      const predictionIds = [...new Set((bookingItems ?? []).map((i) => i.prediction_id))];
      const { data: predictions } =
        predictionIds.length > 0
          ? await supabase.from("predictions").select("*").in("id", predictionIds)
          : { data: [] as Prediction[] };
      const predictionById = new Map((predictions ?? []).map((p) => [p.id, p]));
      const leagueById = new Map((leagues ?? []).map((l) => [l.id, l.name]));

      items = (bookingItems ?? [])
        .map((i) => {
          const prediction = predictionById.get(i.prediction_id);
          if (!prediction || !isPredicted(prediction)) return null;
          const marketKey = i.market_key as MarketKey;
          const league = leagueById.get(prediction.league_id) ?? "";
          const value = i.user_value ? marketValueLabel(marketKey, i.user_value) : marketPredictionLabel(prediction.markets, marketKey);
          return {
            home: prediction.home_team,
            away: prediction.away_team,
            detail: `${league} · ${MARKET_LABELS[marketKey]}: ${value}`,
          };
        })
        .filter((i): i is ShareImageItem => i !== null);
    }
  }

  return new ImageResponse(
    <ShareImageTemplate title={title} ownerLabel={ownerLabel} avatarUrl={avatarUrl} items={items} maxVisible={8} />,
    SHARE_IMAGE_OPTIONS_LARGE,
  );
}
