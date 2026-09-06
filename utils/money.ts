/**
 * Reading a forint amount out of a text field.
 *
 * In `utils/` rather than in the check-in screen for the reason
 * `vitest.config.ts` gives about `utils/people.ts`: no React dependency, and a
 * class of bug that is invisible on screen. A price that silently parses to
 * something other than what was typed does not look wrong anywhere — it looks
 * like a number — and it is one of the two inputs the season page will add up.
 */

/** The bounds `reviews_price_huf_sane` enforces in 0028. */
export const MAX_TICKET_PRICE_HUF = 1_000_000;

export type TicketPrice =
  /** The field was empty: not recorded, which is different from free. */
  | { kind: "absent" }
  | { kind: "value"; huf: number }
  | { kind: "invalid" };

/**
 * Hungarian writes four thousand five hundred as "4500", "4 500" or "4.500",
 * and a phone keyboard adds whichever separator the user is used to. All three
 * mean the same number, so the separators are stripped rather than rejected —
 * including the non-breaking space, which is what `toLocaleString("hu-HU")`
 * produces and therefore what a pasted amount is likely to contain.
 *
 * What is *not* forgiven is a genuinely non-numeric answer. Coercing "kb 4000"
 * to 4000, or to zero, would put a number nobody typed into the season total;
 * saying so and refusing the save is the honest failure.
 *
 * A trailing "Ft" is accepted because the field's own placeholder is "Ft" and
 * people type units back at forms that show them.
 */
export function parseTicketPrice(raw: string): TicketPrice {
  const cleaned = raw
    .replace(/\u00a0/g, " ")
    .replace(/\bft\b\.?/gi, "")
    .replace(/[\s.]/g, "")
    .trim();

  if (cleaned.length === 0) return { kind: "absent" };
  if (!/^\d+$/.test(cleaned)) return { kind: "invalid" };

  const huf = Number(cleaned);
  if (!Number.isSafeInteger(huf) || huf > MAX_TICKET_PRICE_HUF) return { kind: "invalid" };
  return { kind: "value", huf };
}
