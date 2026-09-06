import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/account/dal";
import { UsernameForm, PasswordForm } from "@/components/account-profile-forms";

export const dynamic = "force-dynamic";

export default async function ProfilePage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Profile</h1>
        <p className="text-sm text-muted-foreground">{user.email}</p>
      </div>

      <UsernameForm currentUsername={user.username} />
      <PasswordForm />
    </div>
  );
}
