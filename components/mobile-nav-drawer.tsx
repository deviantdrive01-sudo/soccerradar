"use client";

import { useState } from "react";
import Link from "next/link";
import { Menu, X, BarChart3, Trophy, ChevronDown, Flag, Equal, Goal, Swords, Shuffle, type LucideIcon } from "lucide-react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { TelegramIcon } from "@/components/share-buttons";
import { QUICK_FILTER_OPTIONS, type QuickFilter } from "@/lib/quick-filter";

const TELEGRAM_URL = "https://t.me/socceradar";

const LINK_CLASS =
  "flex items-center gap-2.5 rounded-md px-3 py-2.5 text-sm font-medium text-foreground hover:bg-muted";

const FILTER_ICONS: Partial<Record<QuickFilter, LucideIcon>> = {
  cornersO7_5Yes: Flag,
  halfDrawYes: Equal,
  over1_5Yes: Goal,
  over2_5Yes: Goal,
  winEitherYes: Swords,
  ftDrawYes: Equal,
  drawOrOverYes: Shuffle,
};

/** Phone-only hamburger + slide-out drawer — see SiteNavTabs for the sm+ pill-nav equivalent. */
export function MobileNavDrawer() {
  const [open, setOpen] = useState(false);

  return (
    <div className="sm:hidden">
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Open menu"
        className="flex items-center justify-center rounded-md px-2 py-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
      >
        <Menu className="size-5" />
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40 bg-black/40" onClick={() => setOpen(false)} />
          <div className="fixed inset-y-0 right-0 z-50 flex w-72 max-w-[85vw] flex-col overflow-y-auto border-l border-border/60 bg-background p-2">
            <div className="flex items-center justify-between px-2 py-2">
              <span className="text-sm font-semibold">Menu</span>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Close menu"
                className="flex size-8 items-center justify-center rounded-md hover:bg-muted"
              >
                <X className="size-4" />
              </button>
            </div>

            <nav className="flex flex-col gap-0.5 py-1">
              <Link href="/top-bookings" className={LINK_CLASS} onClick={() => setOpen(false)}>
                <Trophy className="size-4 text-muted-foreground" />
                Top Bookings
              </Link>
              <Link href="/accuracy" className={LINK_CLASS} onClick={() => setOpen(false)}>
                <BarChart3 className="size-4 text-muted-foreground" />
                Track Record
              </Link>
              <a href={TELEGRAM_URL} target="_blank" rel="noopener noreferrer" className={LINK_CLASS}>
                <TelegramIcon className="size-4 text-muted-foreground" />
                Join our Community
              </a>

              <Collapsible defaultOpen>
                <CollapsibleTrigger className={`${LINK_CLASS} w-full justify-between`}>
                  <span>Today&apos;s Pick</span>
                  <ChevronDown className="size-4 text-muted-foreground" />
                </CollapsibleTrigger>
                <CollapsibleContent className="flex flex-col gap-0.5 pl-6">
                  {QUICK_FILTER_OPTIONS.map((option) => {
                    const Icon = FILTER_ICONS[option.value] ?? Goal;
                    return (
                      <Link
                        key={option.value}
                        href={`/top-picks/${option.slug}`}
                        onClick={() => setOpen(false)}
                        className="flex items-center gap-2.5 rounded-md px-3 py-2 text-sm text-muted-foreground hover:bg-muted hover:text-foreground"
                      >
                        <Icon className="size-4" />
                        {option.collectionTitle}
                      </Link>
                    );
                  })}
                </CollapsibleContent>
              </Collapsible>
            </nav>
          </div>
        </>
      )}
    </div>
  );
}
