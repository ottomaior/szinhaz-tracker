import { describe, expect, it } from "vitest";
import { authLinkParams } from "./authLink";

describe("authLinkParams", () => {
  it("reads the implicit-flow tokens out of the fragment of a scheme URL", () => {
    const p = authLinkParams(
      "szinhaztracker:///reset-password#access_token=aaa&expires_in=3600&refresh_token=bbb&token_type=bearer&type=recovery"
    );
    expect(p.get("access_token")).toBe("aaa");
    expect(p.get("refresh_token")).toBe("bbb");
    expect(p.get("type")).toBe("recovery");
  });

  it("reads a PKCE code out of the query", () => {
    expect(authLinkParams("szinhaztracker:///?code=xyz").get("code")).toBe("xyz");
  });

  it("reads an expired link's error the same way", () => {
    const p = authLinkParams(
      "szinhaztracker:///#error=access_denied&error_code=otp_expired&error_description=Email+link+is+invalid+or+has+expired"
    );
    expect(p.get("access_token")).toBeNull();
    expect(p.get("error_code")).toBe("otp_expired");
    expect(p.get("error_description")).toBe("Email link is invalid or has expired");
  });

  it("is empty for a link that is not an auth redirect", () => {
    expect([...authLinkParams("szinhaztracker:///play/hamlet")]).toEqual([]);
    expect([...authLinkParams("https://web.vastaps.app/")]).toEqual([]);
  });
});
