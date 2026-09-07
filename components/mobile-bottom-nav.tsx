"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { BarChart3, Compass, Flag, Equal, Goal, Swords, Shuffle, type LucideIcon } from "lucide-react";
import { TodaysPickIcon, TodaysPickIconFilled, BookingsIcon, CollectionsIcon, CollectionsIconFilled, MoreMenuIcon } from "@/components/bottom-nav-icons";
import { RestartTourButton } from "@/components/restart-tour-button";
import { QUICK_FILTER_OPTIONS, type QuickFilter } from "@/lib/quick-filter";
import { cn } from "cn";

const MORE_ROW_CLASS = "flex w-full items-center gap-3 rounded-lg px-2 py-2.5 text-left text-sm font-medium hover:bg-white/10";

const FILTER_ICONS: Partial<Record<QuickFilter, LucideIcon>> = {
  cornersO7_5Yes: Flag,
  halfDrawYes: Equal,
  over1_5Yes: Goal,
  over2_5Yes: Goal,
  winEitherYes: Swords,
  ftDrawYes: Equal,
  drawOrOverYes: Shuffle,
};

const TAB_CLASS = "flex flex-1 flex-col items-center justify-center gap-1 py-4";

/**
 * Site-wide phone tab bar — replaces the old hamburger drawer entirely. The
 * header still keeps its own avatar/community/theme controls; everything
 * else that used to live in that drawer (Top Bookings dropped, Track Record
 * + the Today's Pick quick filters) now lives behind the "More" tab here.
 */
export function MobileBottomNav() {
  const pathname = usePathname();
  const [moreOpen, setMoreOpen] = useState(false);

  const todaysPickActive = pathname.startsWith("/top-bookings");
  const bookingsActive = pathname.startsWith("/account/bookings");
  const collectionsActive = pathname.startsWith("/account/collections");

  return (
    <>
      {moreOpen && (
        <>
          <div className="fixed inset-0 z-40 bg-black/40 sm:hidden" onClick={() => setMoreOpen(false)} />
          <div className="fixed inset-x-4 bottom-24 z-50 max-h-[60vh] overflow-y-auto rounded-2xl bg-[#063B09] p-3 text-white shadow-xl dark:bg-neutral-900 sm:hidden">
            <nav className="flex flex-col">
              {QUICK_FILTER_OPTIONS.map((option) => {
                const Icon = FILTER_ICONS[option.value] ?? Goal;
                return (
                  <Link
                    key={option.value}
                    href={`/top-picks/${option.slug}`}
                    onClick={() => setMoreOpen(false)}
                    className="flex items-center gap-3 rounded-lg px-2 py-2.5 text-sm font-medium hover:bg-white/10"
                  >
                    <Icon className="size-4 shrink-0" />
                    {option.collectionTitle}
                  </Link>
                );
              })}
              <div className="my-1.5 border-t border-white/20" />
              <Link
                href="/accuracy"
                onClick={() => setMoreOpen(false)}
                className="flex items-center gap-3 rounded-lg px-2 py-2.5 text-sm font-medium hover:bg-white/10"
              >
                <BarChart3 className="size-4 shrink-0" />
                Track Record
              </Link>
              <RestartTourButton className={MORE_ROW_CLASS} onNavigate={() => setMoreOpen(false)}>
                <Compass className="size-4 shrink-0" />
                Take the tour
              </RestartTourButton>
            </nav>
          </div>
        </>
      )}

      <nav
        data-tour="bottom-nav"
        className="fixed inset-x-4 bottom-4 z-40 flex items-stretch justify-between rounded-2xl border border-border/60 bg-card shadow-lg sm:hidden"
        style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
      >
        <Link href="/top-bookings" className={TAB_CLASS} aria-label="Top Bookings" aria-current={todaysPickActive ? "page" : undefined}>
          <span
            className={cn(
              "flex size-8 items-center justify-center rounded-full",
              todaysPickActive ? "bg-primary text-primary-foreground" : "text-muted-foreground",
            )}
          >
            {todaysPickActive ? <TodaysPickIconFilled className="size-4" /> : <TodaysPickIcon className="size-4" />}
          </span>
        </Link>

        <Link href="/account/bookings" className={TAB_CLASS} aria-label="My Bookings" aria-current={bookingsActive ? "page" : undefined}>
          <span
            className={cn(
              "flex size-8 items-center justify-center rounded-full",
              bookingsActive ? "bg-primary text-primary-foreground" : "text-muted-foreground",
            )}
          >
            <BookingsIcon className="size-4" />
          </span>
        </Link>

        <Link
          href="/account/collections"
          className={TAB_CLASS}
          aria-label="Collections"
          aria-current={collectionsActive ? "page" : undefined}
        >
          <span
            className={cn(
              "flex size-8 items-center justify-center rounded-full",
              collectionsActive ? "bg-primary text-primary-foreground" : "text-muted-foreground",
            )}
          >
            {collectionsActive ? <CollectionsIconFilled className="size-4" /> : <CollectionsIcon className="size-4" />}
          </span>
        </Link>

        <button
          type="button"
          onClick={() => setMoreOpen((v) => !v)}
          className={TAB_CLASS}
          aria-label="More"
          aria-expanded={moreOpen}
        >
          <span
            className={cn(
              "flex size-8 items-center justify-center rounded-full",
              moreOpen ? "bg-primary text-primary-foreground" : "text-muted-foreground",
            )}
          >
            <MoreMenuIcon className="size-3.5" />
          </span>
        </button>
      </nav>
    </>
  );
}
