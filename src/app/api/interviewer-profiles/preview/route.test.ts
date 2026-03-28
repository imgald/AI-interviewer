import { describe, expect, it } from "vitest";
import { POST } from "@/app/api/interviewer-profiles/preview/route";

describe("POST /api/interviewer-profiles/preview", () => {
  it("returns a supported GitHub profile preview", async () => {
    const request = new Request("http://localhost/api/interviewer-profiles/preview", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url: "https://github.com/openai" }),
    });

    const response = await POST(request);
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.ok).toBe(true);
    expect(payload.data.sourceType).toBe("GITHUB");
    expect(payload.data.supported).toBe(true);
  });

  it("rejects invalid payloads", async () => {
    const request = new Request("http://localhost/api/interviewer-profiles/preview", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url: "not-a-url" }),
    });

    const response = await POST(request);
    const payload = await response.json();

    expect(response.status).toBe(400);
    expect(payload.ok).toBe(false);
  });
});
