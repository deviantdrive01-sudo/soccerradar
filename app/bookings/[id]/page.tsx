import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { createSupabaseReadClient } from "@/lib/supabase/client";
import { BookingManage, type BookingPick } from "@/components/booking-manage";
import { SITE_URL } from "@/lib/site";
import type { MarketKey } from "@/lib/hydrate";
import type { Prediction } from "@/lib/supabase/types";

export const revalidate = 300;

async function getBookingData(id: number) {
  const supabase = createSupabaseReadClient();

  const { data: booking } = await supabase.from("bookings").select("id, user_id, title").eq("id", id).maybeSingle();
  if (!booking) return null;

  const [{ data: owner }, { data: items }, { data: leagues }] = await Promise.all([
    supabase.from("profiles").select("username").eq("id", booking.user_id).maybeSingle(),
    supabase
      .from("booking_items")
      .select("prediction_id, market_key, created_at")
      .eq("booking_id", id)
      .order("created_at", { ascending: true }),
    supabase.from("leagues").select("id, name"),
  ]);

  const predictionIds = [...new Set((items ?? []).map((i) => i.prediction_id))];
  const { data: predictions } =
    predictionIds.length > 0
      ? await supabase.from("predictions").select("*").in("id", predictionIds)
      : { data: [] as Prediction[] };

  const predictionById = new Map((predictions ?? []).map((p) => [p.id, p]));
  const picks: BookingPick[] = (items ?? [])
    .map((item) => {
      const prediction = predictionById.get(item.prediction_id);
      return prediction ? { prediction, marketKey: item.market_key as MarketKey } : null;
    })
    .filter((p): p is BookingPick => p !== null);

  const leagueById = new Map((leagues ?? []).map((l) => [l.id, l]));

  return {
    booking,
    ownerLabel: owner?.username ?? "a SoccerRadar user",
    picks,
    leagueById,
  };
}

export async function generateMetadata({ params }: PageProps<"/bookings/[id]">): Promise<Metadata> {
  const { id } = await params;
  const numericId = Number(id);
  if (!Number.isInteger(numericId)) return { title: "Booking not found" };

  const data = await getBookingData(numericId);
  if (!data) return { title: "Booking not found" };

  const title = `${data.booking.title} — a booking by ${data.ownerLabel}`;
  const description = `${data.picks.length} pick(s) chosen by ${data.ownerLabel} on SoccerRadar.`;
  const url = `${SITE_URL}/bookings/${numericId}`;

  return {
    title,
    description,
    alternates: { canonical: url },
    robots: data.picks.length === 0 ? { index: false, follow: true } : { index: true, follow: true },
    openGraph: { title, description, url, type: "website" },
    twitter: { card: "summary", title, description },
  };
}

export default async function BookingPage({ params }: PageProps<"/bookings/[id]">) {
  const { id } = await params;
  const numericId = Number(id);
  if (!Number.isInteger(numericId)) notFound();

  const data = await getBookingData(numericId);
  if (!data) notFound();
  const { booking, ownerLabel, picks, leagueById } = data;

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-6 px-4 py-6">
      <BookingManage
        bookingId={booking.id}
        ownerId={booking.user_id}
        ownerLabel={ownerLabel}
        initialTitle={booking.title}
        picks={picks}
        leagueById={leagueById}
        shareUrl={`${SITE_URL}/bookings/${booking.id}`}
      />
    </main>
  );
}
