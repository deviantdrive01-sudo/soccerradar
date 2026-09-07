"use server";

import { revalidatePath } from "next/cache";
import sharp from "sharp";
import { verifySession } from "@/lib/admin/dal";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";

const MAX_IMAGE_INPUT_BYTES = 15 * 1024 * 1024; // reject absurd source images before even trying to process
// The banner is a wide letterbox crop on desktop, a shorter crop on mobile —
// cap both dimensions generously and let `fit: "inside"` preserve whichever
// aspect ratio was uploaded rather than forcing a square-ish box like the
// in-feed ad upload does.
const IMAGE_MAX_WIDTH = 1920;
const IMAGE_MAX_HEIGHT = 640;

export type BannerVariant = "mobile" | "desktop";

export interface UploadBannerState {
  error?: string;
  success?: boolean;
}

export async function uploadBannerImage(
  variant: BannerVariant,
  _prevState: UploadBannerState | undefined,
  formData: FormData,
): Promise<UploadBannerState> {
  await verifySession();

  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return { error: "Choose an image first." };
  }

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
      .webp({ quality: 82 })
      .toBuffer();
  } catch {
    return { error: "Could not process that image — is it a valid JPG/PNG/WebP file?" };
  }

  const supabase = createAdminSupabaseClient();
  const path = `profile-banner-${variant}-${Date.now()}.webp`;

  const { error: uploadError } = await supabase.storage.from("ad-media").upload(path, buffer, {
    contentType: "image/webp",
    upsert: true,
  });
  if (uploadError) {
    return { error: `Upload failed: ${uploadError.message}` };
  }

  const {
    data: { publicUrl },
  } = supabase.storage.from("ad-media").getPublicUrl(path);

  if (variant === "mobile") {
    await supabase.from("site_settings").update({ profile_banner_mobile_url: publicUrl }).eq("id", 1);
  } else {
    await supabase.from("site_settings").update({ profile_banner_desktop_url: publicUrl }).eq("id", 1);
  }

  revalidatePath("/admin/banner");
  revalidatePath("/account", "layout");

  return { success: true };
}

export async function uploadMobileBanner(prevState: UploadBannerState | undefined, formData: FormData) {
  return uploadBannerImage("mobile", prevState, formData);
}

export async function uploadDesktopBanner(prevState: UploadBannerState | undefined, formData: FormData) {
  return uploadBannerImage("desktop", prevState, formData);
}
