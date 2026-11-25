import { expect, type Page } from "@playwright/test";

export const ACCOUNTS = {
  admin: "admin@example.test",
  clientA: "anna.becker@muster-gmbh.test",
  clientB: "jonas.weber@beispiel-ag.test",
} as const;

export async function login(page: Page, who: keyof typeof ACCOUNTS) {
  await page.goto("/login");
  await page.getByTestId("dev-role").selectOption(ACCOUNTS[who]);
  await page.getByRole("button", { name: "Anmelden" }).click();
  if (who === "admin") {
    await expect(page.getByRole("heading", { name: "Zweiter Faktor" })).toBeVisible();
    await page.getByLabel("Bestätigungscode").fill("123456");
    await page.getByRole("button", { name: "Code prüfen" }).click();
    await expect(page).toHaveURL(/\/admin$/);
  } else {
    await expect(page).toHaveURL(/\/client$/);
  }
}

export async function logout(page: Page) {
  await page.getByTestId("user-menu").click();
  await page.getByTestId("logout").click();
  await expect(page).toHaveURL(/\/login/);
}
