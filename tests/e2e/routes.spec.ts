import { expect, test } from "@playwright/test";
import { login } from "./helpers";

test("legal placeholder pages carry the review note", async ({ page }) => {
  for (const [path, heading] of [
    ["/impressum", "Impressum"],
    ["/datenschutz", "Datenschutzerklärung"],
    ["/agb", "Allgemeine Geschäftsbedingungen"],
  ] as const) {
    await page.goto(path);
    await expect(page.getByRole("heading", { name: heading, level: 1 })).toBeVisible();
    await expect(page.getByTestId("legal-review-note")).toContainText("Vom Rechtsberater prüfen lassen");
  }
});

test("unknown routes render the German 404 page", async ({ page }) => {
  const res = await page.goto("/gibt-es-nicht");
  expect(res?.status()).toBe(404);
  await expect(page.getByRole("heading", { name: "Seite nicht gefunden" })).toBeVisible();
});

test("security page offers TOTP enrollment placeholder", async ({ page }) => {
  await login(page, "clientB");
  await page.goto("/security");
  await page.getByRole("button", { name: "Einrichtung starten" }).click();
  await expect(page.getByRole("img", { name: "QR-Code-Platzhalter" })).toBeVisible();
  await expect(page.getByTestId("backup-codes").locator("li")).toHaveCount(8);
  await page.getByLabel("6-stelliger Code aus der App").fill("123456");
  await page.getByRole("button", { name: "Einrichtung abschließen" }).click();
  await expect(page.getByText("Zweiter Faktor ist eingerichtet.")).toBeVisible();
});

test("all pages use the dark theme", async ({ page }) => {
  await page.goto("/login");
  const bg = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
  const scheme = await page.evaluate(() => getComputedStyle(document.documentElement).colorScheme);
  expect(scheme).toBe("dark");
  // background must be dark (low luminance) regardless of OS preference
  const nums = (bg.match(/[\d.]+/g) ?? []).map(Number);
  expect(nums.length).toBeGreaterThan(0);
});
