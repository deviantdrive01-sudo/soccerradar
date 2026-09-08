"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAccount } from "@/components/account-provider";
import { logout } from "@/app/account/actions";
import { Avatar } from "@/components/avatar";

const MENU_ITEMS = [
  { href: "/account", label: "Overview" },
  { href: "/account/favorites", label: "My Favorites" },
  { href: "/account/collections", label: "My Collections" },
  { href: "/account/mixes", label: "My Mixes" },
  { href: "/account/profile", label: "Profile Settings" },
];

export function HeaderAccount() {
  const { loading, user, refresh } = useAccount();
  const router = useRouter();
  const [open, setOpen] = useState(false);

  async function handleLogout() {
    setOpen(false);
    await logout();
    refresh();
    router.push("/");
  }

  if (loading) {
    return <div className="h-8 w-16 shrink-0" />;
  }

  if (!user) {
    return (
      <div className="flex shrink-0 items-center gap-1" data-tour="account">
        <Link
          href="/login"
          className="rounded-md px-2 py-1.5 text-sm font-medium text-muted-foreground hover:bg-muted hover:text-foreground sm:px-3"
        >
          Log in
        </Link>
        <Link
          href="/signup"
          className="rounded-md bg-primary px-2 py-1.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 sm:px-3"
        >
          Sign up
        </Link>
      </div>
    );
  }

  return (
    <div className="relative shrink-0" data-tour="account">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label={user.username ?? "My Account"}
        className="flex items-center rounded-full"
      >
        <Avatar avatarUrl={user.avatarUrl} username={user.username} />
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-full z-20 w-44 pt-1">
            <div className="rounded-md border border-border/60 bg-popover py-1 shadow-lg">
              {MENU_ITEMS.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setOpen(false)}
                  className="block px-3 py-2 text-sm hover:bg-muted"
                >
                  {item.label}
                </Link>
              ))}
              {user.role !== "user" && (
                <>
                  <div className="my-1 border-t border-border/60" />
                  <Link
                    href="/admin"
                    onClick={() => setOpen(false)}
                    className="block px-3 py-2 text-sm font-medium text-primary hover:bg-muted"
                  >
                    Admin Dashboard
                  </Link>
                </>
              )}
              <button type="button" onClick={handleLogout} className="block w-full px-3 py-2 text-left text-sm hover:bg-muted">
                Log out
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
