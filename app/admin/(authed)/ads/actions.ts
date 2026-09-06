"use server";

import { revalidatePath } from "next/cache";
import sharp from "sharp";
import { verifySession } from "@/lib/admin/dal";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";

const MAX_VIDEO_BYTES = 20 * 1024 * 1024; // hard cap — we can't transcode/compress video server-side here
const MAX_IMAGE_INPUT_BYTES = 15 * 1024 * 1024; // reject absurd source images before even trying to process
const IMAGE_MAX_DIMENSION = 1280; // resized to fit within this, matching typical in-feed ad slot sizes

export interface UploadAdMediaState {
  error?: string;
  success?: boolean;
}

export async function uploadAdMedia(
  _prevState: UploadAdMediaState | undefined,
  formData: FormData,
): Promise<UploadAdMediaState> {
  await verifySession();

  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return { error: "Choose a file first." };
  }

  const isVideo = file.type === "video/mp4";
  const isImage = file.type === "image/jpeg" || file.type === "image/png" || file.type === "image/webp";
  if (!isVideo && !isImage) {
    return { error: "Only JPG/PNG/WebP images or MP4 video are supported." };
  }

  let buffer = Buffer.from(await file.arrayBuffer());
  let extension: string;
  let contentType: string;

  if (isVideo) {
    if (buffer.byteLength > MAX_VIDEO_BYTES) {
      return {
        error: `That video is ${(buffer.byteLength / 1024 / 1024).toFixed(1)}MB. We can't compress video on the server here — please compress it under 20MB first (e.g. HandBrake) and re-upload.`,
      };
    }
    extension = "mp4";
    contentType = "video/mp4";
  } else {
    if (buffer.byteLength > MAX_IMAGE_INPUT_BYTES) {
      return { error: "That image is too large — please use something under 15MB." };
    }
    // Optimize: cap dimensions and re-encode as compressed WebP, so a
    // heavy source image never reaches visitors at full size/weight.
    try {
      buffer = await sharp(buffer)
        .resize({ width: IMAGE_MAX_DIMENSION, height: IMAGE_MAX_DIMENSION, fit: "inside", withoutEnlargement: true })
        .webp({ quality: 80 })
        .toBuffer();
    } catch {
      return { error: "Could not process that image — is it a valid JPG/PNG/WebP file?" };
    }
    extension = "webp";
    contentType = "image/webp";
  }

  const supabase = createAdminSupabaseClient();
  const path = `house-ad-${Date.now()}.${extension}`;

  const { error: uploadError } = await supabase.storage.from("ad-media").upload(path, buffer, {
    contentType,
    upsert: true,
  });
  if (uploadError) {
    return { error: `Upload failed: ${uploadError.message}` };
  }

  const {
    data: { publicUrl },
  } = supabase.storage.from("ad-media").getPublicUrl(path);

  await supabase.from("ad_settings").update({ house_video_path: publicUrl }).eq("id", 1);

  revalidatePath("/admin/ads");
  revalidatePath("/", "layout");

  return { success: true };
}

export async function updateAdSettings(formData: FormData) {
  await verifySession();

  const houseWeight = Math.min(100, Math.max(0, Number(formData.get("house_weight")) || 0));
  const houseVideoPath = String(formData.get("house_video_path") ?? "").trim();
  const houseClickUrl = String(formData.get("house_click_url") ?? "").trim();

  if (!houseVideoPath || !houseClickUrl) return;

  const supabase = createAdminSupabaseClient();
  await supabase
    .from("ad_settings")
    .update({
      house_weight: houseWeight,
      google_enabled: formData.get("google_enabled") === "on",
      house_video_path: houseVideoPath,
      house_click_url: houseClickUrl,
    })
    .eq("id", 1);

  revalidatePath("/admin/ads");
  revalidatePath("/", "layout");
}
