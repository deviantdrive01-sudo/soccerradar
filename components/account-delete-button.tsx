"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAccount } from "@/components/account-provider";

export function AccountDeleteButton({ action, id }: { action: (id: number) => Promise<void>; id: number }) {
  const [pending, setPending] = useState(false);
  const { refresh } = useAccount();
  const router = useRouter();

  async function handleDelete() {
    if (pending) return;
    setPending(true);
    try {
      await action(id);
      refresh();
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
      className="h-8 shrink-0 rounded-md border border-border/60 px-2.5 text-xs font-medium hover:bg-muted/60 disabled:opacity-60"
    >
      {pending ? "…" : "Delete"}
    </button>
  );
}
