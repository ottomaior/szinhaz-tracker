/**
 * Text normalization shared by every adapter.
 *
 * Sources hand us the same field in inconsistent shapes — HTML fragments,
 * entity-encoded text, non-breaking spaces, stray whitespace — and each
 * adapter used to clean up whatever it happened to notice. That is how
 * Örkény's `title` ended up as the one field not passed through entity
 * decoding while `author` and `director` were, so an apostrophe or an accent
 * could reach `plays.title` still encoded.
 *
 * Everything an adapter writes to a text column should go through here.
 */

/**
 * Named entities seen in practice.
 *
 * Node has no built-in decoder, and this covers what the sources actually emit
 * rather than pulling in a full HTML parser for a handful of fields.
 *
 * `ő`/`ű` are included even though Örkény's API never encodes them — being
 * outside Latin-1, it sends them as plain UTF-8, which is why the table this
 * grew out of left them off. That reasoning holds for one JSON API but not for
 * the WordPress and Joomla pages the other adapters scrape, where an editor
 * pasting `&odblac;` is entirely possible. Decoding a form that never arrives
 * costs nothing; failing to decode one that does puts `Rendez&odblac;` in the
 * database.
 */
const HTML_ENTITIES: Record<string, string> = {
  aacute: "á", eacute: "é", iacute: "í", oacute: "ó", ouml: "ö", uacute: "ú", uuml: "ü",
  Aacute: "Á", Eacute: "É", Iacute: "Í", Oacute: "Ó", Ouml: "Ö", Uacute: "Ú", Uuml: "Ü",
  odblac: "ő", udblac: "ű", Odblac: "Ő", Udblac: "Ű",
  amp: "&", quot: '"', apos: "'", lt: "<", gt: ">", nbsp: " ",
  hellip: "…", ndash: "–", mdash: "—", laquo: "«", raquo: "»",
  lsquo: "‘", rsquo: "’", ldquo: "“", rdquo: "”",
};

export function decodeHtmlEntities(text: string): string {
  return text.replace(/&(#(\d+)|#x([0-9a-fA-F]+)|[a-zA-Z]+);/g, (match, _entity, dec, hex) => {
    if (dec) return String.fromCodePoint(Number(dec));
    if (hex) return String.fromCodePoint(parseInt(hex, 16));
    const name = match.slice(1, -1);
    return HTML_ENTITIES[name] ?? match;
  });
}

/**
 * Collapses whitespace and decodes entities, without removing markup.
 *
 * Non-breaking spaces are folded into ordinary ones: they are invisible in the
 * app but make two otherwise identical titles compare as different, which
 * matters anywhere titles are matched across sources.
 */
export function normalizeText(text?: string | null): string | undefined {
  if (!text) return undefined;
  return decodeHtmlEntities(text).replace(/[\s ]+/g, " ").trim() || undefined;
}

/** Strips tags, then normalizes — for fields a source delivers as HTML. */
export function stripHtml(html?: string | null): string | undefined {
  if (!html) return undefined;
  return normalizeText(html.replace(/<[^>]+>/g, " "));
}

/**
 * A title as it should be stored: normalized, with the theatre's own name
 * trimmed off the end if the source built it from a page `<title>`.
 */
export function normalizeTitle(text?: string | null, siteSuffix?: RegExp): string | undefined {
  const normalized = stripHtml(text);
  if (!normalized) return undefined;
  return (siteSuffix ? normalized.replace(siteSuffix, "").trim() : normalized) || undefined;
}

/**
 * A title reduced to a comparison key.
 *
 * Used wherever the same production has to be recognised across two sources or
 * across a website relaunch. Accents are folded rather than kept, because the
 * sources disagree about them more often than they disagree about the words —
 * and punctuation is dropped entirely, since "Dante: Pokol" and "Dante – Pokol"
 * are the same production.
 */
export function titleKey(text?: string | null): string {
  const normalized = normalizeText(text) ?? "";
  return normalized
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}
