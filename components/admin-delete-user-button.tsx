"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { deleteUserAccount } from "@/app/admin/(authed)/users/actions";

export function AdminDeleteUserButton({ userId, label }: { userId: string; label: string }) {
  const [pending, setPending] = useState(false);
  const router = useRouter();

  async function handleDelete() {
    if (!confirm(`Delete ${label}'s account? This permanently removes their login and all their data. This can't be undone.`)) {
      return;
    }
    setPending(true);
    try {
      await deleteUserAccount(userId);
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
