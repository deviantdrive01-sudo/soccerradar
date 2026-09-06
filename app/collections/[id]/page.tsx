import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { createSupabaseReadClient } from "@/lib/supabase/client";
import { CollectionManage } from "@/components/collection-manage";
import { SITE_URL } from "@/lib/site";
import { buildShareSlug, parseIdFromParam } from "@/lib/share-slug";
import type { Prediction } from "@/lib/supabase/types";

export const revalidate = 300;

async function getCollectionData(id: number) {
  const supabase = createSupabaseReadClient();

  const { data: collection } = await supabase
    .from("bookmark_collections")
    .select("id, user_id, title")
    .eq("id", id)
    .maybeSingle();
  if (!collection) return null;

  const [{ data: owner }, { data: items }, { data: leagues }] = await Promise.all([
    supabase.from("profiles").select("username").eq("id", collection.user_id).maybeSingle(),
    supabase.from("bookmark_collection_items").select("prediction_id").eq("collection_id", id),
    supabase.from("leagues").select("id, name"),
  ]);

  const predictionIds = (items ?? []).map((i) => i.prediction_id);
  const { data: predictions } =
    predictionIds.length > 0
      ? await supabase.from("predictions").select("*").in("id", predictionIds).order("match_date", { ascending: true })
      : { data: [] as Prediction[] };

  const leagueById = new Map((leagues ?? []).map((l) => [l.id, l]));

  return {
    collection,
    ownerUsername: owner?.username ?? null,
    ownerLabel: owner?.username ?? "a SoccerRadar user",
    predictions: predictions ?? [],
    leagueById,
  };
}

export async function generateMetadata({ params }: PageProps<"/collections/[id]">): Promise<Metadata> {
  const { id } = await params;
  const numericId = parseIdFromParam(id);
  if (numericId === null) return { title: "Collection not found" };

  const data = await getCollectionData(numericId);
  if (!data) return { title: "Collection not found" };

  const title = `${data.collection.title} — a bookmark collection by ${data.ownerLabel}`;
  const description = `${data.predictions.length} prediction(s) picked by ${data.ownerLabel} on SoccerRadar.`;
  const url = `${SITE_URL}/collections/${buildShareSlug(numericId, data.ownerUsername)}`;

  return {
    title,
    description,
    alternates: { canonical: url },
    // Sparse/empty user-created collections are thin content — keep them off search results.
    robots: data.predictions.length === 0 ? { index: false, follow: true } : { index: true, follow: true },
    openGraph: { title, description, url, type: "website" },
    twitter: { card: "summary", title, description },
  };
}

export default async function CollectionPage({ params }: PageProps<"/collections/[id]">) {
  const { id } = await params;
  const numericId = parseIdFromParam(id);
  if (numericId === null) notFound();

  const data = await getCollectionData(numericId);
  if (!data) notFound();
  const { collection, ownerUsername, ownerLabel, predictions, leagueById } = data;

  return (
    <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-6 px-4 py-6">
      <CollectionManage
        collectionId={collection.id}
        ownerId={collection.user_id}
        ownerLabel={ownerLabel}
        initialTitle={collection.title}
        predictions={predictions}
        leagueById={leagueById}
        shareUrl={`${SITE_URL}/collections/${buildShareSlug(collection.id, ownerUsername)}`}
      />
    </main>
  );
}
