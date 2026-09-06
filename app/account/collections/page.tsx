import { redirect } from "next/navigation";
import Link from "next/link";
import { getCurrentUser } from "@/lib/account/dal";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createCollection, deleteCollection } from "./actions";
import { AccountCreateForm } from "@/components/account-create-form";
import { AccountDeleteButton } from "@/components/account-delete-button";

export const dynamic = "force-dynamic";

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
    <div className="flex max-w-2xl flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">My Collections</h1>
        <p className="text-sm text-muted-foreground">Named groups of predictions you can share with a link.</p>
      </div>

      <AccountCreateForm action={createCollection} placeholder="New collection name" />

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
              <AccountDeleteButton action={deleteCollection} id={c.id} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
