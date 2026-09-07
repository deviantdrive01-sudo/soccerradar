"use client";

import { usePathname, useRouter } from "next/navigation";
import { TOUR_REQUEST_EVENT } from "@/components/product-tour";

const DEFAULT_CLASS = "font-medium text-foreground/80 underline underline-offset-2 hover:text-foreground";

export function RestartTourButton({
  className,
  onNavigate,
  children,
}: {
  className?: string;
  /** Fired right before navigating away/dispatching — lets a caller close its own menu first. */
  onNavigate?: () => void;
  children?: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();

  function handleClick() {
    onNavigate?.();
    if (pathname === "/") {
      window.dispatchEvent(new Event(TOUR_REQUEST_EVENT));
      return;
    }
    try {
      sessionStorage.setItem("soccerradar-tour-requested", "1");
    } catch {
      // If storage is unavailable the click still navigates home, just without auto-starting the tour.
    }
    router.push("/");
  }

  return (
    <button type="button" onClick={handleClick} className={className ?? DEFAULT_CLASS}>
      {children ?? "Take the tour"}
    </button>
  );
}
