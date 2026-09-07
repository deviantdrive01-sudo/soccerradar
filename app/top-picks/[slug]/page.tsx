import type { Metadata } from "next";
import { BackLink } from "@/components/back-link";
import { notFound } from "next/navigation";
import { createSupabaseReadClient } from "@/lib/supabase/client";
import { TopPicksView } from "@/components/top-picks-view";
import { todayKey, dateKey } from "@/lib/date-key";
import { matchesQuickFilter, quickFilterOptionBySlug } from "@/lib/quick-filter";
import { SITE_URL } from "@/lib/site";

export const revalidate = 300;

async function getTodaysPicks(slug: string) {
  const option = quickFilterOptionBySlug(slug);
  if (!option) return null;

  const supabase = createSupabaseReadClient();
  const [{ data: predictions }, { data: leagues }] = await Promise.all([
    supabase.from("predictions").select("*").order("match_date", { ascending: true }),
    supabase.from("leagues").select("*"),
  ]);

  const today = todayKey();
  const picks = (predictions ?? []).filter(
    (p) => dateKey(p.match_date) === today && matchesQuickFilter(p, option.value),
  );
  const leagueById = new Map((leagues ?? []).map((l) => [l.id, l]));

  return { option, picks, leagueById };
}

export async function generateMetadata({ params }: PageProps<"/top-picks/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const option = quickFilterOptionBySlug(slug);
  if (!option) return { title: "Top picks not found" };

  const title = `Top Predictions Today: ${option.collectionTitle}`;
  const description = `Today's AI-generated predictions for ${option.collectionTitle} across all covered leagues.`;
  const url = `${SITE_URL}/top-picks/${slug}`;

  return {
    title,
    description,
    alternates: { canonical: url },
    openGraph: { title, description, url, type: "website" },
    twitter: { card: "summary", title, description },
  };
}

export default async function TopPicksPage({ params }: PageProps<"/top-picks/[slug]">) {
  const { slug } = await params;
  const data = await getTodaysPicks(slug);
  if (!data) notFound();
  const { option, picks, leagueById } = data;

  return (
    <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-6 px-4 py-6">
      <BackLink fallbackHref="/" fallbackLabel="All predictions" />

      <div>
        <h1 className="text-2xl font-bold tracking-tight">Top Predictions Today</h1>
        <p className="text-sm text-muted-foreground">{option.collectionTitle} — updated daily.</p>
      </div>

      <TopPicksView
        predictions={picks}
        leagueById={leagueById}
        marketFilter={option.marketFilter}
        marketKey={option.marketKey}
        shareUrl={`${SITE_URL}/top-picks/${option.slug}`}
        shareTitle={`Top Predictions Today: ${option.collectionTitle} — SoccerRadar`}
      />
    </main>
  );
}
