"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAccount } from "@/components/account-provider";

const FIELD = "h-9 flex-1 rounded-md border border-border/60 bg-background px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50";

/**
 * A plain <form action={serverAction}> only revalidates this page's own
 * server data — it never tells AccountProvider (which holds its own
 * client-fetched copy for CollectionPickerButton/BookingPickButton etc.
 * everywhere else) that anything changed. Going through this component
 * instead calls the action directly, then refreshes both.
 */
export function AccountCreateForm({
  action,
  placeholder,
}: {
  action: (title: string) => Promise<unknown>;
  placeholder: string;
}) {
  const [title, setTitle] = useState("");
  const [pending, setPending] = useState(false);
  const { refresh } = useAccount();
  const router = useRouter();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim() || pending) return;
    setPending(true);
    try {
      await action(title);
      setTitle("");
      refresh();
      router.refresh();
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex items-center gap-2">
      <input
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder={placeholder}
        required
        className={FIELD}
      />
      <button
        type="submit"
        disabled={pending}
        className="h-9 shrink-0 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-60"
      >
        {pending ? "Creating…" : "Create"}
      </button>
    </form>
  );
}
