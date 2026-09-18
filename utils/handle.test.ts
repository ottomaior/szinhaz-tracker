import { describe, expect, it } from "vitest";
import { handleFromName, nameLooksDerived } from "./handle";

/**
 * Real names from this catalogue and the accounts on it, and what
 * `handle_from_name()` returns for each — checked against the live function
 * before being written down here.
 */
const table: [string, string][] = [
  ["Kovács Bence", "kovacsbence"],
  ["Nagy Zsófia", "nagyzsofia"],
  ["Tóth Eszter", "totheszter"],
  ["Für Anikó", "furaniko"],
  ["Ötvös Őrs Űrhajós", "otvosorsurhajos"],
  ["Otto Google", "ottogoogle"],
  ["Máthé Zsolt m.v.", "mathezsoltmv"],
  ["Rátkai Erzsébet Ferenczy Noémi- és Jászai Mari-díjas", "ratkaierzsebetferenczynoemiesj"],
  ["Ö", "o__"],
  ["🎭", "nezo"],
  ["", "nezo"],
];

describe("handleFromName", () => {
  it.each(table)("%s → %s", (name, handle) => {
    expect(handleFromName(name)).toBe(handle);
  });

  it("never exceeds thirty characters", () => {
    expect(handleFromName("a".repeat(80))).toHaveLength(30);
  });

  it("always satisfies the profiles_handle_shape constraint", () => {
    for (const [name] of table) expect(handleFromName(name)).toMatch(/^[a-z0-9_]{3,30}$/);
  });
});

describe("nameLooksDerived", () => {
  it("is true for the address's local part, whatever its case", () => {
    expect(nameLooksDerived("ottomaior94", "ottomaior94@gmail.com")).toBe(true);
    expect(nameLooksDerived("OttoMaior94", "ottomaior94@gmail.com")).toBe(true);
  });
  it("is true for an empty name", () => {
    expect(nameLooksDerived("", "x@y.hu")).toBe(true);
    expect(nameLooksDerived(null, "x@y.hu")).toBe(true);
  });
  it("is false for a chosen name", () => {
    expect(nameLooksDerived("Otto Maior", "ottomaior94@gmail.com")).toBe(false);
    expect(nameLooksDerived("Otto Google", null)).toBe(false);
  });
});
