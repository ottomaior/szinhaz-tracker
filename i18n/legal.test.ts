import { describe, expect, it } from "vitest";
import {
  legalDocuments,
  operator,
  operatorDetailsComplete,
  pendingNotice,
  type LegalDocument,
} from "./legal";

/**
 * The legal documents are the one place in the app where being unfinished is
 * invisible.
 *
 * A missing screen is obvious the moment somebody opens the app. A privacy
 * policy whose controller is still `TODO_OPERATOR_NAME` renders perfectly,
 * scrolls perfectly, and is wrong in exactly the way that matters — in a
 * paragraph nobody re-reads once the page exists.
 *
 * The first version of this file failed while the details were unfilled, on the
 * grounds that a red build is what keeps a placeholder out of production. That
 * was the wrong gate. The details are not due until shortly before launch, and
 * a suite that stays red for weeks stops being read — which is the same failure
 * as a counter that never moves, one level up.
 *
 * So the assertion is not "the details are filled" but **"whichever state we
 * are in, it is coherent"**: either the documents are complete and publishable,
 * or they are visibly unfinished and the screens say so instead of rendering a
 * placeholder at somebody. `npm run check:launch` is the hard gate, run
 * deliberately rather than on every commit.
 */
describe("operator details", () => {
  const complete = operatorDetailsComplete();

  it("reports completeness consistently with its own values", () => {
    const anyPlaceholder = [operator.name, operator.address, operator.email].some(
      (value) => value.length === 0 || value.startsWith("TODO_")
    );
    expect(complete).toBe(!anyPlaceholder);
  });

  it.runIf(complete)("has a plausible email address", () => {
    expect(operator.email).toMatch(/^[^\s@]+@[^\s@]+\.[^\s@]+$/);
  });

  it.runIf(!complete)("has something to show in the meantime", () => {
    // The screens fall back to this, so an empty notice would mean a legal
    // route that renders a title and nothing else.
    expect(pendingNotice.heading.trim()).not.toBe("");
    expect(pendingNotice.body.trim()).not.toBe("");
    expect(pendingNotice.heading).not.toMatch(/TODO/);
    expect(pendingNotice.body).not.toMatch(/TODO/);
  });
});

/**
 * The documents themselves are checked whether or not they can be published
 * yet: their structure is finished even while the operator is not, and a
 * missing heading or an empty list is the kind of thing that would otherwise
 * only be found by reading three thousand words on a phone.
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
    // True in both states: while the details are placeholders this asserts the
    // interpolation still reaches every document, so filling them in later
    // cannot leave one behind.
    expect(text).toContain(operator.email);
  });

  it.runIf(operatorDetailsComplete())("contains no placeholder", () => {
    expect(text).not.toMatch(/TODO/);
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
