"use client";

import { useState } from "react";
import Link from "next/link";
import { User } from "lucide-react";
import { useAccount } from "@/components/account-provider";
import { logout } from "@/app/account/actions";

export function HeaderAccount() {
  const { loading, user } = useAccount();
  const [menuOpen, setMenuOpen] = useState(false);

  if (loading) {
    return <div className="h-8 w-16 shrink-0" />;
  }

  if (!user) {
    return (
      <div className="flex shrink-0 items-center gap-1">
        <Link
          href="/login"
          className="rounded-md px-3 py-1.5 text-sm font-medium text-muted-foreground hover:bg-muted hover:text-foreground"
        >
          Log in
        </Link>
        <Link
          href="/signup"
          className="rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:bg-primary/90"
        >
          Sign up
        </Link>
      </div>
    );
  }

  return (
    <div className="relative shrink-0">
      <button
        type="button"
        onClick={() => setMenuOpen((v) => !v)}
        className="flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium text-muted-foreground hover:bg-muted hover:text-foreground"
      >
        <User className="size-4" />
        {user.username ?? "Account"}
      </button>
      {menuOpen && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setMenuOpen(false)} />
          <div className="absolute right-0 top-full z-20 mt-1 w-40 rounded-md border border-border/60 bg-popover py-1 shadow-lg">
            <Link
              href="/account/favorites"
              className="block px-3 py-2 text-sm hover:bg-muted"
              onClick={() => setMenuOpen(false)}
            >
              My Favorites
            </Link>
            <form action={logout}>
              <button type="submit" className="block w-full px-3 py-2 text-left text-sm hover:bg-muted">
                Log out
              </button>
            </form>
          </div>
        </>
      )}
    </div>
  );
}
