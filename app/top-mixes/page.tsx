import type { Metadata } from "next";
import { createSupabaseReadClient } from "@/lib/supabase/client";
import { gradePicks, tallyGraded } from "@/lib/booking-grading";
import { buildShareSlug } from "@/lib/share-slug";
import { SITE_TAGLINE, SITE_URL } from "@/lib/site";
import { TopBookingsList, type TopBookingEntry } from "@/components/top-bookings-list";
import { isPredicted } from "@/lib/supabase/types";
import type { MarketKey } from "@/lib/hydrate";
import type { Prediction } from "@/lib/supabase/types";

export const revalidate = 300;

export const metadata: Metadata = {
  title: "Top Mixes",
  description: `Public mixes from SoccerRadar users, graded against our public, verifiable track record. ${SITE_TAGLINE}`,
  alternates: { canonical: "/top-mixes" },
};

async function getTopBookings(): Promise<TopBookingEntry[]> {
  const supabase = createSupabaseReadClient();

  const { data: bookings } = await supabase
    .from("bookings")
    .select("id, user_id, title, published_at")
    .eq("is_public", true)
    .order("published_at", { ascending: false });

  if (!bookings || bookings.length === 0) return [];

  const bookingIds = bookings.map((b) => b.id);
  const userIds = [...new Set(bookings.map((b) => b.user_id))];

  const [{ data: profiles }, { data: items }] = await Promise.all([
    supabase.from("profiles").select("id, username, avatar_url").in("id", userIds),
    supabase.from("booking_items").select("booking_id, prediction_id, market_key, user_value").in("booking_id", bookingIds),
  ]);

  const predictionIds = [...new Set((items ?? []).map((i) => i.prediction_id))];
  const { data: predictions } =
    predictionIds.length > 0
      ? await supabase.from("predictions").select("*").in("id", predictionIds)
      : { data: [] as Prediction[] };

  const usernameById = new Map((profiles ?? []).map((p) => [p.id, p.username]));
  const avatarById = new Map((profiles ?? []).map((p) => [p.id, p.avatar_url]));
  const predictionById = new Map((predictions ?? []).map((p) => [p.id, p]));
  const itemsByBooking = new Map<number, { prediction_id: number; market_key: string; user_value: string | null }[]>();
  for (const item of items ?? []) {
    const existing = itemsByBooking.get(item.booking_id);
    if (existing) existing.push(item);
    else itemsByBooking.set(item.booking_id, [item]);
  }

  return bookings.map((booking) => {
    const rawItems = itemsByBooking.get(booking.id) ?? [];
    const picks = rawItems
      .map((item): { prediction: Prediction; marketKey: MarketKey; userValue: string | null } | null => {
        const prediction = predictionById.get(item.prediction_id);
        if (!prediction || !isPredicted(prediction)) return null;
        return { prediction, marketKey: item.market_key as MarketKey, userValue: item.user_value };
      })
      .filter((p): p is { prediction: Prediction; marketKey: MarketKey; userValue: string | null } => p !== null);

    const graded = gradePicks(picks);
    const { settled, correct } = tallyGraded(graded);
    const username = usernameById.get(booking.user_id) ?? null;
    const ownerAvatarUrl = avatarById.get(booking.user_id) ?? null;

    return {
      id: booking.id,
      title: booking.title,
      ownerLabel: username ?? "a SoccerRadar user",
      ownerUsername: username,
      ownerAvatarUrl,
      shareUrl: `/mixes/${buildShareSlug(booking.id, username)}`,
      pickCount: picks.length,
      settled,
      correct,
      publishedAt: booking.published_at,
    };
  });
}

export default async function TopBookingsPage() {
  const entries = await getTopBookings();

  return (
    <main className="mx-auto flex w-full max-w-4xl flex-1 flex-col gap-6 px-4 py-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Top Mixes</h1>
        <p className="text-sm text-muted-foreground">
          Mixes SoccerRadar users have chosen to make public — graded pick by pick against our public{" "}
          <a href={`${SITE_URL}/accuracy`} className="underline hover:text-foreground">
            Track Record
          </a>
          . No cherry-picking, nothing held back. A Mix is a personal prediction list, not a real wager — see our{" "}
          <a href={`${SITE_URL}/terms`} className="underline hover:text-foreground">
            Terms
          </a>
          .
        </p>
      </div>

      {entries.length === 0 ? (
        <div className="py-16 text-center text-sm text-muted-foreground">
          No public mixes yet — publish one from My Mixes to be featured here.
        </div>
      ) : (
        <TopBookingsList entries={entries} />
      )}
    </main>
  );
}
