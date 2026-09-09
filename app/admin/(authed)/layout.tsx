import { verifySession } from "@/lib/admin/dal";
import { logout } from "@/app/admin/actions";
import { AdminNav } from "@/components/admin-nav";
import { AdminSidebarNav } from "@/components/admin-sidebar-nav";
import { Avatar } from "@/components/avatar";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await verifySession();
  const roleLabel = session.role.replace("_", " ");

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-1 gap-6 px-4 py-6">
      <aside className="hidden w-56 shrink-0 flex-col sm:flex">
        <AdminSidebarNav />
        <div className="mt-auto flex flex-col gap-2">
          <div className="flex items-center gap-3 rounded-2xl border border-border/60 bg-card/80 p-3">
            <Avatar avatarUrl={session.avatarUrl} username={session.username} size="size-9" textSize="text-sm" />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold">{session.username ?? <span className="capitalize">{roleLabel}</span>}</p>
              <p className="truncate text-xs text-muted-foreground">{session.email}</p>
            </div>
          </div>
          <form action={logout}>
            <button
              type="submit"
              className="w-full rounded-lg border border-border/60 px-3 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted/60 hover:text-foreground"
            >
              Sign out
            </button>
          </form>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col gap-6">
        <header className="flex items-center justify-between gap-3 border-b border-border/60 pb-4 sm:hidden">
          <AdminNav />
          <form action={logout}>
            <button type="submit" className="shrink-0 rounded-md border border-border/60 px-2.5 py-1 text-xs font-medium hover:bg-muted/60">
              Sign out
            </button>
          </form>
        </header>
        {children}
      </div>
    </div>
  );
}
