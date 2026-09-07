import Link from "next/link";
import { ThemeToggle } from "@/components/theme-toggle";
import { HeaderSearch } from "@/components/header-search";
import { HeaderAccount } from "@/components/header-account";
import { SiteNavTabs } from "@/components/site-nav-tabs";
import { TelegramIcon } from "@/components/share-buttons";

const TELEGRAM_URL = "https://t.me/socceradar";

export function SiteHeader() {
  return (
    <header className="border-b border-border/60 bg-background">
      <div className="mx-auto flex w-full max-w-6xl flex-wrap items-center gap-2 px-4 py-3 sm:gap-3 sm:flex-nowrap">
        <Link href="/" className="order-1 flex shrink-0 items-center">
          {/* eslint-disable-next-line @next/next/no-img-element -- static SVG, no next/image benefit */}
          <img src="/logo-light.svg" alt="SoccerRadar" className="h-8 w-auto dark:hidden" />
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo-dark.svg" alt="SoccerRadar" className="hidden h-8 w-auto dark:block" />
        </Link>

        <SiteNavTabs />

        <div className="order-4 w-full sm:order-3 sm:w-auto sm:max-w-sm sm:flex-1">
          <HeaderSearch />
        </div>

        <div className="order-2 ml-auto flex shrink-0 items-center gap-1 sm:order-4">
          {/* Icon-only on mobile so the CTA is visible without opening the
              menu drawer; full pill with label from sm+. Both pulse with the
              same ring so the button reads as "alive" and gets noticed. */}
          <a
            href={TELEGRAM_URL}
            target="_blank"
            rel="noopener noreferrer"
            aria-label="Join our Telegram community"
            className="relative flex size-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary transition-colors hover:bg-primary/20 sm:hidden"
          >
            <span className="absolute inset-0 animate-[ping_1.8s_cubic-bezier(0,0,0.2,1)_infinite] rounded-full bg-primary/30 motion-reduce:hidden" />
            <TelegramIcon className="relative size-4" />
          </a>
          <a
            href={TELEGRAM_URL}
            target="_blank"
            rel="noopener noreferrer"
            aria-label="Join our Telegram community"
            className="relative hidden items-center gap-1.5 rounded-full bg-primary/10 px-3 py-1.5 text-sm font-medium text-primary transition-colors hover:bg-primary/20 sm:flex"
          >
            <span className="absolute inset-0 animate-[ping_1.8s_cubic-bezier(0,0,0.2,1)_infinite] rounded-full bg-primary/30 motion-reduce:hidden" />
            <TelegramIcon className="relative size-4" />
            <span className="relative">Join our Community</span>
          </a>
          <ThemeToggle />
          <HeaderAccount />
        </div>
      </div>
    </header>
  );
}
