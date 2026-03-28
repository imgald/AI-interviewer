import { describe, expect, it } from "vitest";
import { getStarterCode, isRunnableLanguage, normalizeLanguage, toMonacoLanguage } from "@/lib/interview/editor";

describe("interview editor helpers", () => {
  it("normalizes supported languages", () => {
    expect(normalizeLanguage("python")).toBe("PYTHON");
    expect(normalizeLanguage("JAVASCRIPT")).toBe("JAVASCRIPT");
    expect(normalizeLanguage("cpp")).toBe("C++");
  });

  it("maps languages to Monaco ids", () => {
    expect(toMonacoLanguage("PYTHON")).toBe("python");
    expect(toMonacoLanguage("JAVASCRIPT")).toBe("javascript");
    expect(toMonacoLanguage("JAVA")).toBe("java");
  });

  it("flags runnable languages and generates starter code", () => {
    expect(isRunnableLanguage("PYTHON")).toBe(true);
    expect(isRunnableLanguage("JAVASCRIPT")).toBe(true);
    expect(isRunnableLanguage("JAVA")).toBe(false);
    expect(getStarterCode("PYTHON", "Merge Intervals")).toContain("def solve");
    expect(getStarterCode("JAVASCRIPT", "Merge Intervals")).toContain("function solve");
  });
});
