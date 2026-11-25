import { z } from "zod";

/**
 * Zod schemas shared by forms (client) and, in Phase 2, by Server Actions / Route Handlers.
 * Messages are German because they are shown directly in the UI.
 */

export const MAX_FILE_SIZE_BYTES = 50 * 1024 * 1024; // 50 MB

/** MIME types accepted for upload. Phase 2 additionally verifies file signatures on the server. */
export const ALLOWED_MIME_TYPES = [
  "application/pdf",
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/svg+xml",
  "text/plain",
  "text/csv",
  "application/zip",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
] as const;

export const ALLOWED_EXTENSIONS = [
  "pdf", "png", "jpg", "jpeg", "webp", "svg", "txt", "csv", "zip", "docx", "xlsx", "pptx",
] as const;

export const DELETION_CONFIRMATION_WORD = "LÖSCHEN";
export const DEMO_MFA_CODE_LENGTH = 6;

export const emailSchema = z
  .string()
  .trim()
  .min(1, "Bitte E-Mail-Adresse eingeben.")
  .email("Bitte eine gültige E-Mail-Adresse eingeben.")
  .max(254, "E-Mail-Adresse ist zu lang.");

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(8, "Das Passwort muss mindestens 8 Zeichen lang sein.").max(128),
});
export type LoginInput = z.infer<typeof loginSchema>;

export const mfaCodeSchema = z.object({
  code: z
    .string()
    .trim()
    .regex(/^(\d{6}|\d{8})$/, "Bitte den 6-stelligen Code oder einen 8-stelligen Backup-Code eingeben."),
});
export type MfaCodeInput = z.infer<typeof mfaCodeSchema>;

export const progressSchema = z
  .number({ message: "Bitte eine Zahl eingeben." })
  .int("Nur ganze Zahlen sind erlaubt.")
  .min(0, "Der Fortschritt muss mindestens 0 sein.")
  .max(100, "Der Fortschritt darf höchstens 100 sein.");

export const projectCreateSchema = z.object({
  title: z.string().trim().min(1, "Bitte einen Titel eingeben.").max(120, "Höchstens 120 Zeichen."),
  description: z.string().trim().max(2000, "Höchstens 2000 Zeichen.").default(""),
});
export type ProjectCreateInput = z.input<typeof projectCreateSchema>;

export const projectUpdateSchema = z
  .object({
    title: z.string().trim().min(1, "Bitte einen Titel eingeben.").max(120, "Höchstens 120 Zeichen."),
    description: z.string().trim().max(2000, "Höchstens 2000 Zeichen."),
  })
  .partial()
  .refine((v) => Object.keys(v).length > 0, "Keine Änderungen angegeben.");
export type ProjectUpdateInput = z.infer<typeof projectUpdateSchema>;

function extensionOf(name: string): string {
  const idx = name.lastIndexOf(".");
  return idx === -1 ? "" : name.slice(idx + 1).toLowerCase();
}

export const fileUploadMetaSchema = z
  .object({
    name: z
      .string()
      .trim()
      .min(1, "Dateiname fehlt.")
      .max(200, "Dateiname ist zu lang.")
      .refine((n) => !/[\\/\u0000]/.test(n), "Dateiname enthält ungültige Zeichen."),
    mimeType: z.enum(ALLOWED_MIME_TYPES, { message: "Dieser Dateityp ist nicht erlaubt." }),
    sizeBytes: z
      .number()
      .int()
      .positive("Leere Dateien sind nicht erlaubt.")
      .max(MAX_FILE_SIZE_BYTES, "Die Datei ist größer als 50 MB."),
  })
  .refine(
    (m) => (ALLOWED_EXTENSIONS as readonly string[]).includes(extensionOf(m.name)),
    { message: "Die Dateiendung ist nicht erlaubt.", path: ["name"] },
  );
export type FileUploadMeta = z.infer<typeof fileUploadMetaSchema>;

export const inviteSchema = z.object({
  email: emailSchema,
  fullName: z.string().trim().min(1, "Bitte einen Namen eingeben.").max(120),
});
export type InviteInput = z.infer<typeof inviteSchema>;

export const deletionRequestSchema = z.object({
  reason: z.string().trim().min(5, "Bitte einen Grund angeben (mind. 5 Zeichen).").max(500),
  confirmation: z.literal(DELETION_CONFIRMATION_WORD, {
    message: `Zur Bestätigung bitte „${DELETION_CONFIRMATION_WORD}“ eingeben.`,
  }),
});
export type DeletionRequestInput = z.infer<typeof deletionRequestSchema>;

/** Flattens a ZodError into { fieldPath: firstMessage }. */
export function fieldErrors(error: z.ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = issue.path.length ? issue.path.join(".") : "_form";
    if (!(key in out)) out[key] = issue.message;
  }
  return out;
}
