import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { createSupabaseReadClient } from "@/lib/supabase/client";
import { BookerManage, type BookerPick } from "@/components/booker-manage";
import { SITE_URL } from "@/lib/site";
import type { MarketKey } from "@/lib/hydrate";
import type { Prediction } from "@/lib/supabase/types";

export const revalidate = 300;

async function getBookerData(id: number) {
  const supabase = createSupabaseReadClient();

  const { data: booker } = await supabase.from("bookers").select("id, user_id, title").eq("id", id).maybeSingle();
  if (!booker) return null;

  const [{ data: owner }, { data: items }, { data: leagues }] = await Promise.all([
    supabase.from("profiles").select("username").eq("id", booker.user_id).maybeSingle(),
    supabase
      .from("booker_items")
      .select("prediction_id, market_key, created_at")
      .eq("booker_id", id)
      .order("created_at", { ascending: true }),
    supabase.from("leagues").select("id, name"),
  ]);

  const predictionIds = [...new Set((items ?? []).map((i) => i.prediction_id))];
  const { data: predictions } =
    predictionIds.length > 0
      ? await supabase.from("predictions").select("*").in("id", predictionIds)
      : { data: [] as Prediction[] };

  const predictionById = new Map((predictions ?? []).map((p) => [p.id, p]));
  const picks: BookerPick[] = (items ?? [])
    .map((item) => {
      const prediction = predictionById.get(item.prediction_id);
      return prediction ? { prediction, marketKey: item.market_key as MarketKey } : null;
    })
    .filter((p): p is BookerPick => p !== null);

  const leagueById = new Map((leagues ?? []).map((l) => [l.id, l]));

  return {
    booker,
    ownerLabel: owner?.username ?? "a SoccerRadar user",
    picks,
    leagueById,
  };
}

export async function generateMetadata({ params }: PageProps<"/bookers/[id]">): Promise<Metadata> {
  const { id } = await params;
  const numericId = Number(id);
  if (!Number.isInteger(numericId)) return { title: "Booker not found — SoccerRadar" };

  const data = await getBookerData(numericId);
  if (!data) return { title: "Booker not found — SoccerRadar" };

  return {
    title: `${data.booker.title} — a booker by ${data.ownerLabel} | SoccerRadar`,
    description: `${data.picks.length} pick(s) chosen by ${data.ownerLabel} on SoccerRadar.`,
  };
}

export default async function BookerPage({ params }: PageProps<"/bookers/[id]">) {
  const { id } = await params;
  const numericId = Number(id);
  if (!Number.isInteger(numericId)) notFound();

  const data = await getBookerData(numericId);
  if (!data) notFound();
  const { booker, ownerLabel, picks, leagueById } = data;

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-6 px-4 py-6">
      <BookerManage
        bookerId={booker.id}
        ownerId={booker.user_id}
        ownerLabel={ownerLabel}
        initialTitle={booker.title}
        picks={picks}
        leagueById={leagueById}
        shareUrl={`${SITE_URL}/bookers/${booker.id}`}
      />
    </main>
  );
}
