import { expect, test } from "@playwright/test";

test("setup persona flow becomes visible in admin dashboard", async ({ page }) => {
  const uniqueUrl = `https://example.com/e2e-profile-${Date.now()}`;

  await page.goto("/setup");
  await page.getByPlaceholder("https://example.com/jane-doe").fill(uniqueUrl);
  const createProfileResponse = page.waitForResponse((response) => {
    return (
      response.url().includes("/api/interviewer-profiles") &&
      !response.url().includes("/preview") &&
      response.request().method() === "POST" &&
      response.status() === 201
    );
  });
  await page.getByRole("button", { name: "Analyze Profile" }).click();
  await createProfileResponse;

  await expect(page.getByText("Persona Preparation Timeline")).toBeVisible();
  await expect(
    page.getByText(/Preparing interviewer profile|Queued for background processing|Worker is analyzing public profile/i),
  ).toBeVisible({ timeout: 10_000 });
  await expect(page.getByText("Queue Job")).toBeVisible();

  await page.goto("/admin");
  await expect(page.getByRole("heading", { name: "Persona Jobs and Operations Feed" })).toBeVisible();
  const profileLink = page.getByRole("link", { name: new RegExp(uniqueUrl.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")) });
  await expect(profileLink).toBeVisible({ timeout: 15_000 });
  await profileLink.click();

  await expect(page.getByText("Unified Operations Feed")).toBeVisible();
  await expect(page.getByText(/Job Enqueued|Job Queued|Job Processing Started/i).first()).toBeVisible({
    timeout: 15_000,
  });
});

test("tailored interview launches and renders interviewer context in the room", async ({ page }) => {
  const uniqueUrl = `https://example.com/e2e-room-${Date.now()}`;

  await page.goto("/setup");
  await page.getByPlaceholder("https://example.com/jane-doe").fill(uniqueUrl);

  const createProfileResponse = page.waitForResponse((response) => {
    return (
      response.url().includes("/api/interviewer-profiles") &&
      !response.url().includes("/preview") &&
      response.request().method() === "POST" &&
      response.status() === 201
    );
  });

  await page.getByRole("button", { name: "Analyze Profile" }).click();
  await createProfileResponse;

  await expect(page.getByRole("button", { name: "Start Tailored Interview" })).toBeEnabled({
    timeout: 20_000,
  });

  await page.getByRole("button", { name: "Start Tailored Interview" }).click();

  await expect(page.getByText("INTERVIEW ROOM")).toBeVisible({ timeout: 15_000 });
  await expect(page.getByText(/Persona: Enabled/i)).toBeVisible();
  await expect(page.getByText(/Interviewer Context/i)).toBeVisible();
  await expect(page.getByText(/Public profile suggests|Applied prompt context prepared/i).first()).toBeVisible();
});
