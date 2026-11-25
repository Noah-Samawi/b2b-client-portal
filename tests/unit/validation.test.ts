import { describe, expect, it } from "vitest";
import {
  deletionRequestSchema,
  fileUploadMetaSchema,
  inviteSchema,
  loginSchema,
  MAX_FILE_SIZE_BYTES,
  mfaCodeSchema,
  progressSchema,
  projectCreateSchema,
  projectUpdateSchema,
} from "@/lib/validation";

describe("progressSchema", () => {
  it("rejects 101", () => expect(progressSchema.safeParse(101).success).toBe(false));
  it("rejects -1 and decimals", () => {
    expect(progressSchema.safeParse(-1).success).toBe(false);
    expect(progressSchema.safeParse(12.5).success).toBe(false);
  });
  it("accepts 0 and 100", () => {
    expect(progressSchema.safeParse(0).success).toBe(true);
    expect(progressSchema.safeParse(100).success).toBe(true);
  });
});

describe("project schemas", () => {
  it("reject empty titles", () => {
    expect(projectCreateSchema.safeParse({ title: "" }).success).toBe(false);
    expect(projectCreateSchema.safeParse({ title: "   " }).success).toBe(false);
    expect(projectUpdateSchema.safeParse({ title: "" }).success).toBe(false);
  });
  it("defaults description and trims", () => {
    expect(projectCreateSchema.parse({ title: "  Neu  " })).toEqual({ title: "Neu", description: "" });
  });
  it("update requires at least one field", () => {
    expect(projectUpdateSchema.safeParse({}).success).toBe(false);
  });
});

describe("fileUploadMetaSchema", () => {
  const ok = { name: "a.pdf", mimeType: "application/pdf", sizeBytes: 10 };
  it("accepts allowed files", () => expect(fileUploadMetaSchema.safeParse(ok).success).toBe(true));
  it("rejects files over 50 MB", () => expect(fileUploadMetaSchema.safeParse({ ...ok, sizeBytes: MAX_FILE_SIZE_BYTES + 1 }).success).toBe(false));
  it("rejects empty files", () => expect(fileUploadMetaSchema.safeParse({ ...ok, sizeBytes: 0 }).success).toBe(false));
  it("rejects disallowed MIME types", () => expect(fileUploadMetaSchema.safeParse({ ...ok, mimeType: "application/x-msdownload" }).success).toBe(false));
  it("rejects mismatching extensions", () => expect(fileUploadMetaSchema.safeParse({ ...ok, name: "a.exe" }).success).toBe(false));
  it("rejects path separators", () => expect(fileUploadMetaSchema.safeParse({ ...ok, name: "../a.pdf" }).success).toBe(false));
});

describe("other schemas", () => {
  it("invite requires a valid email", () => {
    expect(inviteSchema.safeParse({ email: "kein-mail", fullName: "A" }).success).toBe(false);
    expect(inviteSchema.safeParse({ email: "a@b.test", fullName: "A" }).success).toBe(true);
  });
  it("login requires 8+ char passwords", () => {
    expect(loginSchema.safeParse({ email: "a@b.test", password: "short" }).success).toBe(false);
  });
  it("mfa accepts 6 digits or 8-digit backup codes only", () => {
    expect(mfaCodeSchema.safeParse({ code: "123456" }).success).toBe(true);
    expect(mfaCodeSchema.safeParse({ code: "12345678" }).success).toBe(true);
    expect(mfaCodeSchema.safeParse({ code: "12345" }).success).toBe(false);
    expect(mfaCodeSchema.safeParse({ code: "abcdef" }).success).toBe(false);
  });
  it("deletion requires the exact confirmation word", () => {
    expect(deletionRequestSchema.safeParse({ reason: "Vertrag beendet", confirmation: "löschen" }).success).toBe(false);
    expect(deletionRequestSchema.safeParse({ reason: "Vertrag beendet", confirmation: "LÖSCHEN" }).success).toBe(true);
    expect(deletionRequestSchema.safeParse({ reason: "kurz", confirmation: "LÖSCHEN" }).success).toBe(false);
  });
});
