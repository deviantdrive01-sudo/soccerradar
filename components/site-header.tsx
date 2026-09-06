import Link from "next/link";
import { BarChart3, Goal } from "lucide-react";
import { ThemeToggle } from "@/components/theme-toggle";
import { HeaderSearch } from "@/components/header-search";
import { HeaderAccount } from "@/components/header-account";

export function SiteHeader() {
  return (
    <header className="border-b border-border/60 bg-background">
      <div className="mx-auto flex w-full max-w-6xl flex-wrap items-center gap-3 px-4 py-3 sm:flex-nowrap">
        <Link href="/" className="order-1 flex shrink-0 items-center gap-2">
          <div className="flex size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <Goal className="size-4.5" />
          </div>
          <span className="text-lg font-bold tracking-tight">SoccerRadar</span>
        </Link>

        <div className="order-3 w-full sm:order-2 sm:w-auto sm:max-w-sm sm:flex-1">
          <HeaderSearch />
        </div>

        <div className="order-2 ml-auto flex shrink-0 items-center gap-1 sm:order-3">
          <Link
            href="/accuracy"
            className="flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            <BarChart3 className="size-4" />
            Track Record
          </Link>
          <ThemeToggle />
          <HeaderAccount />
        </div>
      </div>
    </header>
  );
}
