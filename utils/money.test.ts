import { describe, expect, it } from "vitest";
import { MAX_TICKET_PRICE_HUF, parseTicketPrice } from "./money";

describe("parseTicketPrice", () => {
  it("reads a plain amount", () => {
    expect(parseTicketPrice("4500")).toEqual({ kind: "value", huf: 4500 });
  });

  it("accepts the three ways Hungarian writes a thousand", () => {
    // The third is a non-breaking space, which is what toLocaleString("hu-HU")
    // emits — so it is what a pasted amount actually contains.
    for (const written of ["12000", "12 000", "12\u00a0000", "12.000"]) {
      expect(parseTicketPrice(written)).toEqual({ kind: "value", huf: 12000 });
    }
  });

  it("accepts the unit the field's own placeholder shows", () => {
    expect(parseTicketPrice("4500 Ft")).toEqual({ kind: "value", huf: 4500 });
    expect(parseTicketPrice("4 500 ft.")).toEqual({ kind: "value", huf: 4500 });
  });

  it("treats an empty field as unanswered, not as free", () => {
    // These are different facts, and the diary shows them differently: a 0 Ft
    // entry says "press ticket", a null says nothing at all.
    expect(parseTicketPrice("")).toEqual({ kind: "absent" });
    expect(parseTicketPrice("   ")).toEqual({ kind: "absent" });
  });

  it("keeps zero as a real answer", () => {
    expect(parseTicketPrice("0")).toEqual({ kind: "value", huf: 0 });
  });

  it("refuses an answer it would have to guess at", () => {
    // Coercing any of these to a number would put an amount nobody typed into
    // the season total, which is the one place this value is read in bulk.
    for (const written of ["kb 4000", "négyezer", "-500", "4,5", "1e4"]) {
      expect(parseTicketPrice(written)).toEqual({ kind: "invalid" });
    }
  });

  it("refuses an amount past what the check constraint allows", () => {
    expect(parseTicketPrice(String(MAX_TICKET_PRICE_HUF))).toEqual({
      kind: "value",
      huf: MAX_TICKET_PRICE_HUF,
    });
    // A stray digit on a 12 000 Ft ticket, which is the mistake the bound is
    // there to catch rather than a judgement about ticket prices.
    expect(parseTicketPrice("12000000")).toEqual({ kind: "invalid" });
  });
});
