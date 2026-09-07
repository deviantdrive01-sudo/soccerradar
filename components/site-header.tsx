import Link from "next/link";
import { Goal } from "lucide-react";
import { ThemeToggle } from "@/components/theme-toggle";
import { HeaderSearch } from "@/components/header-search";
import { HeaderAccount } from "@/components/header-account";
import { SiteNavTabs } from "@/components/site-nav-tabs";
import { MobileNavDrawer } from "@/components/mobile-nav-drawer";
import { TelegramIcon } from "@/components/share-buttons";

const TELEGRAM_URL = "https://t.me/socceradar";

export function SiteHeader() {
  return (
    <header className="border-b border-border/60 bg-background">
      <div className="mx-auto flex w-full max-w-6xl flex-wrap items-center gap-2 px-4 py-3 sm:gap-3 sm:flex-nowrap">
        <Link href="/" className="order-1 flex shrink-0 items-center gap-2">
          <div className="flex size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <Goal className="size-4.5" />
          </div>
          <span className="text-lg font-bold tracking-tight">SoccerRadar</span>
        </Link>

        <SiteNavTabs />

        <div className="order-4 w-full sm:order-3 sm:w-auto sm:max-w-sm sm:flex-1">
          <HeaderSearch />
        </div>

        <div className="order-2 ml-auto flex shrink-0 items-center gap-1 sm:order-4">
          <MobileNavDrawer />
          <a
            href={TELEGRAM_URL}
            target="_blank"
            rel="noopener noreferrer"
            aria-label="Join our Telegram community"
            className="hidden items-center gap-1.5 rounded-md px-2 py-1.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground sm:flex sm:px-3"
          >
            <TelegramIcon className="size-4" />
            <span className="hidden sm:inline">Join our Community</span>
          </a>
          <ThemeToggle />
          <HeaderAccount />
        </div>
      </div>
    </header>
  );
}
