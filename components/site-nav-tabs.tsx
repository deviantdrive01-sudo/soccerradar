"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const TABS = [
  { href: "/accuracy", label: "Track Record" },
  { href: "/top-bookings", label: "Top Bookings" },
] as const;

/** Segmented pill-tab nav (desktop/tablet only — see MobileNavDrawer for the phone equivalent). */
export function SiteNavTabs() {
  const pathname = usePathname();

  return (
    <nav className="order-2 hidden shrink-0 items-center gap-0.5 rounded-full bg-muted p-1 sm:flex">
      {TABS.map((tab) => {
        const active = pathname.startsWith(tab.href);
        return (
          <Link
            key={tab.href}
            href={tab.href}
            data-tour={tab.href === "/accuracy" ? "track-record" : undefined}
            className={cn(
              "rounded-full px-3 py-1.5 text-sm font-medium whitespace-nowrap transition-colors",
              active ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground",
            )}
          >
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
