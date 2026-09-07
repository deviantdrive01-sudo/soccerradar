import { redirect } from "next/navigation";
import Link from "next/link";
import { getCurrentUser } from "@/lib/account/dal";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createBooking, deleteBooking } from "./actions";
import { AccountCreateForm } from "@/components/account-create-form";
import { AccountDeleteButton } from "@/components/account-delete-button";
import { Badge } from "@/components/ui/badge";
import { gradePicks, tallyGraded } from "@/lib/booking-grading";
import { accuracyPct, pctClass } from "@/lib/accuracy";
import { isPredicted } from "@/lib/supabase/types";
import { cn } from "@/lib/utils";
import type { MarketKey } from "@/lib/hydrate";
import type { Prediction } from "@/lib/supabase/types";

export const dynamic = "force-dynamic";

export default async function BookingsPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const supabase = await createSupabaseServerClient();
  const { data: bookings } = await supabase
    .from("bookings")
    .select("id, title, is_public, created_at")
    .eq("user_id", user.userId)
    .order("created_at", { ascending: false });

  const bookingIds = (bookings ?? []).map((b) => b.id);
  const { data: items } =
    bookingIds.length > 0
      ? await supabase.from("booking_items").select("booking_id, prediction_id, market_key").in("booking_id", bookingIds)
      : { data: [] as { booking_id: number; prediction_id: number; market_key: string }[] };

  const predictionIds = [...new Set((items ?? []).map((i) => i.prediction_id))];
  const { data: predictions } =
    predictionIds.length > 0
      ? await supabase.from("predictions").select("*").in("id", predictionIds)
      : { data: [] as Prediction[] };
  const predictionById = new Map((predictions ?? []).map((p) => [p.id, p]));

  const itemCountByBooking = new Map<number, number>();
  const picksByBooking = new Map<number, { prediction: Prediction; marketKey: MarketKey }[]>();
  for (const item of items ?? []) {
    itemCountByBooking.set(item.booking_id, (itemCountByBooking.get(item.booking_id) ?? 0) + 1);
    const prediction = predictionById.get(item.prediction_id);
    if (!prediction || !isPredicted(prediction)) continue;
    const pick = { prediction, marketKey: item.market_key as MarketKey };
    const existing = picksByBooking.get(item.booking_id);
    if (existing) existing.push(pick);
    else picksByBooking.set(item.booking_id, [pick]);
  }
  const winRateByBooking = new Map<number, { settled: number; correct: number }>();
  for (const [bookingId, picks] of picksByBooking) {
    winRateByBooking.set(bookingId, tallyGraded(gradePicks(picks)));
  }

  return (
    <div className="flex max-w-2xl flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">My Bookings</h1>
        <p className="text-sm text-muted-foreground">
          Pick a specific market from any match — not the whole prediction — and mix picks from different matches
          into one shareable slip. Experimental, separate from Collections.
        </p>
      </div>

      <AccountCreateForm action={createBooking} placeholder="New booking name" />

      {(bookings ?? []).length === 0 ? (
        <p className="text-sm text-muted-foreground">No bookings yet — create one above.</p>
      ) : (
        <div className="divide-y divide-border/60 rounded-md border border-border/60">
          {(bookings ?? []).map((b) => {
            const winRate = winRateByBooking.get(b.id);
            return (
              <div key={b.id} className="flex items-center justify-between gap-2 px-3 py-2.5">
                <Link href={`/bookings/${b.id}`} className="min-w-0 flex-1">
                  <div className="truncate text-sm font-medium hover:text-primary hover:underline">{b.title}</div>
                  <div className="text-xs text-muted-foreground">
                    {itemCountByBooking.get(b.id) ?? 0} pick{itemCountByBooking.get(b.id) === 1 ? "" : "s"}
                    {" · "}
                    <span className={b.is_public ? "text-primary" : ""}>{b.is_public ? "Public" : "Private"}</span>
                  </div>
                </Link>
                <div className="flex shrink-0 items-center gap-2">
                  {winRate && winRate.settled > 0 && (
                    <Badge
                      variant="outline"
                      className={cn("text-xs font-semibold", pctClass(accuracyPct(winRate.correct, winRate.settled), winRate.settled))}
                    >
                      {winRate.correct}/{winRate.settled} won · {accuracyPct(winRate.correct, winRate.settled)}%
                    </Badge>
                  )}
                  <AccountDeleteButton action={deleteBooking} id={b.id} />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
