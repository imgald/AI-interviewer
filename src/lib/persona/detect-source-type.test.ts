import { describe, expect, it } from "vitest";
import { detectSourceType } from "@/lib/persona/detect-source-type";

describe("detectSourceType", () => {
  it("detects GitHub profiles", () => {
    expect(detectSourceType("https://github.com/example")).toBe("GITHUB");
  });

  it("detects blogs", () => {
    expect(detectSourceType("https://medium.com/@example/post")).toBe("BLOG");
  });

  it("falls back to personal site", () => {
    expect(detectSourceType("https://example.com/about")).toBe("PERSONAL_SITE");
  });
});
