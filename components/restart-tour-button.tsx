"use client";

import { usePathname, useRouter } from "next/navigation";
import { TOUR_REQUEST_EVENT } from "@/components/product-tour";

export function RestartTourButton() {
  const pathname = usePathname();
  const router = useRouter();

  function handleClick() {
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
    <button
      type="button"
      onClick={handleClick}
      className="font-medium text-foreground/80 underline underline-offset-2 hover:text-foreground"
    >
      Take the tour
    </button>
  );
}
