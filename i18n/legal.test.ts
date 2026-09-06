import { describe, expect, it } from "vitest";
import { legalDocuments, operator, type LegalDocument } from "./legal";

/**
 * The legal documents are the one place in the app where being unfinished is
 * invisible.
 *
 * A missing screen is obvious the moment somebody opens the app. A privacy
 * policy whose controller is still `TODO_OPERATOR_NAME` renders perfectly,
 * scrolls perfectly, and is wrong in exactly the way that matters — and it
 * sits in a paragraph nobody re-reads once the page exists. So the check is a
 * test rather than a code review habit, and it fails the build rather than
 * warning: with `main` wired straight to Railway, a red CI is what keeps a
 * placeholder from being served as a legal document.
 */
describe("operator details", () => {
  const required = ["name", "address", "email"] as const;

  for (const field of required) {
    it(`has a real ${field}`, () => {
      const value = operator[field];
      expect(value).toBeTruthy();
      expect(value).not.toMatch(/TODO/);
    });
  }

  it("has a plausible email address", () => {
    expect(operator.email).toMatch(/^[^\s@]+@[^\s@]+\.[^\s@]+$/);
  });
});

/**
 * The documents themselves interpolate `operator`, so an unfilled field leaks
 * into the rendered prose. Checking the assembled text as well as the source
 * constants catches a fourth placeholder being added later and only wired into
 * one document.
 */
function allText(document: LegalDocument): string {
  const blocks = document.sections.flatMap((section) => [
    section.heading,
    ...section.blocks.flatMap((block) => (block.kind === "p" ? [block.text] : block.items)),
  ]);
  return [document.title, document.lead, ...blocks].join("\n");
}

describe.each(Object.entries(legalDocuments))("%s", (_name, document) => {
  const text = allText(document);

  it("contains no placeholder", () => {
    expect(text).not.toMatch(/TODO/);
  });

  it("has a title, a lead and at least one section", () => {
    expect(document.title).toBeTruthy();
    expect(document.lead).toBeTruthy();
    expect(document.sections.length).toBeGreaterThan(0);
  });

  it("has no empty heading or empty block", () => {
    for (const section of document.sections) {
      expect(section.heading.trim()).not.toBe("");
      expect(section.blocks.length).toBeGreaterThan(0);
      for (const block of section.blocks) {
        if (block.kind === "p") {
          expect(block.text.trim()).not.toBe("");
        } else {
          // An empty `ul` renders as nothing at all, which is how a
          // conditionally-built list (the imprint's optional registration
          // number) can quietly lose its only item.
          expect(block.items.length).toBeGreaterThan(0);
          for (const item of block.items) expect(item.trim()).not.toBe("");
        }
      }
    }
  });

  it("names the operator's contact address somewhere", () => {
    expect(text).toContain(operator.email);
  });
});

/**
 * Two claims the privacy policy makes that the code has to keep true. Both are
 * here because the failure mode is a document that quietly stops describing
 * the system — which is the specific thing a privacy policy must not do.
 */
describe("privacy policy says the things it must", () => {
  const text = allText(legalDocuments.privacy);

  it("names the supervisory authority", () => {
    expect(text).toContain("NAIH");
  });

  it("warns that diary entries are public", () => {
    // `reviews_select_all` in 0001_init.sql makes every diary entry
    // world-readable, and the ticket stub lives in a public bucket. If that
    // ever changes, this assertion is the reminder to change the copy too.
    expect(text).toMatch(/nyilvános napló/);
  });
});
