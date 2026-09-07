import Link from "next/link";
import { verifySession } from "@/lib/admin/dal";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { forceBookingPrivate } from "./actions";
import { AdminDeleteBookingButton } from "@/components/admin-delete-booking-button";
import { Avatar } from "@/components/avatar";
import { buildShareSlug } from "@/lib/share-slug";
import { gradePicks, tallyGraded } from "@/lib/booking-grading";
import { accuracyPct, pctClass } from "@/lib/accuracy";
import { cn } from "@/lib/utils";
import type { MarketKey } from "@/lib/hydrate";
import type { Prediction } from "@/lib/supabase/types";

export const dynamic = "force-dynamic";

export default async function AdminBookingsPage() {
  const session = await verifySession();
  const isSuperAdmin = session.role === "super_admin";
  const supabase = createAdminSupabaseClient();

  const { data: bookings } = await supabase
    .from("bookings")
    .select("id, user_id, title, is_public, created_at")
    .order("created_at", { ascending: false });

  const bookingIds = (bookings ?? []).map((b) => b.id);
  const userIds = [...new Set((bookings ?? []).map((b) => b.user_id))];

  const [{ data: profiles }, { data: items }] = await Promise.all([
    userIds.length > 0
      ? supabase.from("profiles").select("id, username, avatar_url").in("id", userIds)
      : Promise.resolve({ data: [] as { id: string; username: string | null; avatar_url: string | null }[] }),
    bookingIds.length > 0
      ? supabase.from("booking_items").select("booking_id, prediction_id, market_key, user_value").in("booking_id", bookingIds)
      : Promise.resolve({ data: [] as { booking_id: number; prediction_id: number; market_key: string; user_value: string | null }[] }),
  ]);

  const predictionIds = [...new Set((items ?? []).map((i) => i.prediction_id))];
  const { data: predictions } =
    predictionIds.length > 0
      ? await supabase.from("predictions").select("*").in("id", predictionIds)
      : { data: [] as Prediction[] };

  const usernameById = new Map((profiles ?? []).map((p) => [p.id, p.username]));
  const avatarById = new Map((profiles ?? []).map((p) => [p.id, p.avatar_url]));
  const predictionById = new Map((predictions ?? []).map((p) => [p.id, p]));
  const bookingById = new Map((bookings ?? []).map((b) => [b.id, b]));

  const itemCountByBooking = new Map<number, number>();
  for (const item of items ?? []) {
    itemCountByBooking.set(item.booking_id, (itemCountByBooking.get(item.booking_id) ?? 0) + 1);
  }

  // Average win rate per owner, across every one of their bookings — not
  // just the one in this row — so the admin can see if this owner's picks
  // have generally been reliable, not just this single booking's.
  const picksByOwner = new Map<string, { prediction: Prediction; marketKey: MarketKey; userValue: string | null }[]>();
  for (const item of items ?? []) {
    const booking = bookingById.get(item.booking_id);
    const prediction = predictionById.get(item.prediction_id);
    if (!booking || !prediction) continue;
    const existing = picksByOwner.get(booking.user_id);
    const pick = { prediction, marketKey: item.market_key as MarketKey, userValue: item.user_value };
    if (existing) existing.push(pick);
    else picksByOwner.set(booking.user_id, [pick]);
  }
  const winRateByOwner = new Map<string, { settled: number; correct: number }>();
  for (const [ownerId, picks] of picksByOwner) {
    winRateByOwner.set(ownerId, tallyGraded(gradePicks(picks)));
  }

  const publicCount = (bookings ?? []).filter((b) => b.is_public).length;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Bookings</h1>
        <p className="text-sm text-muted-foreground">
          {(bookings ?? []).length} booking{(bookings ?? []).length === 1 ? "" : "s"} · {publicCount} public on the
          Top Bookings directory. Force a booking private to pull it from the directory immediately (reversible —
          the owner can republish it), or delete it entirely
          {!isSuperAdmin && " (super admin only)"}.
        </p>
      </div>

      {/* Phone: stacked cards — the table below needs 820px+ to read without horizontal scrolling. */}
      <div className="space-y-3 sm:hidden">
        {(bookings ?? []).map((booking) => {
          const username = usernameById.get(booking.user_id) ?? null;
          const avatarUrl = avatarById.get(booking.user_id) ?? null;
          const winRate = winRateByOwner.get(booking.user_id);
          return (
            <div key={booking.id} className="space-y-3 rounded-md border border-border/60 p-3">
              <div className="flex items-start justify-between gap-2">
                <Link
                  href={`/bookings/${buildShareSlug(booking.id, username)}`}
                  target="_blank"
                  className="min-w-0 truncate font-medium hover:text-primary hover:underline"
                >
                  {booking.title}
                </Link>
                {booking.is_public ? (
                  <span className="shrink-0 rounded-full border border-primary/40 px-2 py-0.5 text-[10px] font-medium text-primary">
                    Public
                  </span>
                ) : (
                  <span className="shrink-0 rounded-full border border-border/60 px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
                    Private
                  </span>
                )}
              </div>

              <div className="flex items-center gap-2">
                <Avatar avatarUrl={avatarUrl} username={username} size="size-6" textSize="text-[10px]" />
                <span className="text-sm text-muted-foreground">{username ?? "—"}</span>
              </div>

              <div className="grid grid-cols-3 gap-2 text-sm">
                <div>
                  <div className="text-[10px] uppercase tracking-wide text-muted-foreground">Win Rate</div>
                  {winRate && winRate.settled > 0 ? (
                    <span className={cn("font-medium", pctClass(accuracyPct(winRate.correct, winRate.settled), winRate.settled))}>
                      {accuracyPct(winRate.correct, winRate.settled)}%
                    </span>
                  ) : (
                    <span className="text-muted-foreground">—</span>
                  )}
                </div>
                <div>
                  <div className="text-[10px] uppercase tracking-wide text-muted-foreground">Picks</div>
                  {itemCountByBooking.get(booking.id) ?? 0}
                </div>
                <div>
                  <div className="text-[10px] uppercase tracking-wide text-muted-foreground">Created</div>
                  {new Date(booking.created_at).toLocaleDateString("en-GB")}
                </div>
              </div>

              <div className="flex items-center gap-1.5 border-t border-border/60 pt-2">
                {booking.is_public && (
                  <form action={forceBookingPrivate}>
                    <input type="hidden" name="bookingId" value={booking.id} />
                    <button
                      type="submit"
                      className="h-7 rounded-md border border-border/60 px-2 text-xs font-medium hover:bg-muted/60"
                    >
                      Force Private
                    </button>
                  </form>
                )}
                {isSuperAdmin && <AdminDeleteBookingButton bookingId={booking.id} label={booking.title} />}
              </div>
            </div>
          );
        })}
      </div>

      {/* sm+: table */}
      <div className="hidden overflow-x-auto rounded-md border border-border/60 sm:block">
        <table className="w-full min-w-[820px] text-sm">
          <thead>
            <tr className="border-b border-border/60 text-left text-muted-foreground">
              <th className="p-2 font-medium">Booking</th>
              <th className="p-2 font-medium">Owner</th>
              <th className="p-2 font-medium text-center">Win Rate</th>
              <th className="p-2 font-medium text-center">Picks</th>
              <th className="p-2 font-medium">Created</th>
              <th className="p-2 font-medium text-center">Status</th>
              <th className="p-2 font-medium text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {(bookings ?? []).map((booking) => {
              const username = usernameById.get(booking.user_id) ?? null;
              const avatarUrl = avatarById.get(booking.user_id) ?? null;
              const winRate = winRateByOwner.get(booking.user_id);
              return (
                <tr key={booking.id} className="border-b border-border/60 last:border-0">
                  <td className="p-2">
                    <Link
                      href={`/bookings/${buildShareSlug(booking.id, username)}`}
                      target="_blank"
                      className="font-medium hover:text-primary hover:underline"
                    >
                      {booking.title}
                    </Link>
                  </td>
                  <td className="p-2">
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <Avatar avatarUrl={avatarUrl} username={username} size="size-6" textSize="text-[10px]" />
                      <span>{username ?? "—"}</span>
                    </div>
                  </td>
                  <td className="p-2 text-center">
                    {winRate && winRate.settled > 0 ? (
                      <span className={cn("font-medium", pctClass(accuracyPct(winRate.correct, winRate.settled), winRate.settled))}>
                        {accuracyPct(winRate.correct, winRate.settled)}%{" "}
                        <span className="text-xs text-muted-foreground">
                          ({winRate.correct}/{winRate.settled})
                        </span>
                      </span>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </td>
                  <td className="p-2 text-center">{itemCountByBooking.get(booking.id) ?? 0}</td>
                  <td className="p-2 whitespace-nowrap text-muted-foreground">
                    {new Date(booking.created_at).toLocaleDateString("en-GB")}
                  </td>
                  <td className="p-2 text-center">
                    {booking.is_public ? (
                      <span className="rounded-full border border-primary/40 px-2 py-0.5 text-[10px] font-medium text-primary">
                        Public
                      </span>
                    ) : (
                      <span className="rounded-full border border-border/60 px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
                        Private
                      </span>
                    )}
                  </td>
                  <td className="p-2">
                    <div className="flex items-center justify-end gap-1.5">
                      {booking.is_public && (
                        <form action={forceBookingPrivate}>
                          <input type="hidden" name="bookingId" value={booking.id} />
                          <button
                            type="submit"
                            className="h-7 rounded-md border border-border/60 px-2 text-xs font-medium hover:bg-muted/60"
                          >
                            Force Private
                          </button>
                        </form>
                      )}
                      {isSuperAdmin && <AdminDeleteBookingButton bookingId={booking.id} label={booking.title} />}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
