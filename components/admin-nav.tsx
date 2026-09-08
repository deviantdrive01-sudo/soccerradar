"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "cn";

const NAV_ITEMS = [
  { href: "/admin", label: "Overview" },
  { href: "/admin/leagues", label: "Leagues" },
  { href: "/admin/matches", label: "Matches" },
  { href: "/admin/telegram", label: "Telegram" },
  { href: "/admin/ads", label: "Ads" },
  { href: "/admin/banner", label: "Banner" },
  { href: "/admin/users", label: "Users" },
  { href: "/admin/mixes", label: "Mixes" },
];

export function AdminNav() {
  const pathname = usePathname();

  return (
    <nav className="flex flex-wrap items-center gap-1 overflow-x-auto rounded-md border border-border/60 bg-card/40 p-1">
      {NAV_ITEMS.map((item) => {
        // "/admin" itself must match exactly — every other admin route also starts with "/admin".
        const isActive = item.href === "/admin" ? pathname === "/admin" : pathname.startsWith(item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              "shrink-0 rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
              isActive ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted hover:text-foreground",
            )}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
