import { ADMIN_STATUS_BADGE_ACTIVE, ADMIN_STATUS_BADGE_INACTIVE } from "@/lib/admin/list-styles";

/** The Public/Private (bookings), Featured/Not (matches) style pill used across every admin list page. */
export function AdminStatusBadge({ active, activeLabel, inactiveLabel }: { active: boolean; activeLabel: string; inactiveLabel: string }) {
  return <span className={active ? ADMIN_STATUS_BADGE_ACTIVE : ADMIN_STATUS_BADGE_INACTIVE}>{active ? activeLabel : inactiveLabel}</span>;
}
