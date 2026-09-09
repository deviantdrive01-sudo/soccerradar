"use server";

import { revalidatePath } from "next/cache";
import sharp from "sharp";
import { verifySession } from "@/lib/admin/dal";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { readLocalFallbackBuffer, type TemplateId } from "@/lib/template-settings";

const MAX_IMAGE_INPUT_BYTES = 15 * 1024 * 1024; // reject absurd source images before even trying to process
// These backgrounds are tall portrait canvases (1200x2000+, 1400x1400) shown full-bleed behind text — cap
// generously and let `fit: "inside"` preserve whichever aspect ratio was uploaded.
const IMAGE_MAX_WIDTH = 1600;
const IMAGE_MAX_HEIGHT = 2400;
const HEX_COLOR = /^#[0-9a-fA-F]{6}$/;

export interface SaveTemplateState {
  error?: string;
  success?: boolean;
}

async function uploadBackground(
  supabase: ReturnType<typeof createAdminSupabaseClient>,
  id: TemplateId,
  buffer: Buffer,
): Promise<{ url?: string; error?: string }> {
  const path = `${id}-${Date.now()}.webp`;
  const { error: uploadError } = await supabase.storage.from("template-media").upload(path, buffer, {
    contentType: "image/webp",
    upsert: true,
  });
  if (uploadError) return { error: `Upload failed: ${uploadError.message}` };

  const {
    data: { publicUrl },
  } = supabase.storage.from("template-media").getPublicUrl(path);
  return { url: publicUrl };
}

/** Saves one template's style config — background image (optional new upload), accent color, wordmark text. */
export async function saveTemplateSettings(
  id: TemplateId,
  _prevState: SaveTemplateState | undefined,
  formData: FormData,
): Promise<SaveTemplateState> {
  await verifySession();

  const accentColor = String(formData.get("accentColor") ?? "").trim();
  const wordmarkText = String(formData.get("wordmarkText") ?? "").trim();
  if (!HEX_COLOR.test(accentColor)) {
    return { error: "Accent color must be a hex value like #F1FF3B." };
  }
  if (!wordmarkText) {
    return { error: "Wordmark text can't be empty." };
  }

  const supabase = createAdminSupabaseClient();
  const { data: existing } = await supabase.from("template_settings").select("background_url").eq("id", id).maybeSingle();

  let backgroundUrl = existing?.background_url ?? null;

  const file = formData.get("file");
  if (file instanceof File && file.size > 0) {
    const isImage = file.type === "image/jpeg" || file.type === "image/png" || file.type === "image/webp";
    if (!isImage) {
      return { error: "Only JPG/PNG/WebP images are supported." };
    }

    let buffer = Buffer.from(await file.arrayBuffer());
    if (buffer.byteLength > MAX_IMAGE_INPUT_BYTES) {
      return { error: "That image is too large — please use something under 15MB." };
    }

    try {
      buffer = await sharp(buffer)
        .resize({ width: IMAGE_MAX_WIDTH, height: IMAGE_MAX_HEIGHT, fit: "inside", withoutEnlargement: true })
        .webp({ quality: 85 })
        .toBuffer();
    } catch {
      return { error: "Could not process that image — is it a valid JPG/PNG/WebP file?" };
    }

    const result = await uploadBackground(supabase, id, buffer);
    if (result.error) return { error: result.error };
    backgroundUrl = result.url!;
  }

  if (!backgroundUrl) {
    // First-ever save for this template with no upload yet — seed it from the bundled background so the
    // not-null column always holds a real, working URL (never leaves the row half-configured).
    const buffer = await sharp(readLocalFallbackBuffer(id)).webp({ quality: 85 }).toBuffer();
    const result = await uploadBackground(supabase, id, buffer);
    if (result.error) return { error: result.error };
    backgroundUrl = result.url!;
  }

  const { error: upsertError } = await supabase
    .from("template_settings")
    .upsert({ id, background_url: backgroundUrl, accent_color: accentColor, wordmark_text: wordmarkText });
  if (upsertError) {
    return { error: `Save failed: ${upsertError.message}` };
  }

  revalidatePath("/admin/templates");

  return { success: true };
}

export async function saveMatchDayTemplate(prevState: SaveTemplateState | undefined, formData: FormData) {
  return saveTemplateSettings("match_day", prevState, formData);
}
export async function saveLeagueMatchesTemplate(prevState: SaveTemplateState | undefined, formData: FormData) {
  return saveTemplateSettings("league_matches", prevState, formData);
}
export async function saveBestPicksTemplate(prevState: SaveTemplateState | undefined, formData: FormData) {
  return saveTemplateSettings("best_picks", prevState, formData);
}
