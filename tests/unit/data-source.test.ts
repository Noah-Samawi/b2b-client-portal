import { beforeEach, describe, expect, it } from "vitest";
import { InMemoryPortalDataSource } from "@/lib/data/in-memory";
import { createFixtureState, DEMO_MFA_CODE, DEMO_PASSWORDS } from "@/lib/data/fixtures";
import { PortalError, type PortalErrorCode } from "@/lib/data/errors";
import { IDLE_TIMEOUT_MS } from "@/lib/session/config";

const ADMIN = { email: "admin@example.test", password: DEMO_PASSWORDS.admin };
const CLIENT_A = { email: "anna.becker@muster-gmbh.test", password: DEMO_PASSWORDS.client };
const CLIENT_B = { email: "jonas.weber@beispiel-ag.test", password: DEMO_PASSWORDS.client };

let clock: number;
let ds: InMemoryPortalDataSource;
let seq = 0;

function make() {
  clock = Date.parse("2026-11-25T10:00:00.000Z");
  seq = 0;
  ds = new InMemoryPortalDataSource(createFixtureState(), {
    now: () => clock,
    mfaCode: DEMO_MFA_CODE,
    scanDurationMs: 1000,
    idFactory: () => `id-${++seq}`,
  });
}

async function expectCode(p: Promise<unknown>, code: PortalErrorCode) {
  await expect(p).rejects.toBeInstanceOf(PortalError);
  await p.catch((e: PortalError) => expect(e.code).toBe(code));
}

async function asAdmin() {
  const r = await ds.signIn(ADMIN);
  expect(r.status).toBe("mfa_required");
  await ds.verifyMfa(DEMO_MFA_CODE);
}

const pdf = (name = "Angebot.pdf") => ({ name, mimeType: "application/pdf" as const, sizeBytes: 1000 });

beforeEach(make);

describe("authentication & MFA", () => {
  it("rejects wrong credentials with a typed error", async () => {
    await expectCode(ds.signIn({ email: ADMIN.email, password: "falsch12345" }), "INVALID_CREDENTIALS");
  });

  it("requires a second factor for admins before any admin operation", async () => {
    await ds.signIn(ADMIN);
    await expectCode(ds.listProjectsForUser(), "MFA_REQUIRED");
    await expectCode(ds.verifyMfa("000000"), "MFA_INVALID");
    await ds.verifyMfa(DEMO_MFA_CODE);
    expect((await ds.getSessionStatus()).aal).toBe("aal2");
    await expect(ds.listProjectsForUser()).resolves.toHaveLength(2);
  });

  it("lets clients without a factor sign in directly; enrollment then enforces aal2 next time", async () => {
    expect((await ds.signIn(CLIENT_A)).status).toBe("authenticated");
    const enrollment = await ds.enrollMfa();
    expect(enrollment.backupCodes).toHaveLength(8);
    await expectCode(ds.confirmMfaEnrollment(enrollment.factorId, "111111"), "MFA_INVALID");
    await ds.confirmMfaEnrollment(enrollment.factorId, DEMO_MFA_CODE);
    await ds.signOut();
    expect((await ds.signIn(CLIENT_A)).status).toBe("mfa_required");
    await expectCode(ds.listProjectsForUser(), "MFA_REQUIRED");
    // backup codes are single use
    await ds.verifyMfa(enrollment.backupCodes[0]!);
    await ds.signOut();
    await ds.signIn(CLIENT_A);
    await expectCode(ds.verifyMfa(enrollment.backupCodes[0]!), "MFA_INVALID");
  });
});

