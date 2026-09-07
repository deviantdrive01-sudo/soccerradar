"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import { markNavigatedWithinApp } from "@/lib/app-navigation-history";

/**
 * Mounted once in the root layout — marks the session as "navigated" once
 * the pathname actually changes from what it was last time. Deliberately
 * not a "is this the first effect call" flag: React Strict Mode's dev-only
 * double-invocation of effects on mount would trip that (two calls, same
 * pathname, no real navigation happened) and mark every fresh page load as
 * "navigated". Comparing against the previous pathname is correct either way.
 */
export function NavigationHistoryTracker() {
  const pathname = usePathname();
  const previousPathname = useRef<string | null>(null);

  useEffect(() => {
    if (previousPathname.current !== null && previousPathname.current !== pathname) {
      markNavigatedWithinApp();
    }
    previousPathname.current = pathname;
  }, [pathname]);

  return null;
}
