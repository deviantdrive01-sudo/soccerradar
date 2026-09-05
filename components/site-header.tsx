import Link from "next/link";
import { BarChart3, Goal } from "lucide-react";
import { ThemeToggle } from "@/components/theme-toggle";

export function SiteHeader() {
  return (
    <header className="border-b border-border/60 bg-background">
      <div className="mx-auto flex w-full max-w-6xl items-center justify-between px-4 py-3">
        <Link href="/" className="flex items-center gap-2">
          <div className="flex size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <Goal className="size-4.5" />
          </div>
          <span className="text-lg font-bold tracking-tight">SoccerRadar</span>
        </Link>
        <div className="flex items-center gap-1">
          <Link
            href="/accuracy"
            className="flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            <BarChart3 className="size-4" />
            Track Record
          </Link>
          <ThemeToggle />
        </div>
      </div>
    </header>
  );
}
