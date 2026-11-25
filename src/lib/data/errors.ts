/**
 * Typed application errors. Every PortalDataSource method rejects with a PortalError on failure.
 * Phase 2 maps Postgres/Supabase errors onto the same codes so the UI stays unchanged.
 */

export const PORTAL_ERROR_CODES = [
  "UNAUTHENTICATED",
  "SESSION_EXPIRED",
  "MFA_REQUIRED",
  "MFA_INVALID",
  "INVALID_CREDENTIALS",
  "FORBIDDEN",
  "NOT_FOUND",
  "VALIDATION",
  "CONFLICT",
  "INVALID_STATE",
  "SCAN_NOT_CLEAN",
  "FILE_REJECTED",
  "UNKNOWN",
] as const;

export type PortalErrorCode = (typeof PORTAL_ERROR_CODES)[number];

export interface PortalErrorDetails {
  /** Field-level validation messages, keyed by field path. */
  fields?: Record<string, string>;
  [key: string]: unknown;
}

export class PortalError extends Error {
  readonly code: PortalErrorCode;
  readonly details: PortalErrorDetails | undefined;

  constructor(code: PortalErrorCode, message?: string, details?: PortalErrorDetails) {
    super(message ?? code);
    this.name = "PortalError";
    this.code = code;
    this.details = details;
  }
}

export function isPortalError(value: unknown): value is PortalError {
  return value instanceof PortalError;
}

/** Normalises any thrown value into a PortalError so callers can switch on `code`. */
export function toPortalError(value: unknown): PortalError {
  if (isPortalError(value)) return value;
  if (value instanceof Error) return new PortalError("UNKNOWN", value.message);
  return new PortalError("UNKNOWN", String(value));
}
