import type { LucideIcon } from "lucide-react";
import { LayoutDashboard, Trophy, CalendarClock, Send, MousePointerClick, Image as ImageIcon, Palette, Users, Shuffle } from "lucide-react";

export interface AdminNavItem {
  href: string;
  label: string;
  icon: LucideIcon;
}

/** Single source of truth for admin nav — shared by the horizontal (mobile) and sidebar (desktop) nav components. */
export const ADMIN_NAV_ITEMS: AdminNavItem[] = [
  { href: "/admin", label: "Overview", icon: LayoutDashboard },
  { href: "/admin/leagues", label: "Leagues", icon: Trophy },
  { href: "/admin/matches", label: "Matches", icon: CalendarClock },
  { href: "/admin/telegram", label: "Telegram", icon: Send },
  { href: "/admin/ads", label: "Ads", icon: MousePointerClick },
  { href: "/admin/banner", label: "Banner", icon: ImageIcon },
  { href: "/admin/templates", label: "Templates", icon: Palette },
  { href: "/admin/users", label: "Users", icon: Users },
  { href: "/admin/mixes", label: "Mixes", icon: Shuffle },
];
