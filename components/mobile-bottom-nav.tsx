"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { BarChart3, Compass, Flag, Equal, Goal, Swords, Shuffle, Radio, type LucideIcon } from "lucide-react";
import { TodaysPickIcon, TodaysPickIconFilled, BookingsIcon, CollectionsIcon, MoreMenuIcon } from "@/components/bottom-nav-icons";
import { RestartTourButton } from "@/components/restart-tour-button";
import { QUICK_FILTER_OPTIONS, type QuickFilter } from "@/lib/quick-filter";
import { cn } from "cn";

const PANEL_ROW_CLASS = "flex w-full items-center gap-3 rounded-lg px-2 py-2.5 text-left text-sm font-medium hover:bg-white/10";
const PANEL_CLASS =
  "fixed inset-x-4 bottom-24 z-50 max-h-[60vh] overflow-y-auto rounded-2xl bg-[#063B09] p-3 text-white shadow-xl dark:bg-neutral-900 sm:hidden";

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

type OpenPanel = "more" | null;

/**
 * Site-wide phone tab bar — replaces the old hamburger drawer entirely. The
 * header still keeps its own avatar/community/theme controls. Live and
 * Predictions are direct links (Live is the homepage since the 2026-09
 * fixtures/live-scores pivot); Mixes is a direct link; More holds everything
 * else (Today's Pick shortcuts, Collections, My Mixes, Track Record, the
 * tour) — folded in here so the bar stays at four slots instead of growing
 * to five.
 */
export function MobileBottomNav() {
  const pathname = usePathname();
  const [openPanel, setOpenPanel] = useState<OpenPanel>(null);

  const liveActive = pathname === "/";
  const predictionsActive = pathname.startsWith("/predictions");
  const mixesActive = pathname.startsWith("/top-mixes");

  function togglePanel(panel: OpenPanel) {
    setOpenPanel((current) => (current === panel ? null : panel));
  }

  return (
    <>
      {openPanel && (
        <>
          <div className="fixed inset-0 z-40 bg-black/40 sm:hidden" onClick={() => setOpenPanel(null)} />

          {openPanel === "more" && (
            <div className={PANEL_CLASS}>
              <nav className="flex flex-col">
                {QUICK_FILTER_OPTIONS.map((option) => {
                  const Icon = FILTER_ICONS[option.value] ?? Goal;
                  return (
                    <Link
                      key={option.value}
                      href={`/top-picks/${option.slug}`}
                      onClick={() => setOpenPanel(null)}
                      className={PANEL_ROW_CLASS}
                    >
                      <Icon className="size-4 shrink-0" />
                      {option.collectionTitle}
                    </Link>
                  );
                })}
                <Link href="/account/collections" onClick={() => setOpenPanel(null)} className={PANEL_ROW_CLASS}>
                  <CollectionsIcon className="size-4 shrink-0" />
                  Collections
                </Link>
                <Link href="/account/mixes" onClick={() => setOpenPanel(null)} className={PANEL_ROW_CLASS}>
                  <BookingsIcon className="size-4 shrink-0" />
                  My Mixes
                </Link>
                <Link href="/accuracy" onClick={() => setOpenPanel(null)} className={PANEL_ROW_CLASS}>
                  <BarChart3 className="size-4 shrink-0" />
                  Track Record
                </Link>
                <RestartTourButton className={PANEL_ROW_CLASS} onNavigate={() => setOpenPanel(null)}>
                  <Compass className="size-4 shrink-0" />
                  Take the tour
                </RestartTourButton>
              </nav>
            </div>
          )}
        </>
      )}

      <nav
        data-tour="bottom-nav"
        className="fixed inset-x-4 bottom-4 z-40 flex items-stretch justify-between rounded-2xl border border-border/60 bg-card shadow-lg sm:hidden"
        style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
      >
        <Link href="/" className={TAB_CLASS} aria-label="Live" aria-current={liveActive ? "page" : undefined}>
          <span
            className={cn(
              "flex size-8 items-center justify-center rounded-full",
              liveActive ? "bg-primary text-primary-foreground" : "text-muted-foreground",
            )}
          >
            <Radio className="size-4" />
          </span>
        </Link>

        <Link href="/predictions" className={TAB_CLASS} aria-label="Predictions" aria-current={predictionsActive ? "page" : undefined}>
          <span
            className={cn(
              "flex size-8 items-center justify-center rounded-full",
              predictionsActive ? "bg-primary text-primary-foreground" : "text-muted-foreground",
            )}
          >
            {predictionsActive ? <TodaysPickIconFilled className="size-4" /> : <TodaysPickIcon className="size-4" />}
          </span>
        </Link>

        <Link href="/top-mixes" className={TAB_CLASS} aria-label="Mixes" aria-current={mixesActive ? "page" : undefined}>
          <span
            className={cn(
              "flex size-8 items-center justify-center rounded-full",
              mixesActive ? "bg-primary text-primary-foreground" : "text-muted-foreground",
            )}
          >
            <BookingsIcon className="size-4" />
          </span>
        </Link>

        <button
          type="button"
          onClick={() => togglePanel("more")}
          className={TAB_CLASS}
          aria-label="More"
          aria-expanded={openPanel === "more"}
        >
          <span
            className={cn(
              "flex size-8 items-center justify-center rounded-full",
              openPanel === "more" ? "bg-primary text-primary-foreground" : "text-muted-foreground",
            )}
          >
            <MoreMenuIcon className="size-3.5" />
          </span>
        </button>
      </nav>
    </>
  );
}
