"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "cn";
import { ADMIN_NAV_ITEMS } from "@/lib/admin/nav-items";

/** Left sidebar nav for sm+ viewports — the horizontal pill nav (AdminNav) takes over below that. */
export function AdminSidebarNav() {
  const pathname = usePathname();

  return (
    <nav className="flex flex-col gap-1">
      {ADMIN_NAV_ITEMS.map((item) => {
        const isActive = item.href === "/admin" ? pathname === "/admin" : pathname.startsWith(item.href);
        const Icon = item.icon;
        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              "flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
              isActive ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted hover:text-foreground",
            )}
          >
            <Icon className="h-4 w-4 shrink-0" />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
