import { describe, expect, it } from "vitest";
import { normalizeUrl } from "@/lib/persona/normalize-url";

describe("normalizeUrl", () => {
  it("removes the hash fragment", () => {
    expect(normalizeUrl("https://example.com/profile#about")).toBe("https://example.com/profile");
  });

  it("preserves the query string", () => {
    expect(normalizeUrl("https://example.com/profile?tab=posts#latest")).toBe(
      "https://example.com/profile?tab=posts",
    );
  });
});
