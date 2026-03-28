import type { SourceType } from "@prisma/client";

export function detectSourceType(url: string): SourceType {
  const hostname = new URL(url).hostname.replace(/^www\./, "");

  if (hostname.includes("linkedin.com")) return "LINKEDIN";
  if (hostname.includes("github.com")) return "GITHUB";
  if (hostname.includes("scholar.google.com")) return "SCHOLAR";
  if (hostname.includes("medium.com") || hostname.includes("substack.com")) return "BLOG";
  if (hostname.includes("about.") || hostname.includes("team.") || hostname.includes("people.")) {
    return "COMPANY_BIO";
  }

  return "PERSONAL_SITE";
}
