import { describe, expect, it } from "vitest";
import { posterOf } from "./orkeny";

/**
 * Shapes taken from `/api/performances` on 21 September 2026: `image` with no
 * leading slash, `images[].image` with one, and productions carrying either
 * field alone.
 */
describe("orkeny posterOf", () => {
  it("takes the card picture when the API has one", () => {
    expect(
      posterOf({
        image: "uploads/performances/815b668313509940e0af16d208e3328d.webp",
        images: [{ image: "/uploads/performances/images/fe4b56ebedbf70f4d721f17b395286b5.webp" }],
      })
    ).toBe("https://orkenyszinhaz.hu/uploads/performances/815b668313509940e0af16d208e3328d.webp");
  });

  it("falls back to the hero picture when the card one is empty", () => {
    // Gyógyfürdő: `image` null, artwork only in `images`. This is the case
    // that showed a letter tile in the app.
    expect(
      posterOf({ image: null, images: [{ image: "/uploads/performances/images/22d69b18631b959c09901707d1030bd6.webp" }] })
    ).toBe("https://orkenyszinhaz.hu/uploads/performances/images/22d69b18631b959c09901707d1030bd6.webp");
  });

  it("skips an empty slot in the hero list", () => {
    expect(posterOf({ image: null, images: [{ image: null }, { image: "/uploads/x.webp" }] })).toBe(
      "https://orkenyszinhaz.hu/uploads/x.webp"
    );
  });

  it("returns nothing when neither is set", () => {
    expect(posterOf({ image: null, images: [] })).toBeUndefined();
    expect(posterOf({})).toBeUndefined();
  });
});
