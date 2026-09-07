import { verifySession } from "@/lib/admin/dal";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { toggleUserBan, updateUserRole } from "./actions";
import { AdminDeleteUserButton } from "@/components/admin-delete-user-button";
import type { ProfileRole } from "@/lib/supabase/types";

export const dynamic = "force-dynamic";

const ROLE_LABELS: Record<ProfileRole, string> = {
  user: "User",
  admin: "Admin",
  super_admin: "Super Admin",
};

function countByUser(rows: { user_id: string }[] | null, into: Map<string, number>) {
  for (const row of rows ?? []) into.set(row.user_id, (into.get(row.user_id) ?? 0) + 1);
}

export default async function AdminUsersPage() {
  const session = await verifySession();
  const isSuperAdmin = session.role === "super_admin";
  const supabase = createAdminSupabaseClient();

  const [{ data: userList }, { data: profiles }] = await Promise.all([
    supabase.auth.admin.listUsers({ perPage: 1000 }),
    supabase.from("profiles").select("id, username, role"),
  ]);

  const users = userList?.users ?? [];
  const profileById = new Map((profiles ?? []).map((p) => [p.id, p]));

  const [{ data: favCountries }, { data: favLeagues }, { data: favMatches }, { data: collections }, { data: bookings }] =
    await Promise.all([
      supabase.from("favorite_countries").select("user_id"),
      supabase.from("favorite_leagues").select("user_id"),
      supabase.from("favorite_matches").select("user_id"),
      supabase.from("bookmark_collections").select("user_id"),
      supabase.from("bookings").select("user_id"),
    ]);

  const favCountByUser = new Map<string, number>();
  countByUser(favCountries, favCountByUser);
  countByUser(favLeagues, favCountByUser);
  countByUser(favMatches, favCountByUser);

  const collectionCountByUser = new Map<string, number>();
  countByUser(collections, collectionCountByUser);

  const bookingCountByUser = new Map<string, number>();
  countByUser(bookings, bookingCountByUser);

  const sortedUsers = [...users].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Users</h1>
        <p className="text-sm text-muted-foreground">
          {users.length} registered account{users.length === 1 ? "" : "s"}.
          {!isSuperAdmin && " You can disable/enable regular user accounts; only a super admin can change roles or delete accounts."}
        </p>
      </div>

      {/* Phone: stacked cards — the table below needs 880px+ to read without horizontal scrolling. */}
      <div className="space-y-3 sm:hidden">
        {sortedUsers.map((u) => {
          const profile = profileById.get(u.id);
          const role: ProfileRole = profile?.role ?? "user";
          const isBanned = !!u.banned_until && new Date(u.banned_until) > new Date();
          const isSelf = u.id === session.userId;
          const canManage = isSuperAdmin || role === "user";

          return (
            <div key={u.id} className="space-y-3 rounded-md border border-border/60 p-3">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="truncate font-medium">{profile?.username ?? "—"}</div>
                  <div className="truncate text-xs text-muted-foreground">{u.email}</div>
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  {role !== "user" && (
                    <span
                      className={
                        role === "super_admin"
                          ? "rounded-full border border-amber-500/40 px-2 py-0.5 text-[10px] font-medium text-amber-500"
                          : "rounded-full border border-primary/40 px-2 py-0.5 text-[10px] font-medium text-primary"
                      }
                    >
                      {ROLE_LABELS[role]}
                    </span>
                  )}
                  {isBanned && (
                    <span className="rounded-full border border-destructive/40 px-2 py-0.5 text-[10px] font-medium text-destructive">
                      Disabled
                    </span>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-4 gap-2 text-sm">
                <div>
                  <div className="text-[10px] uppercase tracking-wide text-muted-foreground">Joined</div>
                  {new Date(u.created_at).toLocaleDateString("en-GB")}
                </div>
                <div>
                  <div className="text-[10px] uppercase tracking-wide text-muted-foreground">Favorites</div>
                  {favCountByUser.get(u.id) ?? 0}
                </div>
                <div>
                  <div className="text-[10px] uppercase tracking-wide text-muted-foreground">Collections</div>
                  {collectionCountByUser.get(u.id) ?? 0}
                </div>
                <div>
                  <div className="text-[10px] uppercase tracking-wide text-muted-foreground">Bookings</div>
                  {bookingCountByUser.get(u.id) ?? 0}
                </div>
              </div>

              {isSelf ? (
                <div className="border-t border-border/60 pt-2 text-xs text-muted-foreground">You</div>
              ) : !canManage ? (
                <div className="border-t border-border/60 pt-2 text-xs text-muted-foreground">
                  Only a super admin can manage this account
                </div>
              ) : (
                <div className="flex flex-wrap items-center gap-1.5 border-t border-border/60 pt-2">
                  <form action={toggleUserBan}>
                    <input type="hidden" name="userId" value={u.id} />
                    <input type="hidden" name="currentlyBanned" value={String(isBanned)} />
                    <button
                      type="submit"
                      className="h-7 rounded-md border border-border/60 px-2 text-xs font-medium hover:bg-muted/60"
                    >
                      {isBanned ? "Enable" : "Disable"}
                    </button>
                  </form>
                  {isSuperAdmin && (
                    <>
                      <form action={updateUserRole} className="flex items-center gap-1">
                        <input type="hidden" name="userId" value={u.id} />
                        <select
                          name="role"
                          defaultValue={role}
                          className="h-7 rounded-md border border-border/60 bg-background px-1.5 text-xs"
                        >
                          <option value="user">User</option>
                          <option value="admin">Admin</option>
                          <option value="super_admin">Super Admin</option>
                        </select>
                        <button
                          type="submit"
                          className="h-7 rounded-md border border-border/60 px-2 text-xs font-medium hover:bg-muted/60"
                        >
                          Save
                        </button>
                      </form>
                      <AdminDeleteUserButton userId={u.id} label={profile?.username ?? u.email ?? "this user"} />
                    </>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* sm+: table */}
      <div className="hidden overflow-x-auto rounded-md border border-border/60 sm:block">
        <table className="w-full min-w-[880px] text-sm">
          <thead>
            <tr className="border-b border-border/60 text-left text-muted-foreground">
              <th className="p-2 font-medium">User</th>
              <th className="p-2 font-medium">Joined</th>
              <th className="p-2 font-medium text-center">Favorites</th>
              <th className="p-2 font-medium text-center">Collections</th>
              <th className="p-2 font-medium text-center">Bookings</th>
              <th className="p-2 font-medium text-center">Status</th>
              <th className="p-2 font-medium text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {sortedUsers.map((u) => {
              const profile = profileById.get(u.id);
              const role: ProfileRole = profile?.role ?? "user";
              const isBanned = !!u.banned_until && new Date(u.banned_until) > new Date();
              const isSelf = u.id === session.userId;
              // A plain admin can only act on regular users, never another admin/super_admin.
              const canManage = isSuperAdmin || role === "user";

              return (
                <tr key={u.id} className="border-b border-border/60 last:border-0">
                  <td className="p-2">
                    <div className="font-medium">{profile?.username ?? "—"}</div>
                    <div className="text-xs text-muted-foreground">{u.email}</div>
                  </td>
                  <td className="p-2 whitespace-nowrap text-muted-foreground">
                    {new Date(u.created_at).toLocaleDateString("en-GB")}
                  </td>
                  <td className="p-2 text-center">{favCountByUser.get(u.id) ?? 0}</td>
                  <td className="p-2 text-center">{collectionCountByUser.get(u.id) ?? 0}</td>
                  <td className="p-2 text-center">{bookingCountByUser.get(u.id) ?? 0}</td>
                  <td className="p-2">
                    <div className="flex items-center justify-center gap-1">
                      {role !== "user" && (
                        <span
                          className={
                            role === "super_admin"
                              ? "rounded-full border border-amber-500/40 px-2 py-0.5 text-[10px] font-medium text-amber-500"
                              : "rounded-full border border-primary/40 px-2 py-0.5 text-[10px] font-medium text-primary"
                          }
                        >
                          {ROLE_LABELS[role]}
                        </span>
                      )}
                      {isBanned && (
                        <span className="rounded-full border border-destructive/40 px-2 py-0.5 text-[10px] font-medium text-destructive">
                          Disabled
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="p-2">
                    {isSelf ? (
                      <div className="text-right text-xs text-muted-foreground">You</div>
                    ) : !canManage ? (
                      <div className="text-right text-xs text-muted-foreground">—</div>
                    ) : (
                      <div className="flex items-center justify-end gap-1.5">
                        <form action={toggleUserBan}>
                          <input type="hidden" name="userId" value={u.id} />
                          <input type="hidden" name="currentlyBanned" value={String(isBanned)} />
                          <button
                            type="submit"
                            className="h-7 rounded-md border border-border/60 px-2 text-xs font-medium hover:bg-muted/60"
                          >
                            {isBanned ? "Enable" : "Disable"}
                          </button>
                        </form>
                        {isSuperAdmin && (
                          <>
                            <form action={updateUserRole} className="flex items-center gap-1">
                              <input type="hidden" name="userId" value={u.id} />
                              <select
                                name="role"
                                defaultValue={role}
                                className="h-7 rounded-md border border-border/60 bg-background px-1.5 text-xs"
                              >
                                <option value="user">User</option>
                                <option value="admin">Admin</option>
                                <option value="super_admin">Super Admin</option>
                              </select>
                              <button
                                type="submit"
                                className="h-7 rounded-md border border-border/60 px-2 text-xs font-medium hover:bg-muted/60"
                              >
                                Save
                              </button>
                            </form>
                            <AdminDeleteUserButton userId={u.id} label={profile?.username ?? u.email ?? "this user"} />
                          </>
                        )}
                      </div>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
