import { expect, test } from "@playwright/test";
import { login, logout } from "./helpers";

test.describe("Admin", () => {
  test("logs in with second factor, opens a project and changes progress", async ({ page }) => {
    await login(page, "admin");
    await expect(page.getByRole("heading", { name: "Projekte", level: 1 })).toBeVisible();
    await page.getByRole("link", { name: "Website-Relaunch Muster GmbH" }).click();
    await expect(page.getByTestId("project-title")).toHaveText("Website-Relaunch Muster GmbH");

    const input = page.getByLabel("Fortschritt (0–100)");
    await input.fill("101");
    await page.getByRole("button", { name: "Fortschritt speichern" }).click();
    await expect(page.getByText("Der Fortschritt darf höchstens 100 sein.")).toBeVisible();

    await input.fill("40");
    await page.getByRole("button", { name: "Fortschritt speichern" }).click();
    await expect(page.getByText("Fortschritt auf 40 % gesetzt.")).toBeVisible();
    await expect(page.getByRole("progressbar", { name: "Projektfortschritt in Prozent" })).toHaveAttribute("aria-valuenow", "40");

    // persists for the browser session
    await page.reload();
    await expect(page.getByRole("progressbar", { name: "Projektfortschritt in Prozent" })).toHaveAttribute("aria-valuenow", "40");
  });

  test("rejects a wrong second factor", async ({ page }) => {
    await page.goto("/login");
    await page.getByTestId("dev-role").selectOption("admin@example.test");
    await page.getByRole("button", { name: "Anmelden" }).click();
    await page.getByLabel("Bestätigungscode").fill("000000");
    await page.getByRole("button", { name: "Code prüfen" }).click();
    await expect(page.getByRole("alert").filter({ hasText: "Der Code ist ungültig." })).toBeVisible();
    await expect(page).toHaveURL(/\/login/);
  });

  test("uploads a file, scan runs, new version resets approval", async ({ page }) => {
    await login(page, "admin");
    await page.getByRole("link", { name: "Website-Relaunch Muster GmbH" }).click();
    await page.getByTestId("upload-input").setInputFiles({ name: "Angebot.pdf", mimeType: "application/pdf", buffer: Buffer.from("%PDF-1.4 demo") });
    const row = page.locator('[data-testid="file-row"][data-file-name="Angebot.pdf"]');
    await expect(row).toBeVisible();
    await expect(row.getByTestId("scan-badge")).toHaveText("Virenfrei", { timeout: 15_000 });
    await expect(row.getByTestId("status-badge")).toHaveText("Freigabe ausstehend");

    // new version of an approved file
    const design = page.locator('[data-testid="file-row"][data-file-name="Startseite_Entwurf.png"]');
    await expect(design.getByTestId("status-badge")).toHaveText("Freigegeben");
    await design.getByRole("button", { name: /Weitere Aktionen/ }).click();
    const chooser = page.waitForEvent("filechooser");
    await page.getByRole("menuitem", { name: "Neue Version hochladen" }).click();
    await (await chooser).setFiles({ name: "Startseite_Entwurf.png", mimeType: "image/png", buffer: Buffer.from("png") });
    await expect(design.getByTestId("status-badge")).toHaveText("Freigabe ausstehend");
    await expect(design).toContainText("v2");
    await design.getByRole("button", { name: /Versionsverlauf von Startseite_Entwurf.png/ }).click();
    await expect(page.getByTestId("version-list").locator("li")).toHaveCount(2);
  });

  test("infected upload is quarantined", async ({ page }) => {
    await login(page, "admin");
    await page.getByRole("link", { name: "Website-Relaunch Muster GmbH" }).click();
    await page.getByTestId("upload-input").setInputFiles({ name: "eicar-test.txt", mimeType: "text/plain", buffer: Buffer.from("x") });
    const row = page.locator('[data-testid="file-row"][data-file-name="eicar-test.txt"]');
    await expect(row.getByTestId("scan-badge")).toHaveText("Quarantäne", { timeout: 15_000 });
    await expect(row.getByRole("button", { name: /herunterladen/ })).toBeDisabled();
  });

  test("rejects disallowed file types in the UI", async ({ page }) => {
    await login(page, "admin");
    await page.getByRole("link", { name: "Website-Relaunch Muster GmbH" }).click();
    await page.getByTestId("upload-input").setInputFiles({ name: "tool.exe", mimeType: "application/x-msdownload", buffer: Buffer.from("MZ") });
    await expect(page.getByTestId("toast").filter({ hasText: "tool.exe" })).toBeVisible();
    await expect(page.locator('[data-file-name="tool.exe"]')).toHaveCount(0);
  });

  test("invites a client and archives a project, which hides it from the client", async ({ page }) => {
    await login(page, "admin");
    await page.getByRole("link", { name: "Website-Relaunch Muster GmbH" }).click();
    await page.getByRole("button", { name: "Kunde einladen" }).click();
    await page.getByLabel("Name").fill("Lea Neu");
    await page.getByLabel("E-Mail-Adresse").fill("lea.neu@muster-gmbh.test");
    await page.getByRole("button", { name: "Einladen" }).click();
    await expect(page.getByTestId("member-list")).toContainText("lea.neu@muster-gmbh.test");

    await page.getByRole("button", { name: "Projekt archivieren" }).click();
    await page.getByRole("alertdialog").getByRole("button", { name: "Projekt archivieren" }).click();
    await expect(page.getByText("Dieses Projekt ist archiviert")).toBeVisible();
    await expect(page.getByTestId("upload-input")).toBeAttached();
    await expect(page.getByRole("button", { name: /Dateien hierher ziehen/ })).toBeDisabled();

    await logout(page);
    await login(page, "clientA");
    await expect(page.getByText("Noch keine Projekte")).toBeVisible();
  });

  test("deletion request requires explicit confirmation and shows retention", async ({ page }) => {
    await login(page, "admin");
    await page.getByRole("link", { name: "Kunden & Löschung" }).first().click();
    await page.getByRole("button", { name: "Löschung für Jonas Weber beantragen" }).click();
    await expect(page.getByTestId("retention-notice")).toContainText("Aufbewahrungsfrist: 30 Tage");
    await page.getByLabel("Grund").fill("Vertrag beendet");
    await page.getByLabel(/Zur Bestätigung/).fill("ja");
    await page.getByRole("button", { name: "Löschung verbindlich beantragen" }).click();
    await expect(page.getByText(/Zur Bestätigung bitte „LÖSCHEN“ eingeben/)).toBeVisible();
    await page.getByLabel(/Zur Bestätigung/).fill("LÖSCHEN");
    await page.getByRole("button", { name: "Löschung verbindlich beantragen" }).click();
    await expect(page.getByTestId("deletion-requests")).toContainText("Jonas Weber");
    await expect(page.getByTestId("client-row").filter({ hasText: "Jonas Weber" })).toContainText("Löschung beantragt");
  });
});

