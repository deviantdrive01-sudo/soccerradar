"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { User } from "lucide-react";
import { useAccount } from "@/components/account-provider";
import { logout } from "@/app/account/actions";

const MENU_ITEMS = [
  { href: "/account", label: "Overview" },
  { href: "/account/favorites", label: "My Favorites" },
  { href: "/account/collections", label: "My Collections" },
  { href: "/account/profile", label: "Profile Settings" },
];

export function HeaderAccount() {
  const { loading, user, refresh } = useAccount();
  const router = useRouter();

  async function handleLogout() {
    await logout();
    refresh();
    router.push("/");
  }

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
    <div className="group relative shrink-0">
      <Link
        href="/account"
        className="flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium text-muted-foreground hover:bg-muted hover:text-foreground"
      >
        <User className="size-4" />
        {user.username ?? "My Account"}
      </Link>

      <div className="invisible absolute right-0 top-full z-20 w-44 pt-1 opacity-0 transition-opacity group-hover:visible group-hover:opacity-100">
        <div className="rounded-md border border-border/60 bg-popover py-1 shadow-lg">
          {MENU_ITEMS.map((item) => (
            <Link key={item.href} href={item.href} className="block px-3 py-2 text-sm hover:bg-muted">
              {item.label}
            </Link>
          ))}
          {user.isAdmin && (
            <>
              <div className="my-1 border-t border-border/60" />
              <Link href="/admin" className="block px-3 py-2 text-sm font-medium text-primary hover:bg-muted">
                Admin Dashboard
              </Link>
            </>
          )}
          <button type="button" onClick={handleLogout} className="block w-full px-3 py-2 text-left text-sm hover:bg-muted">
            Log out
          </button>
        </div>
      </div>
    </div>
  );
}
