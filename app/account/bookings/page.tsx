import { redirect } from "next/navigation";
import Link from "next/link";
import { getCurrentUser } from "@/lib/account/dal";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createBooking, deleteBooking } from "./actions";
import { AccountCreateForm } from "@/components/account-create-form";
import { AccountDeleteButton } from "@/components/account-delete-button";

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
      ? await supabase.from("booking_items").select("booking_id").in("booking_id", bookingIds)
      : { data: [] as { booking_id: number }[] };

  const itemCountByBooking = new Map<number, number>();
  for (const item of items ?? []) {
    itemCountByBooking.set(item.booking_id, (itemCountByBooking.get(item.booking_id) ?? 0) + 1);
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
          {(bookings ?? []).map((b) => (
            <div key={b.id} className="flex items-center justify-between gap-2 px-3 py-2.5">
              <Link href={`/bookings/${b.id}`} className="min-w-0 flex-1">
                <div className="truncate text-sm font-medium hover:text-primary hover:underline">{b.title}</div>
                <div className="text-xs text-muted-foreground">
                  {itemCountByBooking.get(b.id) ?? 0} pick{itemCountByBooking.get(b.id) === 1 ? "" : "s"}
                  {" · "}
                  <span className={b.is_public ? "text-emerald-400" : ""}>{b.is_public ? "Public" : "Private"}</span>
                </div>
              </Link>
              <AccountDeleteButton action={deleteBooking} id={b.id} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