test.describe("Client", () => {
  test("sees only own projects and approves a file without revert option", async ({ page }) => {
    await login(page, "clientA");
    await expect(page.getByTestId("project-card")).toHaveCount(1);
    await expect(page.getByText("CRM-Integration Beispiel AG")).toHaveCount(0);
    await expect(page.getByText(/Logo-Überarbeitung/)).toHaveCount(0); // archived

    await page.getByRole("link", { name: "Website-Relaunch Muster GmbH" }).click();
    await expect(page.locator('[data-file-name="Lieferant_Export.zip"]')).toHaveCount(0); // quarantined

    const row = page.locator('[data-testid="file-row"][data-file-name="Konzept_Website.pdf"]');
    await row.getByRole("button", { name: "Konzept_Website.pdf freigeben" }).click();
    const dialog = page.getByRole("alertdialog");
    await expect(dialog).toContainText("kann von dir nicht zurückgenommen werden");
    await dialog.getByRole("button", { name: "Freigeben" }).click();
    await expect(row.getByTestId("status-badge")).toHaveText("Freigegeben");
    await expect(row.getByRole("button", { name: /freigeben/ })).toHaveCount(0);
    await expect(row.getByText("Freigabe zurücknehmen")).toHaveCount(0);
  });

  test("cannot access admin routes or other clients' projects", async ({ page }) => {
    await login(page, "clientA");
    await page.goto("/admin");
    await expect(page).toHaveURL(/\/client$/);
    await page.goto("/admin/projects/p-website");
    await expect(page).toHaveURL(/\/client$/);
    await page.goto("/client/projects/p-crm");
    await expect(page.getByText("Projekt nicht gefunden oder kein Zugriff.")).toBeVisible();
  });
});

test.describe("Unauthenticated", () => {
  test("protected routes redirect to login", async ({ page }) => {
    for (const path of ["/admin", "/client", "/security", "/admin/projects/p-website"]) {
      await page.goto(path);
      await expect(page).toHaveURL(/\/login\?reason=required/);
    }
  });

  test("forged routing cookie does not grant access", async ({ page, context }) => {
    await context.addCookies([{ name: "kp_role", value: "admin", url: "http://localhost:3100" }]);
    await page.goto("/admin");
    await expect(page).toHaveURL(/\/login/);
  });
});
