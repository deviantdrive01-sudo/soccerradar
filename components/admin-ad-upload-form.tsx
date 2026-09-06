"use client";

import { useActionState } from "react";
import { uploadAdMedia, type UploadAdMediaState } from "@/app/admin/(authed)/ads/actions";

const initialState: UploadAdMediaState = {};

export function AdminAdUploadForm() {
  const [state, formAction, pending] = useActionState(uploadAdMedia, initialState);

  return (
    <form action={formAction} className="space-y-2">
      <div className="flex items-center gap-2">
        <input
          type="file"
          name="file"
          accept="image/jpeg,image/png,image/webp,video/mp4"
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
      <p className="text-xs text-muted-foreground">
        Images are auto-resized and compressed to WebP. MP4 video is capped at 20MB (no server-side compression —
        pre-compress heavier files before uploading). Uploading replaces the video URL field above.
      </p>
      {state.error && <p className="text-xs text-destructive">{state.error}</p>}
      {state.success && <p className="text-xs text-emerald-500">Uploaded — field below updated.</p>}
    </form>
  );
}
