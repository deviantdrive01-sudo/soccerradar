"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import {
  updateProfile,
  updatePasswordSecure,
  signOutOtherSessions,
  type ProfileActionState,
} from "@/app/account/profile/actions";
import { useAccount } from "@/components/account-provider";

const FIELD =
  "h-9 w-full rounded-md border border-border/60 bg-background px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50";
const LABEL = "text-sm font-medium text-foreground/90";
const SAVE_BUTTON =
  "h-8 rounded-md bg-primary px-3 text-xs font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-60";

const initialState: ProfileActionState = {};

function SectionShell({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <div className="grid grid-cols-1 gap-4 border-b border-border/60 pb-6 last:border-b-0 lg:grid-cols-3 lg:gap-8">
      <div>
        <h2 className="text-sm font-semibold">{title}</h2>
        <p className="mt-1 text-xs text-muted-foreground">{description}</p>
      </div>
      <div className="lg:col-span-2">{children}</div>
    </div>
  );
}

function StatusMessage({ state }: { state: ProfileActionState }) {
  if (state.error) return <p className="text-xs text-destructive">{state.error}</p>;
  if (state.success) return <p className="text-xs text-emerald-500">{state.success}</p>;
  return null;
}

function initials(username: string | null): string {
  if (!username) return "?";
  return username.slice(0, 2).toUpperCase();
}

export function ProfileInformationForm({
  currentUsername,
  currentEmail,
  currentAvatarUrl,
}: {
  currentUsername: string | null;
  currentEmail: string | null;
  currentAvatarUrl: string | null;
}) {
  const [state, formAction, pending] = useActionState(updateProfile, initialState);
  const { refresh } = useAccount();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(currentAvatarUrl);

  useEffect(() => {
    if (state?.success) refresh();
  }, [state?.success, refresh]);

  return (
    <SectionShell title="Profile Information" description="Update your account's profile information and email address.">
      <form action={formAction} className="space-y-4 rounded-lg border border-border/60 p-4">
        <div className="space-y-2">
          <span className={LABEL}>Photo</span>
          <div className="flex items-center gap-4">
            {preview ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={preview} alt="" className="size-16 rounded-full object-cover" />
            ) : (
              <div className="flex size-16 items-center justify-center rounded-full bg-muted text-lg font-semibold text-muted-foreground">
                {initials(currentUsername)}
              </div>
            )}
            <div>
              <input
                ref={fileInputRef}
                type="file"
                name="photo"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) setPreview(URL.createObjectURL(file));
                }}
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="h-8 rounded-md border border-border/60 px-3 text-xs font-medium hover:bg-muted"
              >
                Select A New Photo
              </button>
            </div>
          </div>
        </div>

        <div className="space-y-1.5">
          <label className={LABEL}>Username</label>
          <input name="username" defaultValue={currentUsername ?? ""} required minLength={3} maxLength={20} pattern="[a-zA-Z0-9_]+" className={FIELD} />
        </div>

        <div className="space-y-1.5">
          <label className={LABEL}>Email</label>
          <input name="email" type="email" defaultValue={currentEmail ?? ""} required className={FIELD} />
        </div>

        <StatusMessage state={state} />

        <button type="submit" disabled={pending} className={SAVE_BUTTON}>
          {pending ? "Saving…" : "Save"}
        </button>
      </form>
    </SectionShell>
  );
}

export function PasswordForm() {
  const [state, formAction, pending] = useActionState(updatePasswordSecure, initialState);

  return (
    <SectionShell title="Update Password" description="Ensure your account is using a long, random password to stay secure.">
      <form action={formAction} className="space-y-4 rounded-lg border border-border/60 p-4">
        <div className="space-y-1.5">
          <label className={LABEL}>Current Password</label>
          <input name="currentPassword" type="password" required autoComplete="current-password" className={FIELD} />
        </div>
        <div className="space-y-1.5">
          <label className={LABEL}>New Password</label>
          <input name="newPassword" type="password" required minLength={8} autoComplete="new-password" className={FIELD} />
        </div>
        <div className="space-y-1.5">
          <label className={LABEL}>Confirm Password</label>
          <input name="confirmPassword" type="password" required minLength={8} autoComplete="new-password" className={FIELD} />
        </div>

        <StatusMessage state={state} />

        <button type="submit" disabled={pending} className={SAVE_BUTTON}>
          {pending ? "Saving…" : "Save"}
        </button>
      </form>
    </SectionShell>
  );
}

export function BrowserSessionsForm() {
  const [state, formAction, pending] = useActionState(signOutOtherSessions, initialState);

  return (
    <SectionShell title="Browser Sessions" description="Manage and log out your active sessions on other browsers and devices.">
      <div className="space-y-4 rounded-lg border border-border/60 p-4">
        <p className="text-sm text-muted-foreground">
          If necessary, you may log out of all of your other browser sessions across all of your devices. If you feel
          your account has been compromised, you should also update your password.
        </p>
        <p className="text-sm font-medium">This Device</p>

        <StatusMessage state={state} />

        <form action={formAction}>
          <button
            type="submit"
            disabled={pending}
            className="h-8 rounded-md bg-primary px-3 text-xs font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-60"
          >
            {pending ? "Logging out…" : "Log Out Other Browser Sessions"}
          </button>
        </form>
      </div>
    </SectionShell>
  );
}

