"use client";

import { useSyncExternalStore } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import {
  subscribeNavigatedWithinApp,
  getNavigatedWithinAppSnapshot,
  getNavigatedWithinAppServerSnapshot,
} from "@/lib/app-navigation-history";

const LINK_CLASS = "inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-foreground";

/**
 * A "back" link that actually goes back to wherever the user came from
 * (Top Mixes, search, My Mixes, anywhere) instead of a guessed fixed
 * destination. Falls back to fallbackHref/fallbackLabel for a direct visit
 * with no in-app history to return to, so it's never a dead end.
 */
export function BackLink({ fallbackHref, fallbackLabel }: { fallbackHref: string; fallbackLabel: string }) {
  const router = useRouter();
  const hasNavigated = useSyncExternalStore(
    subscribeNavigatedWithinApp,
    getNavigatedWithinAppSnapshot,
    getNavigatedWithinAppServerSnapshot,
  );

  if (hasNavigated) {
    return (
      <button type="button" onClick={() => router.back()} className={LINK_CLASS}>
        <ArrowLeft className="size-4" />
        Back
      </button>
    );
  }

  return (
    <Link href={fallbackHref} className={LINK_CLASS}>
      <ArrowLeft className="size-4" />
      {fallbackLabel}
    </Link>
  );
}
