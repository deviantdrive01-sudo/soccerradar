import { redirect } from "next/navigation";
import Link from "next/link";
import { getCurrentUser } from "@/lib/account/dal";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createBooker, deleteBooker } from "./actions";

export const dynamic = "force-dynamic";

const FIELD = "h-9 flex-1 rounded-md border border-border/60 bg-background px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50";

async function createBookerAction(formData: FormData) {
  "use server";
  const title = String(formData.get("title") ?? "");
  if (title.trim()) await createBooker(title);
}

async function deleteBookerAction(formData: FormData) {
  "use server";
  const id = Number(formData.get("id"));
  if (Number.isFinite(id)) await deleteBooker(id);
}

export default async function BookersPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const supabase = await createSupabaseServerClient();
  const { data: bookers } = await supabase
    .from("bookers")
    .select("id, title, created_at")
    .eq("user_id", user.userId)
    .order("created_at", { ascending: false });

  const bookerIds = (bookers ?? []).map((b) => b.id);
  const { data: items } =
    bookerIds.length > 0
      ? await supabase.from("booker_items").select("booker_id").in("booker_id", bookerIds)
      : { data: [] as { booker_id: number }[] };

  const itemCountByBooker = new Map<number, number>();
  for (const item of items ?? []) {
    itemCountByBooker.set(item.booker_id, (itemCountByBooker.get(item.booker_id) ?? 0) + 1);
  }

  return (
    <div className="flex max-w-2xl flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">My Bookers</h1>
        <p className="text-sm text-muted-foreground">
          Pick a specific market from any match — not the whole prediction — and mix picks from different matches
          into one shareable slip. Experimental, separate from Collections.
        </p>
      </div>

      <form action={createBookerAction} className="flex items-center gap-2">
        <input name="title" placeholder="New booker name" required className={FIELD} />
        <button
          type="submit"
          className="h-9 shrink-0 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/90"
        >
          Create
        </button>
      </form>

      {(bookers ?? []).length === 0 ? (
        <p className="text-sm text-muted-foreground">No bookers yet — create one above.</p>
      ) : (
        <div className="divide-y divide-border/60 rounded-md border border-border/60">
          {(bookers ?? []).map((b) => (
            <div key={b.id} className="flex items-center justify-between gap-2 px-3 py-2.5">
              <Link href={`/bookers/${b.id}`} className="min-w-0 flex-1">
                <div className="truncate text-sm font-medium hover:text-primary hover:underline">{b.title}</div>
                <div className="text-xs text-muted-foreground">
                  {itemCountByBooker.get(b.id) ?? 0} pick{itemCountByBooker.get(b.id) === 1 ? "" : "s"}
                </div>
              </Link>
              <form action={deleteBookerAction}>
                <input type="hidden" name="id" value={b.id} />
                <button
                  type="submit"
                  className="h-8 shrink-0 rounded-md border border-border/60 px-2.5 text-xs font-medium hover:bg-muted/60"
                >
                  Delete
                </button>
              </form>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