describe("access separation", () => {
  it("clients only see their own non-archived projects", async () => {
    await ds.signIn(CLIENT_A);
    const projects = await ds.listProjectsForUser({ includeArchived: true });
    expect(projects.map((p) => p.id)).toEqual(["p-website"]);
    await expectCode(ds.getProject("p-crm"), "NOT_FOUND");
    await expectCode(ds.getProject("p-logo"), "NOT_FOUND"); // archived
    await expectCode(ds.listFiles("p-crm"), "NOT_FOUND");
  });

  it("clients cannot call admin operations", async () => {
    await ds.signIn(CLIENT_A);
    await expectCode(ds.setProgress("p-website", 90), "FORBIDDEN");
    await expectCode(ds.updateProject("p-website", { title: "X" }), "FORBIDDEN");
    await expectCode(ds.createProject({ title: "X" }), "FORBIDDEN");
    await expectCode(ds.inviteMember("p-website", { email: "a@b.test", fullName: "A" }), "FORBIDDEN");
    await expectCode(ds.requestUploadUrl("p-website", pdf()), "FORBIDDEN");
    await expectCode(ds.listClients(), "FORBIDDEN");
    await expectCode(ds.archiveProject("p-website"), "FORBIDDEN");
    await expectCode(ds.requestClientDeletion("u-client-b", { reason: "Test Grund", confirmation: "LÖSCHEN" }), "FORBIDDEN");
  });

  it("unauthenticated calls are rejected", async () => {
    await expectCode(ds.listProjectsForUser(), "UNAUTHENTICATED");
    expect(await ds.getCurrentUser()).toBeNull();
  });

  it("invited members are always clients", async () => {
    await asAdmin();
    await expectCode(ds.inviteMember("p-crm", { email: "admin@example.test", fullName: "X" }), "VALIDATION");
    const m = await ds.inviteMember("p-crm", { email: "neu@kunde.test", fullName: "Neu" });
    expect(m.role).toBe("client");
    expect(m.state).toBe("invited");
    await expectCode(ds.inviteMember("p-crm", { email: "neu@kunde.test", fullName: "Neu" }), "CONFLICT");
  });
});

describe("files, scanning, approvals", () => {
  it("approval and download require a clean scan", async () => {
    await asAdmin();
    const t = await ds.requestUploadUrl("p-website", pdf());
    const f = await ds.confirmUpload(t.uploadId);
    expect(f).toMatchObject({ status: "pending", scanStatus: "pending", version: 1 });
    await expectCode(ds.getDownloadUrl(f.id), "SCAN_NOT_CLEAN");
    await ds.signOut();
    await ds.signIn(CLIENT_A);
    await expectCode(ds.approveFile(f.id), "SCAN_NOT_CLEAN");
    clock += 1500;
    const [listed] = (await ds.listFiles("p-website")).filter((x) => x.id === f.id);
    expect(listed?.scanStatus).toBe("clean");
    expect((await ds.approveFile(f.id)).status).toBe("approved");
    await expect(ds.getDownloadUrl(f.id)).resolves.toMatchObject({ fileName: "Angebot.pdf" });
  });

  it("infected files are quarantined from clients", async () => {
    await asAdmin();
    const t = await ds.requestUploadUrl("p-website", pdf("eicar-test.pdf"));
    const f = await ds.confirmUpload(t.uploadId);
    clock += 1500;
    const adminFiles = await ds.listFiles("p-website");
    expect(adminFiles.find((x) => x.id === f.id)?.scanStatus).toBe("infected");
    await expectCode(ds.getDownloadUrl(f.id), "SCAN_NOT_CLEAN");
    await ds.signOut();
    await ds.signIn(CLIENT_A);
    const clientFiles = await ds.listFiles("p-website");
    expect(clientFiles.some((x) => x.scanStatus === "infected")).toBe(false);
    await expectCode(ds.getDownloadUrl(f.id), "NOT_FOUND");
    await expectCode(ds.approveFile(f.id), "NOT_FOUND");
  });

  it("a new version keeps history, increments the number and resets approval", async () => {
    await asAdmin();
    const before = await ds.listFileVersions("g-website-konzept");
    expect(before.map((v) => v.version)).toEqual([2, 1]);
    const t = await ds.requestUploadUrl("p-website", pdf("Konzept_Website.pdf"), "g-website-konzept");
    const v3 = await ds.confirmUpload(t.uploadId);
    expect(v3).toMatchObject({ version: 3, isCurrent: true, status: "pending", versionCount: 3 });
    const after = await ds.listFileVersions("g-website-konzept");
    expect(after.map((v) => v.version)).toEqual([3, 2, 1]);
    expect(after.filter((v) => v.isCurrent)).toHaveLength(1);
    // approved image gets a new version → pending again
    const t2 = await ds.requestUploadUrl("p-website", { name: "Startseite_Entwurf.png", mimeType: "image/png", sizeBytes: 10 }, "g-website-design");
    expect((await ds.confirmUpload(t2.uploadId)).status).toBe("pending");
  });

  it("concurrent uploads to the same group never produce duplicate version numbers", async () => {
    await asAdmin();
    const tickets = await Promise.all(
      [1, 2, 3].map(() => ds.requestUploadUrl("p-website", pdf("Konzept_Website.pdf"), "g-website-konzept")),
    );
    const files = await Promise.all(tickets.map((t) => ds.confirmUpload(t.uploadId)));
    expect(new Set(files.map((f) => f.version)).size).toBe(3);
    const versions = await ds.listFileVersions("g-website-konzept");
    expect(versions.filter((v) => v.isCurrent)).toHaveLength(1);
  });

  it("upload tickets are single use and validated", async () => {
    await asAdmin();
    await expectCode(ds.requestUploadUrl("p-website", { name: "x.exe", mimeType: "application/pdf", sizeBytes: 10 }), "VALIDATION");
    await expectCode(ds.requestUploadUrl("p-website", { ...pdf(), sizeBytes: 60 * 1024 * 1024 }), "VALIDATION");
    const t = await ds.requestUploadUrl("p-website", pdf());
    await ds.confirmUpload(t.uploadId);
    await expectCode(ds.confirmUpload(t.uploadId), "NOT_FOUND");
  });

  it("clients cannot revert approvals; admins can", async () => {
    await ds.signIn(CLIENT_A);
    await expectCode(ds.revertFile("f-website-design"), "FORBIDDEN");
    await ds.signOut();
    await asAdmin();
    expect((await ds.revertFile("f-website-design")).status).toBe("pending");
  });
});

