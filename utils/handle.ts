/**
 * The client half of `handle_from_name()` (0052).
 *
 * The database mints a handle from a display name when an account is
 * created; the first-run flow needs the same suggestion before any round
 * trip, so the two are written twice and pinned against each other in
 * `utils/handle.test.ts`, the way `personSlug()` and `season.ts` are. If they
 * disagreed the form would suggest one handle and the constraint would refuse
 * another.
 *
 * Lower-cased, unaccented, nothing but `[a-z0-9_]`, cut to thirty; padded to
 * three with underscores; `nezo` ("viewer") when nothing survives.
 */
export function handleFromName(fullName: string | null | undefined): string {
  const cleaned = (fullName ?? "")
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9_]/g, "");
  if (cleaned.length >= 3) return cleaned.slice(0, 30);
  if (cleaned.length > 0) return cleaned.padEnd(3, "_");
  return "nezo";
}

/**
 * Does this name look like the fallback rather than something somebody chose?
 *
 * `handle_new_user()` falls back to the address's local part when no provider
 * and no form sent a name (0060). That is the one case the first run should
 * ask about: "ottomaior94" is not what anybody wants over their entries. A
 * name that merely *contains* the local part is left alone — it may be a
 * real one.
 */
export function nameLooksDerived(name: string | null | undefined, email: string | null | undefined): boolean {
  const trimmed = (name ?? "").trim();
  if (!trimmed) return true;
  const local = (email ?? "").split("@")[0]?.trim();
  if (!local) return false;
  return trimmed.toLowerCase() === local.toLowerCase();
}
