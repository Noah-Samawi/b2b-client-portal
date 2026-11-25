import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { login } from "./helpers";

async function audit(page: Page) {
  const result = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze();
  const summary = result.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(" ")).join(", ")}`);
  expect(summary).toEqual([]);
}

test("login page has no WCAG A/AA violations", async ({ page }) => {
  await page.goto("/login");
  await audit(page);
});

test("admin project page has no WCAG A/AA violations", async ({ page }) => {
  await login(page, "admin");
  await page.goto("/admin/projects/p-website");
  await expect(page.getByTestId("project-title")).toBeVisible();
  await expect(page.getByTestId("file-row").first()).toBeVisible();
  await audit(page);
});

test("client project page has no WCAG A/AA violations", async ({ page }) => {
  await login(page, "clientA");
  await page.goto("/client/projects/p-website");
  await expect(page.getByTestId("file-row").first()).toBeVisible();
  await audit(page);
});

test("dialogs are keyboard operable", async ({ page }) => {
  await login(page, "admin");
  await page.goto("/admin/projects/p-website");
  await page.getByRole("button", { name: "Kunde einladen" }).focus();
  await page.keyboard.press("Enter");
  await expect(page.getByRole("dialog")).toBeVisible();
  await expect(page.getByLabel("Name")).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Kunde einladen" })).toBeFocused();
});
