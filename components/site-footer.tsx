import Link from "next/link";
import { RestartTourButton } from "@/components/restart-tour-button";

export function SiteFooter() {
  return (
    <footer className="border-t border-border/60 bg-background">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-2 px-4 py-6 text-xs text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
        <p>
          Predictions are statistical estimates based on form and performance data — not guarantees. Not betting or
          financial advice.{" "}
          <Link href="/accuracy" className="font-medium text-foreground/80 underline underline-offset-2 hover:text-foreground">
            See our track record
          </Link>
          .
        </p>
        <div className="flex shrink-0 items-center gap-3">
          <RestartTourButton />
          <Link href="/privacy" className="font-medium text-foreground/80 underline underline-offset-2 hover:text-foreground">
            Privacy Policy
          </Link>
        </div>
      </div>
    </footer>
  );
}
