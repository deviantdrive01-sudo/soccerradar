import { verifySession } from "@/lib/admin/dal";
import { logout } from "@/app/admin/actions";
import { AdminNav } from "@/components/admin-nav";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await verifySession();

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-6 px-4 py-6">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-border/60 pb-4">
        <AdminNav />
        <div className="flex items-center gap-3 text-sm text-muted-foreground">
          <span>{session.email}</span>
          <form action={logout}>
            <button type="submit" className="rounded-md border border-border/60 px-2.5 py-1 text-xs font-medium hover:bg-muted/60">
              Sign out
            </button>
          </form>
        </div>
      </header>
      {children}
    </div>
  );
}
