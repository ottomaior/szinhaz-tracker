/**
 * Turning a performer's name into the identity their page lives at.
 *
 * This is the client half of a pair. `public.person_canonical_name()` and
 * `public.person_slug()` in `supabase/migrations/0024_people.sql` are the
 * other, and the two have to agree character for character: the app builds a
 * slug from a cast list to make the link, and the database matches that slug
 * against every name it holds.
 *
 * When they disagree the page does not break — it comes back **empty**, which
 * is a much worse failure, because an empty person page is indistinguishable
 * from a performer nobody has credited. `utils/people.test.ts` pins this side
 * against a table of real names from the catalogue, and the same table is run
 * through the SQL function, so a drift on either side is caught rather than
 * assumed away.
 *
 * Living in `utils/` rather than in the screen is deliberate, for the reason
 * `vitest.config.ts` gives: no React dependency, and a class of bug that is
 * invisible on screen.
 */

/**
 * Everything Hungarian theatres print in a name field that is not a name.
 *
 * The match runs to the end of the string, because the name comes first and the
 * titles after — without exception in this catalogue.
 *
 * The big one is **m.v.**, *mint vendég*, "as guest", on roughly 230 cast rows.
 * A guest is by definition performing at a theatre that is not their own, so
 * these are precisely the people most likely to appear under two houses, and
 * without this "Mészáros Béla m.v." and "Mészáros Béla" would be two strangers.
 *
 * The state prizes are listed by name rather than matched as "any word ending
 * in -díjas", because that generic rule cannot tell whether the preceding word
 * belongs to the award or to the person: in "Szikora János Jászai-díjas" it is
 * his forename, and in "Létay Kiss Gabriella Liszt Ferenc-díjas" it is half the
 * award. The optional `- és` branch covers the suspended compound Hungarian
 * writes for two prizes sharing one suffix ("Ferenczy Noémi- és Jászai
 * Mari-díjas").
 */
const PRIZES = "Kossuth|Liszt Ferenc|Liszt|Jászai Mari|Jászai|Ferenczy Noémi|Blattner Géza|Erkel Ferenc|Balázs Béla|Munkácsy Mihály|Széchenyi";

const HONORIFIC_TAIL = new RegExp(
  "(\\s*[,(]?\\s*(" +
    "m\\.\\s*v\\." +
    "|(" + PRIZES + ")" +
    "(-\\s*és\\s+(" + PRIZES + "))?" +
    "\\s*-?\\s*díjas" +
    "|érdemes\\s+művész|kiváló\\s+művész|a\\s+nemzet\\s+\\S+|a\\s+Magyar\\s+Művészeti\\s+Akadémia" +
  ").*)$",
  "i"
);

/** Matches Postgres `trim(both ' ,;-/' from ...)`. */
const EDGE_PUNCTUATION = /^[\s,;/-]+|[\s,;/-]+$/g;

/** The name with guest markers and honours removed, as the database stores it. */
export function personCanonicalName(rawName: string): string {
  return (rawName ?? "").replace(HONORIFIC_TAIL, "").replace(EDGE_PUNCTUATION, "");
}

/**
 * The accent folding `unaccent` performs, for the characters this catalogue has.
 *
 * `normalize("NFD")` plus a combining-mark strip covers á é í ó ö ú ü and their
 * capitals, and — the part worth checking rather than assuming — **ő and ű**,
 * the two letters Hungarian has that most folding tables miss. Both decompose
 * to a base vowel plus a combining double acute, which the mark strip removes.
 *
 * The map below is only for characters NFD leaves alone, which turn up in
 * visiting performers' names.
 */
const EXTRA_FOLDINGS: Record<string, string> = {
  ß: "ss",
  ł: "l",
  Ł: "L",
  đ: "d",
  Đ: "D",
  ø: "o",
  Ø: "O",
  æ: "ae",
  Æ: "AE",
  œ: "oe",
  Œ: "OE",
};

/** Accent-folded, lowercased, everything else collapsed to single hyphens. */
export function personSlug(rawName: string): string {
  return personCanonicalName(rawName)
    .replace(/[ßłŁđĐøØæÆœŒ]/g, (c) => EXTRA_FOLDINGS[c] ?? c)
    .normalize("NFD")
    // Combining diacritical marks. This is the step that turns Ő into O.
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/**
 * A label for what somebody did on a production.
 *
 * Roles arrive already deduplicated case-insensitively from `person_credits()`,
 * because the sources disagree about capitalisation — "Rendező" appears 92
 * times and "rendező" 25 — and a page listing both has invented a second job.
 *
 * Directing is put first and then suppressed from the role list, since 122
 * productions credit their director in `play_cast` as well as in
 * `plays.director` and both sources fire for the same person.
 */
export function creditLabel(roles: string[], directed: boolean, directorLabel: string): string {
  const rest = directed
    ? roles.filter((r) => r.toLowerCase() !== directorLabel.toLowerCase())
    : roles;
  return (directed ? [directorLabel, ...rest] : rest).join(" · ");
}

/**
 * The monogram shown where somebody has no profile picture.
 *
 * The client half of `public.profile_initials()` in
 * `supabase/migrations/0027_profile_identity.sql`, and here for the same reason
 * `personSlug` is: the database owns the stored value — a trigger recomputes
 * `profiles.initials` whenever the name changes — but the edit form has to
 * show the monogram as the name is being typed, before any round trip has
 * happened. If the two disagreed, the avatar in the form would be a preview of
 * something else.
 *
 * The first letter of each of the first two words, so "Máthé Zsolt" is MZ. The
 * signup trigger's original `upper(left(name, 2))` gave MÁ, which is the
 * beginning of a surname rather than a monogram.
 */
export function profileInitials(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  const letters = words.slice(0, 2).map((w) => w[0]).join("");
  // "?" rather than an empty string: the name is required, but a profile row
  // written some other way should still draw something inside its circle.
  return (letters || name.trim().slice(0, 2)).toUpperCase() || "?";
}
