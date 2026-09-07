"use client";

import { useActionState } from "react";
import { uploadMobileBanner, uploadDesktopBanner, type UploadBannerState } from "@/app/admin/(authed)/banner/actions";

const initialState: UploadBannerState = {};

export function AdminBannerUploadForm({ variant }: { variant: "mobile" | "desktop" }) {
  const action = variant === "mobile" ? uploadMobileBanner : uploadDesktopBanner;
  const [state, formAction, pending] = useActionState(action, initialState);

  return (
    <form action={formAction} className="space-y-2">
      <div className="flex items-center gap-2">
        <input
          type="file"
          name="file"
          accept="image/jpeg,image/png,image/webp"
          required
          className="flex-1 text-sm text-muted-foreground file:mr-3 file:h-8 file:rounded-md file:border file:border-border/60 file:bg-background file:px-3 file:text-sm file:font-medium hover:file:bg-muted/60"
        />
        <button
          type="submit"
          disabled={pending}
          className="h-8 shrink-0 rounded-md border border-border/60 px-3 text-xs font-medium hover:bg-muted/60 disabled:opacity-50"
        >
          {pending ? "Uploading…" : "Upload"}
        </button>
      </div>
      {state.error && <p className="text-xs text-destructive">{state.error}</p>}
      {state.success && <p className="text-xs text-primary">Uploaded — preview above updated.</p>}
    </form>
  );
}
