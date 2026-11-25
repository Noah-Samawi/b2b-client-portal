/**
 * Domain types shared by the UI and every PortalDataSource implementation.
 * All dates are ISO-8601 strings (UTC). Ids are opaque strings (UUIDs in Phase 2).
 */

export type Role = "admin" | "client";

/** Approval state of a file version. Independent from the malware scan. */
export type FileStatus = "pending" | "approved";

/** Malware scan state of a file version. Independent from approval. */
export type ScanStatus = "pending" | "scanning" | "clean" | "infected" | "failed";

/** Authenticator assurance level, modelled after Supabase Auth (aal1 = password, aal2 = + second factor). */
export type AssuranceLevel = "aal1" | "aal2";

export interface User {
  id: string;
  email: string;
  fullName: string;
  role: Role;
  /** Company name for clients, null for admins. */
  company: string | null;
  mfaEnrolled: boolean;
  createdAt: string;
}

export interface Project {
  id: string;
  title: string;
  description: string;
  /** Integer 0–100. */
  progress: number;
  archived: boolean;
  archivedAt: string | null;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  /** Number of current (non-superseded) files. */
  fileCount: number;
  memberCount: number;
}

/**
 * One immutable version of a file. Versions sharing a `groupId` form the history of one logical file.
 * Exactly one version per group has `isCurrent = true`. Previous versions are never deleted by uploads.
 */
export interface ProjectFileVersion {
  id: string;
  groupId: string;
  projectId: string;
  version: number;
  isCurrent: boolean;
  name: string;
  mimeType: string;
  sizeBytes: number;
  status: FileStatus;
  scanStatus: ScanStatus;
  uploadedBy: string;
  createdAt: string;
  approvedAt: string | null;
  approvedBy: string | null;
}

/** The current version of a logical file, as shown in file lists. */
export interface ProjectFile extends ProjectFileVersion {
  versionCount: number;
}

export interface Member {
  userId: string;
  projectId: string;
  email: string;
  fullName: string;
  role: Role;
  /** "invited" until the person signs in for the first time (Phase 2: invite accepted). */
  state: "active" | "invited";
  addedAt: string;
}

export interface ClientSummary {
  id: string;
  email: string;
  fullName: string;
  company: string | null;
  projectCount: number;
  pendingDeletion: boolean;
}

export type DeletionTargetType = "client" | "project";
export type DeletionRequestStatus = "requested" | "cancelled" | "processing" | "completed";

export interface DeletionRequest {
  id: string;
  targetType: DeletionTargetType;
  targetId: string;
  targetLabel: string;
  requestedBy: string;
  reason: string;
  status: DeletionRequestStatus;
  createdAt: string;
  /** Earliest point at which data may be removed: createdAt + retention period. */
  scheduledFor: string;
  updatedAt: string;
}

export interface RetentionPolicy {
  /** Single configurable retention period applied to deletion requests and document retention. */
  retentionDays: number;
}

export interface UploadTicket {
  uploadId: string;
  /** Phase 1: a fake URL. Phase 2: a signed Storage upload URL. */
  url: string;
  expiresAt: string;
  projectId: string;
  /** Present when the upload creates a new version of an existing file group. */
  groupId: string | null;
}

export interface DownloadLink {
  url: string;
  expiresAt: string;
  fileName: string;
}

export interface MfaEnrollment {
  factorId: string;
  /** Base32 secret (Phase 1: fake). */
  secret: string;
  otpauthUri: string;
  backupCodes: string[];
}

export type SignInResult =
  | { status: "authenticated"; user: User }
  | { status: "mfa_required"; user: User };

export interface SessionStatus {
  user: User;
  aal: AssuranceLevel;
  lastActivityAt: string;
  /** lastActivityAt + idle timeout. */
  expiresAt: string;
}
