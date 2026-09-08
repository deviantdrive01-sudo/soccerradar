/**
 * Shared layout classes for an admin list page's dual layout — stacked
 * cards under the `sm` breakpoint (640px), a table above it. Established by
 * /admin/mixes; every admin list page (mixes, matches, and whatever
 * comes next) should build on these instead of re-typing the same classes.
 * Each page still owns its own columns/fields — only the surrounding
 * structure and status-pill styling are shared.
 */
export const ADMIN_MOBILE_LIST = "space-y-3 sm:hidden";
export const ADMIN_CARD = "space-y-3 rounded-md border border-border/60 p-3";

export const ADMIN_TABLE_WRAPPER = "hidden overflow-x-auto rounded-md border border-border/60 sm:block";
export const ADMIN_TABLE = "w-full text-sm";
export const ADMIN_TH = "p-2 font-medium";
export const ADMIN_TH_LEFT = `${ADMIN_TH} text-left`;
export const ADMIN_TD = "p-2";
export const ADMIN_ROW_BORDER = "border-b border-border/60 last:border-0";
export const ADMIN_HEADER_ROW = "border-b border-border/60 text-left text-muted-foreground";

export const ADMIN_STATUS_BADGE_ACTIVE = "rounded-full border border-primary/40 px-2 py-0.5 text-[10px] font-medium text-primary";
export const ADMIN_STATUS_BADGE_INACTIVE = "rounded-full border border-border/60 px-2 py-0.5 text-[10px] font-medium text-muted-foreground";
