"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { deleteBookingAdmin } from "@/app/admin/(authed)/mixes/actions";

export function AdminDeleteBookingButton({ bookingId, label }: { bookingId: number; label: string }) {
  const [pending, setPending] = useState(false);
  const router = useRouter();

  async function handleDelete() {
    if (!confirm(`Permanently delete "${label}"? This removes the booking and all its picks. This can't be undone.`)) {
      return;
    }
    setPending(true);
    try {
      await deleteBookingAdmin(bookingId);
      router.refresh();
    } finally {
      setPending(false);
    }
  }

  return (
    <button
      type="button"
      onClick={handleDelete}
      disabled={pending}
      className="h-7 rounded-md border border-destructive/40 px-2 text-xs font-medium text-destructive hover:bg-destructive/10 disabled:opacity-60"
    >
      {pending ? "…" : "Delete"}
    </button>
  );
}