describe("archiving and deletion", () => {
  it("archived projects disappear for clients and become read-only", async () => {
    await asAdmin();
    await ds.archiveProject("p-website");
    await expectCode(ds.setProgress("p-website", 10), "INVALID_STATE");
    await ds.signOut();
    await ds.signIn(CLIENT_A);
    expect(await ds.listProjectsForUser()).toHaveLength(0);
  });

  it("deletion requests require explicit confirmation and use the retention period", async () => {
    await asAdmin();
    await expectCode(ds.requestClientDeletion("u-client-b", { reason: "Vertrag beendet", confirmation: "ja" as never }), "VALIDATION");
    const r = await ds.requestClientDeletion("u-client-b", { reason: "Vertrag beendet", confirmation: "LÖSCHEN" });
    const { retentionDays } = await ds.getRetentionPolicy();
    expect(Date.parse(r.scheduledFor) - Date.parse(r.createdAt)).toBe(retentionDays * 86_400_000);
    await expectCode(ds.requestClientDeletion("u-client-b", { reason: "Vertrag beendet", confirmation: "LÖSCHEN" }), "CONFLICT");
    expect((await ds.listClients()).find((c) => c.id === "u-client-b")?.pendingDeletion).toBe(true);
    await ds.cancelDeletionRequest(r.id);
    expect((await ds.listClients()).find((c) => c.id === "u-client-b")?.pendingDeletion).toBe(false);
  });

  it("requesting project deletion archives the project", async () => {
    await asAdmin();
    await ds.requestProjectDeletion("p-crm", { reason: "Kunde gekündigt", confirmation: "LÖSCHEN" });
    expect((await ds.getProject("p-crm")).archived).toBe(true);
    await expectCode(ds.unarchiveProject("p-crm"), "INVALID_STATE");
  });
});

describe("idle timeout (server-side simulation)", () => {
  it.each([["admin"], ["client"]])("expires %s sessions after 30 minutes without activity", async (role) => {
    if (role === "admin") await asAdmin();
    else await ds.signIn(CLIENT_B);
    clock += IDLE_TIMEOUT_MS - 1000;
    await ds.touchSession();
    clock += IDLE_TIMEOUT_MS - 1000;
    await expect(ds.listProjectsForUser()).resolves.toBeDefined();
    clock += 2000;
    await expectCode(ds.listProjectsForUser(), "SESSION_EXPIRED");
    await expectCode(ds.listProjectsForUser(), "UNAUTHENTICATED");
  });

  it("read-only polling does not extend the session", async () => {
    await ds.signIn(CLIENT_B);
    for (let i = 0; i < 10; i++) {
      clock += 3 * 60 * 1000;
      await ds.listProjectsForUser();
    }
    clock += 60 * 1000 + 1;
    await expectCode(ds.listProjectsForUser(), "SESSION_EXPIRED");
  });
});
