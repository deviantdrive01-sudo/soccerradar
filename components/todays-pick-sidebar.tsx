import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { QUICK_FILTER_OPTIONS } from "@/lib/quick-filter";

/** Sidebar entry point to the shareable /top-picks/[slug] collections — see components/top-picks-view.tsx. */
export function TodaysPickSidebar() {
  return (
    <nav data-tour="todays-pick" className="overflow-hidden rounded-lg border border-border/60 bg-card/40">
      <div className="bg-primary px-3 py-2.5 text-sm font-semibold text-primary-foreground">Todays Pick</div>
      <div className="divide-y divide-border/60">
        {QUICK_FILTER_OPTIONS.map((option) => (
          <Link
            key={option.value}
            href={`/top-picks/${option.slug}`}
            className="flex items-center justify-between px-3 py-2.5 text-sm font-medium text-foreground/90 transition-colors hover:bg-muted"
          >
            {option.collectionTitle}
            <ArrowRight className="size-4 shrink-0 text-muted-foreground" />
          </Link>
        ))}
      </div>
    </nav>
  );
}
