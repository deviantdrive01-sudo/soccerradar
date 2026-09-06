import { ImageResponse } from "next/og";
import { createSupabaseReadClient } from "@/lib/supabase/client";
import { parseIdFromParam } from "@/lib/share-slug";
import { ShareImageTemplate, SHARE_IMAGE_SIZE, type ShareImageItem } from "@/lib/share-image";
import type { Prediction } from "@/lib/supabase/types";

export const alt = "SoccerRadar collection";
export const size = SHARE_IMAGE_SIZE;
export const contentType = "image/png";

export default async function Image({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const numericId = parseIdFromParam(id);

  const supabase = createSupabaseReadClient();
  let title = "Collection";
  let ownerLabel = "a SoccerRadar user";
  let items: ShareImageItem[] = [];

  if (numericId !== null) {
    const { data: collection } = await supabase
      .from("bookmark_collections")
      .select("id, user_id, title")
      .eq("id", numericId)
      .maybeSingle();

    if (collection) {
      title = collection.title;
      const [{ data: owner }, { data: collectionItems }, { data: leagues }] = await Promise.all([
        supabase.from("profiles").select("username").eq("id", collection.user_id).maybeSingle(),
        supabase.from("bookmark_collection_items").select("prediction_id").eq("collection_id", numericId),
        supabase.from("leagues").select("id, name"),
      ]);
      ownerLabel = owner?.username ?? ownerLabel;

      const predictionIds = (collectionItems ?? []).map((i) => i.prediction_id);
      const { data: predictions } =
        predictionIds.length > 0
          ? await supabase
              .from("predictions")
              .select("*")
              .in("id", predictionIds)
              .order("match_date", { ascending: true })
          : { data: [] as Prediction[] };
      const leagueById = new Map((leagues ?? []).map((l) => [l.id, l.name]));

      items = (predictions ?? []).map((p) => ({
        home: p.home_team,
        away: p.away_team,
        detail: `${leagueById.get(p.league_id) ?? ""} · ${p.markets.outcome.label}`,
      }));
    }
  }

  return new ImageResponse(<ShareImageTemplate title={title} ownerLabel={ownerLabel} items={items} />, size);
}
