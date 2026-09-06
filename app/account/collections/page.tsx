import { redirect } from "next/navigation";
import Link from "next/link";
import { getCurrentUser } from "@/lib/account/dal";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createCollection, deleteCollection } from "./actions";

export const dynamic = "force-dynamic";

const FIELD = "h-9 flex-1 rounded-md border border-border/60 bg-background px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50";

async function createCollectionAction(formData: FormData) {
  "use server";
  const title = String(formData.get("title") ?? "");
  if (title.trim()) await createCollection(title);
}

async function deleteCollectionAction(formData: FormData) {
  "use server";
  const id = Number(formData.get("id"));
  if (Number.isFinite(id)) await deleteCollection(id);
}

export default async function CollectionsPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const supabase = await createSupabaseServerClient();
  const { data: collections } = await supabase
    .from("bookmark_collections")
    .select("id, title, created_at")
    .eq("user_id", user.userId)
    .order("created_at", { ascending: false });

  const collectionIds = (collections ?? []).map((c) => c.id);
  const { data: items } =
    collectionIds.length > 0
      ? await supabase.from("bookmark_collection_items").select("collection_id").in("collection_id", collectionIds)
      : { data: [] as { collection_id: number }[] };

  const itemCountByCollection = new Map<number, number>();
  for (const item of items ?? []) {
    itemCountByCollection.set(item.collection_id, (itemCountByCollection.get(item.collection_id) ?? 0) + 1);
  }

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-6 px-4 py-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">My Collections</h1>
        <p className="text-sm text-muted-foreground">Named groups of predictions you can share with a link.</p>
      </div>

      <form action={createCollectionAction} className="flex items-center gap-2">
        <input name="title" placeholder="New collection name" required className={FIELD} />
        <button
          type="submit"
          className="h-9 shrink-0 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/90"
        >
          Create
        </button>
      </form>

      {(collections ?? []).length === 0 ? (
        <p className="text-sm text-muted-foreground">No collections yet — create one above.</p>
      ) : (
        <div className="divide-y divide-border/60 rounded-md border border-border/60">
          {(collections ?? []).map((c) => (
            <div key={c.id} className="flex items-center justify-between gap-2 px-3 py-2.5">
              <Link href={`/collections/${c.id}`} className="min-w-0 flex-1">
                <div className="truncate text-sm font-medium hover:text-primary hover:underline">{c.title}</div>
                <div className="text-xs text-muted-foreground">
                  {itemCountByCollection.get(c.id) ?? 0} match{itemCountByCollection.get(c.id) === 1 ? "" : "es"}
                </div>
              </Link>
              <form action={deleteCollectionAction}>
                <input type="hidden" name="id" value={c.id} />
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
    </main>
  );
}
