import { expect, test } from "@playwright/test";
import { login } from "./helpers";

test("sidebar collapses into a drawer on mobile", async ({ page }) => {
  await login(page, "clientA");
  await expect(page.getByTestId("sidebar")).toBeHidden();
  await page.getByTestId("menu-button").click();
  const drawer = page.getByRole("dialog");
  await expect(drawer.getByRole("link", { name: "Übersicht" })).toBeVisible();
  await drawer.getByRole("link", { name: "Sicherheit" }).click();
  await expect(page).toHaveURL(/\/security$/);
  await expect(page.getByRole("dialog")).toHaveCount(0);
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
  expect(overflow).toBe(false);
});
