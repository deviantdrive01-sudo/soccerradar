"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, Heart, Bookmark, Ticket, User, Send } from "lucide-react";
import { cn } from "cn";

const NAV_ITEMS = [
  { href: "/account", label: "Overview", icon: LayoutDashboard },
  { href: "/account/favorites", label: "Favorites", icon: Heart },
  { href: "/account/collections", label: "Collections", icon: Bookmark },
  { href: "/account/bookings", label: "Bookings", icon: Ticket },
  { href: "/account/telegram", label: "Telegram", icon: Send },
  { href: "/account/profile", label: "Profile", icon: User },
];

export function AccountMobileNav() {
  const pathname = usePathname();
  return (
    <div className="lg:hidden">
      <div className="flex gap-1 overflow-x-auto rounded-md border border-border/60 p-1">
        {NAV_ITEMS.map((item) => {
          const isActive = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex shrink-0 items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium",
                isActive ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted",
              )}
            >
              <item.icon className="size-4" />
              {item.label}
            </Link>
          );
        })}
      </div>
    </div>
  );
}

export function AccountSidebarNav() {
  const pathname = usePathname();
  return (
    <aside className="hidden lg:block lg:w-56 lg:shrink-0">
      <nav className="sticky top-4 space-y-1 rounded-lg border border-border/60 bg-card/40 p-2">
        {NAV_ITEMS.map((item) => {
          const isActive = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-2.5 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                isActive ? "bg-primary text-primary-foreground" : "text-foreground/90 hover:bg-muted",
              )}
            >
              <item.icon className="size-4" />
              {item.label}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
