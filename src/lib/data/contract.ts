import type {
  ClientSummary,
  DeletionRequest,
  DownloadLink,
  Member,
  MfaEnrollment,
  Project,
  ProjectFile,
  ProjectFileVersion,
  RetentionPolicy,
  SessionStatus,
  SignInResult,
  UploadTicket,
  User,
} from "./types";
import type {
  DeletionRequestInput,
  FileUploadMeta,
  InviteInput,
  LoginInput,
  ProjectCreateInput,
  ProjectUpdateInput,
} from "../validation";

/**
 * The only data access surface the UI may use.
 *
 * Rules for every implementation:
 * - Every method returns a Promise and rejects with a `PortalError` (see ./errors) on failure.
 * - The current user is resolved by the implementation (Phase 2: Supabase session/JWT), never passed in.
 * - Authorization is enforced inside the implementation (Phase 2: RLS + server-side checks), not by the UI.
 * - Inputs are validated with the Zod schemas in ../validation inside the implementation as well.
 * - Protected methods reject with SESSION_EXPIRED after the idle timeout and refresh activity otherwise.
 *
 * Full method documentation: docs/CONTRACT.md
 */
export interface PortalDataSource {
  // ---- Auth & session ------------------------------------------------------
  signIn(input: LoginInput): Promise<SignInResult>;
  /** Completes the second factor for an aal1 session. Required for admins. */
  verifyMfa(code: string): Promise<User>;
  /** Starts (or restarts) TOTP enrollment for the current user. */
  enrollMfa(): Promise<MfaEnrollment>;
  /** Confirms a pending enrollment with a code from the authenticator app. */
  confirmMfaEnrollment(factorId: string, code: string): Promise<User>;
  /** Returns the signed-in user or null. Does not throw on expiry; returns null instead. */
  getCurrentUser(): Promise<User | null>;
  /** Session details incl. assurance level and expiry. Rejects with UNAUTHENTICATED / SESSION_EXPIRED. */
  getSessionStatus(): Promise<SessionStatus>;
  /** Records user activity (heartbeat). Rejects with SESSION_EXPIRED if the idle timeout passed. */
  touchSession(): Promise<SessionStatus>;
  signOut(): Promise<void>;

  // ---- Projects --------------------------------------------------------------
  /** Admin: all projects (archived only with includeArchived). Client: own non-archived projects. */
  listProjectsForUser(options?: { includeArchived?: boolean }): Promise<Project[]>;
  getProject(projectId: string): Promise<Project>;
  createProject(input: ProjectCreateInput): Promise<Project>;
  updateProject(projectId: string, input: ProjectUpdateInput): Promise<Project>;
  setProgress(projectId: string, progress: number): Promise<Project>;
  archiveProject(projectId: string): Promise<Project>;
  unarchiveProject(projectId: string): Promise<Project>;

  // ---- Files & versions ------------------------------------------------------
  /** Current versions only. Clients never receive infected files. */
  listFiles(projectId: string): Promise<ProjectFile[]>;
  /** All versions of one file group, newest first. */
  listFileVersions(groupId: string): Promise<ProjectFileVersion[]>;
  /** Validates metadata and issues an upload ticket. Pass groupId to upload a new version. Admin only. */
  requestUploadUrl(projectId: string, meta: FileUploadMeta, groupId?: string): Promise<UploadTicket>;
  /** Records the uploaded version (status pending, scan pending) after the binary upload finished. */
  confirmUpload(uploadId: string): Promise<ProjectFile>;
  /** pending → approved. Only when scanStatus is clean. Clients only for their projects. */
  approveFile(fileId: string): Promise<ProjectFile>;
  /** approved → pending. Admin only. */
  revertFile(fileId: string): Promise<ProjectFile>;
  /** Removes a whole file group (all versions). Admin only. */
  deleteFile(groupId: string): Promise<void>;
  /** Short-lived download link. Only when scanStatus is clean. */
  getDownloadUrl(fileId: string): Promise<DownloadLink>;

  // ---- Members & clients -----------------------------------------------------
  listMembers(projectId: string): Promise<Member[]>;
  inviteMember(projectId: string, input: InviteInput): Promise<Member>;
  /** Admin only. */
  listClients(): Promise<ClientSummary[]>;

  // ---- Retention & deletion --------------------------------------------------
  getRetentionPolicy(): Promise<RetentionPolicy>;
  requestClientDeletion(clientId: string, input: DeletionRequestInput): Promise<DeletionRequest>;
  requestProjectDeletion(projectId: string, input: DeletionRequestInput): Promise<DeletionRequest>;
  listDeletionRequests(): Promise<DeletionRequest[]>;
  cancelDeletionRequest(requestId: string): Promise<DeletionRequest>;
}
