import { SUPABASE_URL, supabase } from "@/services/supabase";

/**
 * Public CDN URL for a path inside the `avatars` bucket.
 *
 * The same shape as the posters helper in `playsService`: rows hold a path,
 * never a URL, so the origin can change without rewriting them.
 */
export function avatarUrl(path: string): string {
  return `${SUPABASE_URL.replace(/\/+$/, "")}/storage/v1/object/public/avatars/${path}`;
}

/** The longest bio the database will accept — `profiles_bio_length` in 0027. */
export const BIO_MAX_LENGTH = 280;

async function currentUserId(): Promise<string> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("not signed in");
  return user.id;
}

/**
 * Puts a picked image in the `avatars` bucket and returns its path.
 *
 * Always `<uid>/<file>`, which is the only shape the storage policy accepts and
 * the only shape the `profiles_guard_avatar_path` trigger will let into the
 * row — so a crafted call cannot hang somebody else's photograph on a profile.
 */
export async function uploadAvatar(uri: string): Promise<string> {
  const uid = await currentUserId();

  // `fetch` on a local file:// or content:// URI is how Expo hands us the
  // bytes on every platform; on web the picker already gives a blob: URI.
  const res = await fetch(uri);
  const blob = await res.blob();

  const ext = (blob.type.split("/")[1] || "jpg").replace(/[^a-z0-9]/gi, "").toLowerCase();
  const path = `${uid}/${Date.now()}-${Math.random().toString(36).slice(2, 10)}.${ext}`;

  const { error } = await supabase.storage.from("avatars").upload(path, blob, {
    contentType: blob.type || "image/jpeg",
    upsert: false,
  });
  if (error) throw error;
  return path;
}

/** The editable half of a profile, as the edit form holds it. */
export type ProfileDraft = {
  name: string;
  city: string;
  bio: string;
  /** The stored path, not the CDN URL — that is what a save has to write back. */
  avatarPath: string | null;
};

/**
 * The signed-in user's profile, in the shape the edit form wants.
 *
 * Separate from `getCurrentUser` because that one hands out a public URL for
 * the avatar and counts four statistics nobody is about to edit; a form needs
 * the raw path and nothing else.
 */
export async function getMyProfileDraft(): Promise<ProfileDraft> {
  const uid = await currentUserId();
  const { data, error } = await supabase
    .from("profiles")
    .select("name, city, bio, avatar_path")
    .eq("id", uid)
    .maybeSingle();
  if (error) throw error;
  return {
    name: (data?.name as string) ?? "",
    city: (data?.city as string | null) ?? "",
    bio: (data?.bio as string | null) ?? "",
    avatarPath: (data?.avatar_path as string | null) ?? null,
  };
}

/**
 * Writes the editable half of a profile.
 *
 * `initials` is deliberately not in here: 0027 derives it from the name in a
 * trigger, so a renamed account cannot end up wearing the monogram it had
 * before. Callers should re-read the profile afterwards rather than patching
 * their copy, since the row that comes back is not only what they sent.
 *
 * Empty strings are stored as null rather than as blanks — `city` and `bio` are
 * both rendered only when present, and a row full of `''` makes every one of
 * those checks lie.
 */
export async function updateProfile(input: {
  name: string;
  city: string | null;
  bio: string | null;
  /** `null` clears the picture and puts the monogram back. */
  avatarPath: string | null;
}): Promise<void> {
  const uid = await currentUserId();

  // Read first, so the file the profile is about to stop pointing at can be
  // removed. Replacing your picture five times should not leave five files.
  const { data: existing } = await supabase
    .from("profiles")
    .select("avatar_path")
    .eq("id", uid)
    .maybeSingle();
  const previousPath = (existing?.avatar_path as string | null) ?? null;

  const { error } = await supabase
    .from("profiles")
    .update({
      name: input.name.trim(),
      city: input.city?.trim() || null,
      bio: input.bio?.trim() || null,
      avatar_path: input.avatarPath,
    })
    .eq("id", uid);
  if (error) throw error;

  if (previousPath && previousPath !== input.avatarPath) {
    // Best effort: an orphaned file is untidy, a failed save because the tidy-up
    // failed is worse. Nothing points at it any more either way.
    await supabase.storage.from("avatars").remove([previousPath]).catch(() => undefined);
  }
}
