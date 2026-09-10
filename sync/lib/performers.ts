/**
 * Splitting a credit field into the individual people it actually names.
 *
 * Theatres publish one line per *part*, not one per person, and a part is
 * regularly covered by more than one performer: "Ács Eszter / Battai Lili
 * Lujza" alternate as Tünde, and a chorus line reads "Zenészek: Abuczki
 * Norbert, Albert Szilárd, Áchim Tibor, …". `play_cast` is keyed on
 * (play_id, name, role) precisely so each of those people can hold their own
 * row against the same character, and until this existed most adapters wrote
 * the whole string into `name` as though it were one person — or, in
 * Csokonai's case, took `split("/")[0]` and discarded the rest of the cast.
 *
 * Both failures are worse than they look. A composite name matches no
 * performer, so `person_credits()` finds nothing and the person page for
 * either half comes back empty; and an alternate who was dropped at parse time
 * is simply absent from the catalogue, unsearchable and uncreditable.
 *
 * Applied centrally in `sync/run.ts` rather than in each adapter, for the same
 * reason `dedupeCast` is: the shape belongs to the table, so every source —
 * including the next one somebody writes — has to satisfy it.
 */
import { personCanonicalName } from "../../utils/people";

/**
 * A slash between two performers, and the "+" that joins two design credits.
 *
 * Unambiguous: nothing in a Hungarian name or honour contains either, so a
 * field can always be cut here first and each piece considered on its own.
 */
const ALTERNATE_SEPARATORS = /\s*\/\s*|\s*\+\s*/;

/**
 * The separators that are only sometimes separators.
 *
 * A comma divides a chorus into its singers, and it also sits inside a single
 * performer's honours — "Molnár Levente - Liszt-díjas, érdemes művész". The
 * suspended compound Hungarian writes for two prizes sharing one suffix puts
 * an "és" in the same position ("Ferenczy Noémi- és Jászai Mari-díjas"). So
 * these are tried, and the result is only believed when every piece it
 * produces reads as a person.
 */
const LIST_SEPARATORS = /\s*,\s*|\s+és\s+|\s+valamint\s+/;

/**
 * Lowercase words that are genuinely part of a name.
 *
 * Hungarian marks generations and degrees with an abbreviation before or after
 * the name — "ifj. Vidnyánszky Attila", "Ménes Emese Orsolya e.h." (*egyetemi
 * hallgató*, a student performer) — and both appear in alternate lists that
 * still have to split. `e.h.` is deliberately absent from
 * `personCanonicalName`'s honorific tail: unlike a prize it stays in the
 * stored name, and is only tolerated here.
 *
 * The nobiliary particles are for visiting performers rather than Hungarian
 * ones, and cost nothing to allow.
 */
const NAME_PARTICLES = new Set([
  "ifj.", "id.", "dr.", "özv.", "e.h.", "h.c.", "prof.",
  "van", "von", "de", "di", "da", "del", "der", "ten", "ter",
]);

/**
 * A single word of a personal name: capitalised, letters only, hyphenated or
 * apostrophised the way surnames are ("Cseh-Fehér", "Maros-Szabó", "O'Brien").
 *
 * Each half of a hyphenated surname has to be capitalised on its own, which is
 * what separates a double surname from an annotation glued to a name with a
 * hyphen: "Áchim Tibor-klarinét" names one musician and his instrument, and
 * must not be read as somebody called Tibor-klarinét.
 */
const NAME_WORD = /^\p{Lu}[\p{L}'’]*(?:[-'’]\p{Lu}[\p{L}'’]*)*$/u;

/**
 * Whether a fragment reads as one person's name.
 *
 * Deliberately strict, because the two mistakes do not cost the same. Failing
 * to split leaves a credit exactly as the theatre publishes it today; splitting
 * something that is not a list invents people who do not exist and gives them
 * person pages. So anything carrying a digit, a colon, a parenthetical or a
 * lowercase word that is not a name particle fails, which is how "AirWalking
 * Kft / Mihály Gábor vezetésével", "Numen/For Use + Ivana Jonke" and
 * "PR-Evolution Junior Debrecen: Ötvös Eszter, …" survive intact.
 *
 * Honours are removed before the test rather than after, so "Ráckevei Anna
 * (Jászai Mari-díjas)" is measured as the two words it really is.
 */
function isPersonName(fragment: string): boolean {
  const words = personCanonicalName(fragment).split(/\s+/).filter(Boolean);
  // Two words is a Hungarian name; four allows a middle name plus a particle.
  if (words.length < 2 || words.length > 4) return false;
  if (!words.every((word) => NAME_WORD.test(word) || NAME_PARTICLES.has(word.toLowerCase()))) return false;
  // A particle is not a name by itself — "id. Nagy" is a person, "ifj. e.h."
  // is not — so at least two of the words have to be name words.
  return words.filter((word) => NAME_WORD.test(word)).length >= 2;
}

/**
 * The people one piece of a credit names, or undefined if it names no person.
 *
 * The list split is attempted *before* the piece is considered as a single
 * name, because a name test alone would accept the whole of "Ráckevei Anna
 * (Jászai Mari-díjas), Janovicz Zsófia, Ármós Tamara": the honours swallow
 * everything after them, leaving two plausible words and two lost performers.
 * Trying the split first and only falling back when a piece of it fails is
 * what keeps "Molnár Levente - Liszt-díjas, érdemes művész" whole while
 * dividing the chorus beside it.
 */
function peopleIn(piece: string): string[] | undefined {
  const listed = piece.split(LIST_SEPARATORS).map((part) => part.trim()).filter(Boolean);
  if (listed.length > 1 && listed.every(isPersonName)) return listed;
  return isPersonName(piece) ? [piece] : undefined;
}

/**
 * The performers a single credit field names, in the order it names them.
 *
 * All or nothing: a field splits only when *every* piece of it resolves to at
 * least one person, so one parenthetical in a long list ("… Baditz Dávid (az
 * Ady Endre Gimnázium diákjai), illetve Kulcs Dávid …") leaves the field as it
 * was rather than keeping the names that parsed and quietly dropping the rest.
 * Half a cast list is a much harder failure to notice than an unsplit one.
 *
 * Names come back as the theatre printed them, honours and guest markers
 * included — removing those is `personCanonicalName`'s job at identity time,
 * and the app shows the credit as published.
 */
export function splitPerformers(field: string): string[] {
  const whole = field.trim();
  if (!whole) return [];

  const alternates = whole.split(ALTERNATE_SEPARATORS).map((part) => part.trim()).filter(Boolean);
  if (alternates.length > 1) {
    const resolved = alternates.map(peopleIn);
    if (resolved.every((people) => people !== undefined)) {
      return [...new Set(resolved.flat() as string[])];
    }
  }

  return [...new Set(peopleIn(whole) ?? [whole])];
}

/**
 * A name with the guest marker taken off the end.
 *
 * Hungarian theatres print *m.v.* — `mint vendég`, "as a guest" — after the
 * name of anyone not in the company. On a company page that marker is about
 * the engagement, not the person, and it has to come off before the name is
 * slugged: `personCanonicalName()` knows the dotted form but not the bare
 * `m.v` that two of these sites print, so leaving it on files the same
 * performer under a second slug nothing links to.
 *
 * Lives here rather than in one adapter because six company pages now need
 * it, and a copy of this regex per house is a copy that can be forgotten when
 * a seventh is added.
 */
const GUEST_MARKER = /\s*\bm\.\s*v\.?\s*$/i;

export function stripGuestMarker(name: string): string {
  return name.replace(GUEST_MARKER, "").trim();
}
