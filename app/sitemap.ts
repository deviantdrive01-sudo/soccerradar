import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/site";
import { QUICK_FILTER_OPTIONS } from "@/lib/quick-filter";
import { createSupabaseReadClient } from "@/lib/supabase/client";

export const revalidate = 3600;

// Matches used elsewhere on the site to keep the homepage/history browsable;
// stale matches beyond this aren't worth a crawler's time or the sitemap's size.
const MATCH_HISTORY_WINDOW_MS = 1000 * 60 * 60 * 24 * 30;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const supabase = createSupabaseReadClient();
  const cutoffIso = new Date(Date.now() - MATCH_HISTORY_WINDOW_MS).toISOString();

  const [{ data: predictions }, { data: collections }, { data: bookings }] = await Promise.all([
    supabase.from("predictions").select("id, match_date").gte("match_date", cutoffIso),
    supabase.from("bookmark_collections").select("id, updated_at"),
    supabase.from("bookings").select("id, updated_at"),
  ]);

  const staticRoutes: MetadataRoute.Sitemap = [
    { url: SITE_URL, changeFrequency: "hourly", priority: 1 },
    { url: `${SITE_URL}/accuracy`, changeFrequency: "daily", priority: 0.6 },
    { url: `${SITE_URL}/privacy`, changeFrequency: "yearly", priority: 0.2 },
  ];

  const topPicksRoutes: MetadataRoute.Sitemap = QUICK_FILTER_OPTIONS.map((option) => ({
    url: `${SITE_URL}/top-picks/${option.slug}`,
    changeFrequency: "hourly",
    priority: 0.9,
  }));

  const matchRoutes: MetadataRoute.Sitemap = (predictions ?? []).map((p) => ({
    url: `${SITE_URL}/match/${p.id}`,
    lastModified: p.match_date,
    changeFrequency: "daily",
    priority: 0.7,
  }));

  const collectionRoutes: MetadataRoute.Sitemap = (collections ?? []).map((c) => ({
    url: `${SITE_URL}/collections/${c.id}`,
    lastModified: c.updated_at,
    changeFrequency: "weekly",
    priority: 0.4,
  }));

  const bookingRoutes: MetadataRoute.Sitemap = (bookings ?? []).map((b) => ({
    url: `${SITE_URL}/bookings/${b.id}`,
    lastModified: b.updated_at,
    changeFrequency: "weekly",
    priority: 0.4,
  }));

  return [...staticRoutes, ...topPicksRoutes, ...matchRoutes, ...collectionRoutes, ...bookingRoutes];
}
