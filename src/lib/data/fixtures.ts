/**
 * PHASE 1 ONLY, replaced in Phase 2.
 *
 * This is the ONLY file that contains fixture data. It is consumed exclusively by
 * ./in-memory.ts via ./index.ts. UI code must never import this file
 * (enforced by ESLint `no-restricted-imports` and tests/architecture.test.ts).
 *
 * All names and addresses are fictitious. E-mail domains use the reserved `.test` TLD.
 */
import type { MemoryState } from "./in-memory";

export const DEMO_PASSWORDS = {
  admin: "Admin1234!",
  client: "Kunde1234!",
} as const;

/** Simulated TOTP code accepted in Phase 1. NOT a security mechanism. */
export const DEMO_MFA_CODE = "123456";

export const DEMO_ACCOUNTS = [
  { label: "Admin", email: "admin@example.test", password: DEMO_PASSWORDS.admin },
  { label: "Kunde A (Muster GmbH)", email: "anna.becker@muster-gmbh.test", password: DEMO_PASSWORDS.client },
  { label: "Kunde B (Beispiel AG)", email: "jonas.weber@beispiel-ag.test", password: DEMO_PASSWORDS.client },
] as const;

const T0 = "2026-10-01T08:00:00.000Z";
const T1 = "2026-10-15T09:30:00.000Z";
const T2 = "2026-11-02T14:10:00.000Z";
const T3 = "2026-11-18T10:45:00.000Z";

export function createFixtureState(): MemoryState {
  return {
    retentionDays: 30,
    users: [
      {
        id: "u-admin",
        email: "admin@example.test",
        fullName: "Noah Admin",
        role: "admin",
        company: null,
        mfaEnrolled: true,
        createdAt: T0,
        password: DEMO_PASSWORDS.admin,
        activated: true,
      },
      {
        id: "u-client-a",
        email: "anna.becker@muster-gmbh.test",
        fullName: "Anna Becker",
        role: "client",
        company: "Muster GmbH",
        mfaEnrolled: false,
        createdAt: T0,
        password: DEMO_PASSWORDS.client,
        activated: true,
      },
      {
        id: "u-client-b",
        email: "jonas.weber@beispiel-ag.test",
        fullName: "Jonas Weber",
        role: "client",
        company: "Beispiel AG",
        mfaEnrolled: false,
        createdAt: T0,
        password: DEMO_PASSWORDS.client,
        activated: true,
      },
    ],
    projects: [
      {
        id: "p-website",
        title: "Website-Relaunch Muster GmbH",
        description: "Neugestaltung der Unternehmenswebsite inkl. Kontaktformular und Karriereseite.",
        progress: 65,
        archived: false,
        archivedAt: null,
        createdBy: "u-admin",
        createdAt: T0,
        updatedAt: T2,
      },
      {
        id: "p-crm",
        title: "CRM-Integration Beispiel AG",
        description: "Anbindung des bestehenden CRM an das Bestellsystem mit automatischem Datenabgleich.",
        progress: 30,
        archived: false,
        archivedAt: null,
        createdBy: "u-admin",
        createdAt: T1,
        updatedAt: T3,
      },
      {
        id: "p-logo",
        title: "Logo-Überarbeitung Muster GmbH (abgeschlossen)",
        description: "Abgeschlossenes Projekt, archiviert. Für Kunden nicht mehr sichtbar.",
        progress: 100,
        archived: true,
        archivedAt: T1,
        createdBy: "u-admin",
        createdAt: T0,
        updatedAt: T1,
      },
    ],
    members: [
      { projectId: "p-website", userId: "u-client-a", addedAt: T0 },
      { projectId: "p-crm", userId: "u-client-b", addedAt: T1 },
      { projectId: "p-logo", userId: "u-client-a", addedAt: T0 },
    ],
    versions: [
      {
        id: "f-website-konzept-v1",
        groupId: "g-website-konzept",
        projectId: "p-website",
        version: 1,
        isCurrent: false,
        name: "Konzept_Website.pdf",
        mimeType: "application/pdf",
        sizeBytes: 1_480_000,
        status: "approved",
        scanStatus: "clean",
        uploadedBy: "u-admin",
        createdAt: T1,
        approvedAt: T1,
        approvedBy: "u-client-a",
        scanStartedAt: T1,
      },
      {
        id: "f-website-konzept-v2",
        groupId: "g-website-konzept",
        projectId: "p-website",
        version: 2,
        isCurrent: true,
        name: "Konzept_Website.pdf",
        mimeType: "application/pdf",
        sizeBytes: 1_620_000,
        status: "pending",
        scanStatus: "clean",
        uploadedBy: "u-admin",
        createdAt: T2,
        approvedAt: null,
        approvedBy: null,
        scanStartedAt: T2,
      },
      {
        id: "f-website-design",
        groupId: "g-website-design",
        projectId: "p-website",
        version: 1,
        isCurrent: true,
        name: "Startseite_Entwurf.png",
        mimeType: "image/png",
        sizeBytes: 820_000,
        status: "approved",
        scanStatus: "clean",
        uploadedBy: "u-admin",
        createdAt: T1,
        approvedAt: T2,
        approvedBy: "u-client-a",
        scanStartedAt: T1,
      },
      {
        id: "f-website-quarantine",
        groupId: "g-website-quarantine",
        projectId: "p-website",
        version: 1,
        isCurrent: true,
        name: "Lieferant_Export.zip",
        mimeType: "application/zip",
        sizeBytes: 2_300_000,
        status: "pending",
        scanStatus: "infected",
        uploadedBy: "u-admin",
        createdAt: T3,
        approvedAt: null,
        approvedBy: null,
        scanStartedAt: T3,
      },
      {
        id: "f-crm-spec",
        groupId: "g-crm-spec",
        projectId: "p-crm",
        version: 1,
        isCurrent: true,
        name: "Schnittstellen_Spezifikation.docx",
        mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        sizeBytes: 540_000,
        status: "pending",
        scanStatus: "clean",
        uploadedBy: "u-admin",
        createdAt: T3,
        approvedAt: null,
        approvedBy: null,
        scanStartedAt: T3,
      },
      {
        id: "f-logo-final",
        groupId: "g-logo-final",
        projectId: "p-logo",
        version: 1,
        isCurrent: true,
        name: "Logo_final.svg",
        mimeType: "image/svg+xml",
        sizeBytes: 42_000,
        status: "approved",
        scanStatus: "clean",
        uploadedBy: "u-admin",
        createdAt: T0,
        approvedAt: T1,
        approvedBy: "u-client-a",
        scanStartedAt: T0,
      },
    ],
    uploads: [],
    deletionRequests: [],
    mfaEnrollments: [],
    audit: [],
    session: null,
  };
}
