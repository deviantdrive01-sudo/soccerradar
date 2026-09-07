"use server";

import { revalidatePath } from "next/cache";
import { verifySession } from "@/lib/admin/dal";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";

/**
 * Any admin can pull a booking out of the public Top Bookings directory —
 * a reversible, low-risk moderation action (the booking and its link keep
 * working, same as any owner-toggled private booking).
 */
export async function forceBookingPrivate(formData: FormData): Promise<void> {
  await verifySession();
  const bookingId = Number(formData.get("bookingId"));
  if (!Number.isInteger(bookingId)) return;

  const supabase = createAdminSupabaseClient();
  await supabase.from("bookings").update({ is_public: false }).eq("id", bookingId);

  revalidatePath("/admin/bookings");
  revalidatePath("/top-bookings");
}

/** Permanently deleting a booking (and its picks) is super_admin only. */
export async function deleteBookingAdmin(bookingId: number): Promise<void> {
  const session = await verifySession();
  if (session.role !== "super_admin") throw new Error("Only a super admin can delete a booking");

  const supabase = createAdminSupabaseClient();
  await supabase.from("bookings").delete().eq("id", bookingId);

  revalidatePath("/admin/bookings");
  revalidatePath("/top-bookings");
}
