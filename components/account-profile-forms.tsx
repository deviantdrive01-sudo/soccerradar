"use client";

import { useActionState, useEffect } from "react";
import { updateUsername, updatePassword, type ProfileActionState } from "@/app/account/profile/actions";
import { useAccount } from "@/components/account-provider";

const FIELD = "h-9 w-full rounded-md border border-border/60 bg-background px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50";

const initialState: ProfileActionState = {};

export function UsernameForm({ currentUsername }: { currentUsername: string | null }) {
  const [state, formAction, pending] = useActionState(updateUsername, initialState);
  const { refresh } = useAccount();

  useEffect(() => {
    if (state?.success) refresh();
  }, [state?.success, refresh]);

  return (
    <form action={formAction} className="max-w-sm space-y-3 rounded-lg border border-border/60 p-4">
      <h2 className="text-sm font-semibold">Username</h2>
      <input
        name="username"
        defaultValue={currentUsername ?? ""}
        required
        minLength={3}
        maxLength={20}
        pattern="[a-zA-Z0-9_]+"
        className={FIELD}
      />
      {state?.error && <p className="text-xs text-destructive">{state.error}</p>}
      {state?.success && <p className="text-xs text-emerald-500">{state.success}</p>}
      <button
        type="submit"
        disabled={pending}
        className="h-8 rounded-md bg-primary px-3 text-xs font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-60"
      >
        {pending ? "Saving…" : "Save username"}
      </button>
    </form>
  );
}

export function PasswordForm() {
  const [state, formAction, pending] = useActionState(updatePassword, initialState);

  return (
    <form action={formAction} className="max-w-sm space-y-3 rounded-lg border border-border/60 p-4">
      <h2 className="text-sm font-semibold">Password</h2>
      <input
        name="password"
        type="password"
        placeholder="New password"
        required
        minLength={8}
        autoComplete="new-password"
        className={FIELD}
      />
      {state?.error && <p className="text-xs text-destructive">{state.error}</p>}
      {state?.success && <p className="text-xs text-emerald-500">{state.success}</p>}
      <button
        type="submit"
        disabled={pending}
        className="h-8 rounded-md bg-primary px-3 text-xs font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-60"
      >
        {pending ? "Saving…" : "Change password"}
      </button>
    </form>
  );
}
