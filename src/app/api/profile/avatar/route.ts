import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { logAudit } from "@/lib/audit";

const MAX_BYTES = 3 * 1024 * 1024;
const ALLOWED: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

/**
 * Uploads (or replaces) the signed-in user's own profile picture. Always
 * writes to a fixed path per user (`${uid}/avatar.<ext>`), so a re-upload
 * overwrites the old file instead of accumulating orphans; storage RLS
 * (see the Sprint 10 migration) only lets a user write inside their own
 * folder, so this can't be used to touch anyone else's avatar.
 */
export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const form = await request.formData();
  const file = form.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "No file provided" }, { status: 400 });
  }
  const ext = ALLOWED[file.type];
  if (!ext) {
    return NextResponse.json({ error: "Only JPEG, PNG or WebP images are allowed" }, { status: 400 });
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: "Image must be 3MB or smaller" }, { status: 400 });
  }

  // Old uploads under a different extension would otherwise linger.
  await supabase.storage
    .from("avatars")
    .remove(Object.values(ALLOWED).map((e) => `${user.id}/avatar.${e}`));

  const path = `${user.id}/avatar.${ext}`;
  const { error: uploadError } = await supabase.storage
    .from("avatars")
    .upload(path, file, { contentType: file.type, upsert: true });
  if (uploadError) {
    return NextResponse.json({ error: uploadError.message }, { status: 500 });
  }

  const {
    data: { publicUrl },
  } = supabase.storage.from("avatars").getPublicUrl(path);
  // Cache-busted so the new picture shows immediately, everywhere it's used.
  const url = `${publicUrl}?v=${Date.now()}`;

  const { error: updateError } = await supabase
    .from("profiles")
    .update({ avatar_url: url })
    .eq("id", user.id);
  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 });
  }

  await logAudit(supabase, { action: "AVATAR_UPDATED", entityType: "profile", entityId: user.id });

  return NextResponse.json({ avatarUrl: url });
}

export async function DELETE() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  await supabase.storage
    .from("avatars")
    .remove(Object.values(ALLOWED).map((e) => `${user.id}/avatar.${e}`));

  const { error } = await supabase.from("profiles").update({ avatar_url: null }).eq("id", user.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await logAudit(supabase, { action: "AVATAR_REMOVED", entityType: "profile", entityId: user.id });

  return NextResponse.json({ success: true });
}
