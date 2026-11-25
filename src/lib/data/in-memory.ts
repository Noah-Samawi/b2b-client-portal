/**
 * PHASE 1 ONLY, replaced in Phase 2 (src/lib/data/supabase.ts).
 *
 * In-memory implementation of PortalDataSource. It contains NO data (see ./fixtures.ts) and
 * deliberately enforces the same authorization rules Phase 2 enforces with PostgreSQL RLS and
 * server-side checks, so UI behaviour does not change when the implementation is swapped.
 *
 * Everything security-related here (passwords, MFA, scan, session expiry) is a SIMULATION.
 * It runs in the browser and can be bypassed by anyone with dev tools. It is not production security.
 */
import type { PortalDataSource } from "./contract";
import { PortalError } from "./errors";
import type {
  AssuranceLevel,
  ClientSummary,
  DeletionRequest,
  DeletionTargetType,
  DownloadLink,
  Member,
  MfaEnrollment,
  Project,
  ProjectFile,
  ProjectFileVersion,
  RetentionPolicy,
  ScanStatus,
  SessionStatus,
  SignInResult,
  UploadTicket,
  User,
} from "./types";
import {
  deletionRequestSchema,
  fieldErrors,
  fileUploadMetaSchema,
  inviteSchema,
  loginSchema,
  mfaCodeSchema,
  progressSchema,
  projectCreateSchema,
  projectUpdateSchema,
  type DeletionRequestInput,
  type FileUploadMeta,
  type InviteInput,
  type LoginInput,
  type ProjectCreateInput,
  type ProjectUpdateInput,
} from "../validation";
import { IDLE_TIMEOUT_MS } from "../session/config";
import type { z } from "zod";

// ---------------------------------------------------------------------------
// State shape (serialisable, so it can be mirrored to sessionStorage)
// ---------------------------------------------------------------------------

export interface StoredUser extends User {
  /** Plain text demo password. PHASE 1 ONLY. Phase 2 uses Supabase Auth. */
  password: string;
  activated: boolean;
}

export interface StoredProject {
  id: string;
  title: string;
  description: string;
  progress: number;
  archived: boolean;
  archivedAt: string | null;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface StoredMember {
  projectId: string;
  userId: string;
  addedAt: string;
}

export interface StoredVersion extends ProjectFileVersion {
  scanStartedAt: string;
}

export interface StoredUpload {
  uploadId: string;
  projectId: string;
  groupId: string | null;
  meta: FileUploadMeta;
  createdBy: string;
  expiresAt: string;
}

export interface StoredEnrollment {
  factorId: string;
  userId: string;
  backupCodes: string[];
  confirmed: boolean;
}

export interface AuditEntry {
  id: string;
  actorId: string | null;
  action: string;
  entity: string;
  entityId: string;
  createdAt: string;
}

export interface StoredSession {
  userId: string;
  aal: AssuranceLevel;
  lastActivityAt: string;
}

export interface MemoryState {
  retentionDays: number;
  users: StoredUser[];
  projects: StoredProject[];
  members: StoredMember[];
  versions: StoredVersion[];
  uploads: StoredUpload[];
  deletionRequests: DeletionRequest[];
  mfaEnrollments: StoredEnrollment[];
  audit: AuditEntry[];
  session: StoredSession | null;
}

export interface StateStorage {
  load(): MemoryState | null;
  save(state: MemoryState): void;
  clear(): void;
}

export interface InMemoryOptions {
  /** Injectable clock (ms since epoch) for deterministic tests. */
  now?: () => number;
  /** Simulated scan duration in ms. */
  scanDurationMs?: number;
  idleTimeoutMs?: number;
  uploadTicketTtlMs?: number;
  downloadLinkTtlMs?: number;
  /** Accepted simulated TOTP code. */
  mfaCode: string;
  storage?: StateStorage;
  /** Artificial latency to make loading states visible (0 in tests). */
  latencyMs?: number;
  idFactory?: () => string;
}

/** File names that the simulated scanner flags as infected (incl. the EICAR test name). */
const INFECTED_NAME_PATTERN = /(eicar|infected|virus|malware)/i;

function stripPrivate(u: StoredUser): User {
  return {
    id: u.id,
    email: u.email,
    fullName: u.fullName,
    role: u.role,
    company: u.company,
    mfaEnrolled: u.mfaEnrolled,
    createdAt: u.createdAt,
  };
}

function parseOrThrow<T extends z.ZodType>(schema: T, value: unknown): z.infer<T> {
  const result = schema.safeParse(value);
  if (!result.success) {
    throw new PortalError("VALIDATION", "Eingaben sind ungültig.", { fields: fieldErrors(result.error) });
  }
  return result.data;
}

const clone = <T>(v: T): T => structuredClone(v);

// ---------------------------------------------------------------------------
// Implementation
// ---------------------------------------------------------------------------

export class InMemoryPortalDataSource implements PortalDataSource {
  private state: MemoryState;
  private readonly now: () => number;
  private readonly scanDurationMs: number;
  private readonly idleTimeoutMs: number;
  private readonly uploadTicketTtlMs: number;
  private readonly downloadLinkTtlMs: number;
  private readonly mfaCode: string;
  private readonly storage: StateStorage | undefined;
  private readonly latencyMs: number;
  private readonly newId: () => string;

  constructor(initialState: MemoryState, options: InMemoryOptions) {
    this.storage = options.storage;
    this.state = this.storage?.load() ?? clone(initialState);
    this.now = options.now ?? (() => Date.now());
    this.scanDurationMs = options.scanDurationMs ?? 2500;
    this.idleTimeoutMs = options.idleTimeoutMs ?? IDLE_TIMEOUT_MS;
    this.uploadTicketTtlMs = options.uploadTicketTtlMs ?? 10 * 60 * 1000;
    this.downloadLinkTtlMs = options.downloadLinkTtlMs ?? 60 * 1000;
    this.mfaCode = options.mfaCode;
    this.latencyMs = options.latencyMs ?? 0;
    this.newId = options.idFactory ?? (() => crypto.randomUUID());
  }

  // ---- infrastructure -------------------------------------------------------

  private iso(ms = this.now()): string {
    return new Date(ms).toISOString();
  }

  private persist(): void {
    this.storage?.save(this.state);
  }

  /** Wraps every public method: latency, scan settlement, persistence, defensive copies. */
  private async run<T>(fn: () => T): Promise<T> {
    if (this.latencyMs > 0) await new Promise((r) => setTimeout(r, this.latencyMs));
    this.settleScans();
    try {
      const result = fn();
      return clone(result);
    } finally {
      this.persist();
    }
  }

  private audit(action: string, entity: string, entityId: string): void {
    this.state.audit.push({
      id: this.newId(),
      actorId: this.state.session?.userId ?? null,
      action,
      entity,
      entityId,
      createdAt: this.iso(),
    });
  }

  /** Simulated asynchronous malware scan: pending → scanning → clean | infected. */
  private settleScans(): void {
    const now = this.now();
    for (const v of this.state.versions) {
      if (v.scanStatus !== "pending" && v.scanStatus !== "scanning") continue;
      const elapsed = now - Date.parse(v.scanStartedAt);
      let next: ScanStatus = v.scanStatus;
      if (elapsed >= this.scanDurationMs) {
        next = INFECTED_NAME_PATTERN.test(v.name) ? "infected" : "clean";
      } else if (elapsed >= Math.min(300, this.scanDurationMs / 4)) {
        next = "scanning";
      }
      if (next !== v.scanStatus) {
        v.scanStatus = next;
        if (next === "clean" || next === "infected") this.audit(`file.scan.${next}`, "file", v.id);
      }
    }
  }

  // ---- session & authorization ---------------------------------------------

  private sessionUser(): { user: StoredUser; session: StoredSession } {
    const session = this.state.session;
    if (!session) throw new PortalError("UNAUTHENTICATED", "Nicht angemeldet.");
    if (this.now() - Date.parse(session.lastActivityAt) > this.idleTimeoutMs) {
      this.state.session = null;
      this.audit("session.expired", "user", session.userId);
      throw new PortalError("SESSION_EXPIRED", "Die Sitzung ist abgelaufen.");
    }
    const user = this.state.users.find((u) => u.id === session.userId);
    if (!user) {
      this.state.session = null;
      throw new PortalError("UNAUTHENTICATED", "Nicht angemeldet.");
    }
    return { user, session };
  }

  /**
   * Resolves the current user for a protected operation.
   * - Admins always need aal2 (simulated second factor).
   * - Clients with an enrolled factor need aal2 as well.
   * - `activity` marks user-initiated operations; they refresh the idle timer. Reads do not,
   *   so background polling can never keep a session alive.
   */
  private requireUser(opts: { activity?: boolean; allowAal1?: boolean } = {}): StoredUser {
    const { user, session } = this.sessionUser();
    const needsAal2 = user.role === "admin" || user.mfaEnrolled;
    if (needsAal2 && session.aal !== "aal2" && !opts.allowAal1) {
      throw new PortalError("MFA_REQUIRED", "Zweiter Faktor erforderlich.");
    }
    if (opts.activity) session.lastActivityAt = this.iso();
    return user;
  }

  private requireAdmin(opts: { activity?: boolean } = {}): StoredUser {
    const user = this.requireUser(opts);
    if (user.role !== "admin") throw new PortalError("FORBIDDEN", "Keine Berechtigung.");
    return user;
  }

  private isMember(projectId: string, userId: string): boolean {
    return this.state.members.some((m) => m.projectId === projectId && m.userId === userId);
  }

  /** Returns the project if the user may see it. Clients get NOT_FOUND (not FORBIDDEN) to avoid leaking existence. */
  private visibleProject(user: StoredUser, projectId: string): StoredProject {
    const project = this.state.projects.find((p) => p.id === projectId);
    if (!project) throw new PortalError("NOT_FOUND", "Projekt nicht gefunden.");
    if (user.role === "admin") return project;
    if (project.archived || !this.isMember(projectId, user.id)) {
      throw new PortalError("NOT_FOUND", "Projekt nicht gefunden.");
    }
    return project;
  }

  private mutableProject(projectId: string): StoredProject {
    const project = this.state.projects.find((p) => p.id === projectId);
    if (!project) throw new PortalError("NOT_FOUND", "Projekt nicht gefunden.");
    if (project.archived) throw new PortalError("INVALID_STATE", "Archivierte Projekte sind schreibgeschützt.");
    return project;
  }

  private visibleVersion(user: StoredUser, fileId: string): StoredVersion {
    const v = this.state.versions.find((x) => x.id === fileId);
    if (!v) throw new PortalError("NOT_FOUND", "Datei nicht gefunden.");
    this.visibleProject(user, v.projectId);
    if (user.role === "client" && v.scanStatus === "infected") {
      throw new PortalError("NOT_FOUND", "Datei nicht gefunden.");
    }
    return v;
  }

  private toProject(p: StoredProject, viewer: StoredUser): Project {
    return {
      ...p,
      fileCount: this.state.versions.filter(
        (v) => v.projectId === p.id && v.isCurrent && (viewer.role === "admin" || v.scanStatus !== "infected"),
      ).length,
      memberCount: this.state.members.filter((m) => m.projectId === p.id).length,
    };
  }

  private toFile(v: StoredVersion): ProjectFile {
    const { scanStartedAt: _ignored, ...rest } = v;
    void _ignored;
    return {
      ...rest,
      versionCount: this.state.versions.filter((x) => x.groupId === v.groupId).length,
    };
  }

  private toVersion(v: StoredVersion): ProjectFileVersion {
    const { scanStartedAt: _ignored, ...rest } = v;
    void _ignored;
    return rest;
  }

  private sessionStatus(user: StoredUser, session: StoredSession): SessionStatus {
    return {
      user: stripPrivate(user),
      aal: session.aal,
      lastActivityAt: session.lastActivityAt,
      expiresAt: this.iso(Date.parse(session.lastActivityAt) + this.idleTimeoutMs),
    };
  }

  // ---- Auth & session -------------------------------------------------------

  signIn(input: LoginInput): Promise<SignInResult> {
    return this.run(() => {
      const { email, password } = parseOrThrow(loginSchema, input);
      const user = this.state.users.find((u) => u.email.toLowerCase() === email.toLowerCase());
      if (!user || user.password !== password) {
        throw new PortalError("INVALID_CREDENTIALS", "E-Mail oder Passwort ist falsch.");
      }
      if (this.hasOpenDeletion("client", user.id)) {
        throw new PortalError("FORBIDDEN", "Dieses Konto ist zur Löschung vorgemerkt.");
      }
      user.activated = true;
      this.state.session = { userId: user.id, aal: "aal1", lastActivityAt: this.iso() };
      this.audit("auth.sign_in", "user", user.id);
      const needsMfa = user.role === "admin" || user.mfaEnrolled;
      return { status: needsMfa ? "mfa_required" : "authenticated", user: stripPrivate(user) } as SignInResult;
    });
  }

  verifyMfa(code: string): Promise<User> {
    return this.run(() => {
      const { user, session } = this.sessionUser();
      const { code: parsed } = parseOrThrow(mfaCodeSchema, { code });
      const enrollment = this.state.mfaEnrollments.find((e) => e.userId === user.id && e.confirmed);
      const backupIdx = enrollment?.backupCodes.indexOf(parsed) ?? -1;
      if (parsed !== this.mfaCode && backupIdx === -1) {
        this.audit("auth.mfa.failed", "user", user.id);
        throw new PortalError("MFA_INVALID", "Der Code ist ungültig.");
      }
      if (enrollment && backupIdx >= 0) enrollment.backupCodes.splice(backupIdx, 1); // one-time use
      session.aal = "aal2";
      session.lastActivityAt = this.iso();
      this.audit("auth.mfa.verified", "user", user.id);
      return stripPrivate(user);
    });
  }

  enrollMfa(): Promise<MfaEnrollment> {
    return this.run(() => {
      const user = this.requireUser({ activity: true });
      // Remove unconfirmed enrollments; a confirmed factor stays valid until the new one is confirmed.
      this.state.mfaEnrollments = this.state.mfaEnrollments.filter((e) => e.userId !== user.id || e.confirmed);
      const factorId = this.newId();
      const secret = Array.from({ length: 32 }, (_, i) => "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567"[(i * 7 + factorId.charCodeAt(i % factorId.length)) % 32]).join("");
      const backupCodes = Array.from({ length: 8 }, (_, i) =>
        String((factorId.charCodeAt(i) * 7919 + i * 104729) % 100000000).padStart(8, "0"),
      );
      this.state.mfaEnrollments.push({ factorId, userId: user.id, backupCodes, confirmed: false });
      this.audit("auth.mfa.enroll_started", "user", user.id);
      return {
        factorId,
        secret,
        otpauthUri: `otpauth://totp/Kundenportal:${encodeURIComponent(user.email)}?secret=${secret}&issuer=Kundenportal`,
        backupCodes,
      };
    });
  }

  confirmMfaEnrollment(factorId: string, code: string): Promise<User> {
    return this.run(() => {
      const user = this.requireUser({ activity: true });
      const { code: parsed } = parseOrThrow(mfaCodeSchema, { code });
      const enrollment = this.state.mfaEnrollments.find((e) => e.factorId === factorId && e.userId === user.id);
      if (!enrollment || enrollment.confirmed) throw new PortalError("NOT_FOUND", "Einrichtung nicht gefunden.");
      if (parsed !== this.mfaCode) throw new PortalError("MFA_INVALID", "Der Code ist ungültig.");
      this.state.mfaEnrollments = this.state.mfaEnrollments.filter((e) => e.userId !== user.id || e === enrollment);
      enrollment.confirmed = true;
      user.mfaEnrolled = true;
      if (this.state.session) this.state.session.aal = "aal2";
      this.audit("auth.mfa.enrolled", "user", user.id);
      return stripPrivate(user);
    });
  }

  getCurrentUser(): Promise<User | null> {
    return this.run(() => {
      try {
        return stripPrivate(this.sessionUser().user);
      } catch {
        return null;
      }
    });
  }

  getSessionStatus(): Promise<SessionStatus> {
    return this.run(() => {
      const { user, session } = this.sessionUser();
      return this.sessionStatus(user, session);
    });
  }

  touchSession(): Promise<SessionStatus> {
    return this.run(() => {
      const { user, session } = this.sessionUser();
      session.lastActivityAt = this.iso();
      return this.sessionStatus(user, session);
    });
  }

  signOut(): Promise<void> {
    return this.run(() => {
      if (this.state.session) this.audit("auth.sign_out", "user", this.state.session.userId);
      this.state.session = null;
    });
  }

  // ---- Projects ---------------------------------------------------------------

  listProjectsForUser(options?: { includeArchived?: boolean }): Promise<Project[]> {
    return this.run(() => {
      const user = this.requireUser();
      const projects =
        user.role === "admin"
          ? this.state.projects.filter((p) => options?.includeArchived || !p.archived)
          : this.state.projects.filter((p) => !p.archived && this.isMember(p.id, user.id));
      return projects
        .slice()
        .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
        .map((p) => this.toProject(p, user));
    });
  }

  getProject(projectId: string): Promise<Project> {
    return this.run(() => {
      const user = this.requireUser();
      return this.toProject(this.visibleProject(user, projectId), user);
    });
  }

  createProject(input: ProjectCreateInput): Promise<Project> {
    return this.run(() => {
      const admin = this.requireAdmin({ activity: true });
      const data = parseOrThrow(projectCreateSchema, input);
      const ts = this.iso();
      const project: StoredProject = {
        id: this.newId(),
        title: data.title,
        description: data.description,
        progress: 0,
        archived: false,
        archivedAt: null,
        createdBy: admin.id,
        createdAt: ts,
        updatedAt: ts,
      };
      this.state.projects.push(project);
      this.audit("project.create", "project", project.id);
      return this.toProject(project, admin);
    });
  }

  updateProject(projectId: string, input: ProjectUpdateInput): Promise<Project> {
    return this.run(() => {
      const admin = this.requireAdmin({ activity: true });
      const data = parseOrThrow(projectUpdateSchema, input);
      const project = this.mutableProject(projectId);
      if (data.title !== undefined) project.title = data.title;
      if (data.description !== undefined) project.description = data.description;
      project.updatedAt = this.iso();
      this.audit("project.update", "project", project.id);
      return this.toProject(project, admin);
    });
  }

  setProgress(projectId: string, progress: number): Promise<Project> {
    return this.run(() => {
      const admin = this.requireAdmin({ activity: true });
      const value = parseOrThrow(progressSchema, progress);
      const project = this.mutableProject(projectId);
      project.progress = value;
      project.updatedAt = this.iso();
      this.audit("project.progress", "project", project.id);
      return this.toProject(project, admin);
    });
  }

  archiveProject(projectId: string): Promise<Project> {
    return this.run(() => {
      const admin = this.requireAdmin({ activity: true });
      const project = this.mutableProject(projectId);
      project.archived = true;
      project.archivedAt = this.iso();
      project.updatedAt = project.archivedAt;
      this.audit("project.archive", "project", project.id);
      return this.toProject(project, admin);
    });
  }

  unarchiveProject(projectId: string): Promise<Project> {
    return this.run(() => {
      const admin = this.requireAdmin({ activity: true });
      const project = this.state.projects.find((p) => p.id === projectId);
      if (!project) throw new PortalError("NOT_FOUND", "Projekt nicht gefunden.");
      if (!project.archived) throw new PortalError("INVALID_STATE", "Projekt ist nicht archiviert.");
      if (this.hasOpenDeletion("project", project.id)) {
        throw new PortalError("INVALID_STATE", "Für dieses Projekt läuft ein Löschantrag.");
      }
      project.archived = false;
      project.archivedAt = null;
      project.updatedAt = this.iso();
      this.audit("project.unarchive", "project", project.id);
      return this.toProject(project, admin);
    });
  }

  // ---- Files & versions -------------------------------------------------------

  listFiles(projectId: string): Promise<ProjectFile[]> {
    return this.run(() => {
      const user = this.requireUser();
      this.visibleProject(user, projectId);
      return this.state.versions
        .filter((v) => v.projectId === projectId && v.isCurrent)
        .filter((v) => user.role === "admin" || v.scanStatus !== "infected")
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
        .map((v) => this.toFile(v));
    });
  }

  listFileVersions(groupId: string): Promise<ProjectFileVersion[]> {
    return this.run(() => {
      const user = this.requireUser();
      const versions = this.state.versions.filter((v) => v.groupId === groupId);
      if (versions.length === 0) throw new PortalError("NOT_FOUND", "Datei nicht gefunden.");
      this.visibleProject(user, versions[0]!.projectId);
      return versions
        .filter((v) => user.role === "admin" || v.scanStatus !== "infected")
        .sort((a, b) => b.version - a.version)
        .map((v) => this.toVersion(v));
    });
  }

  requestUploadUrl(projectId: string, meta: FileUploadMeta, groupId?: string): Promise<UploadTicket> {
    return this.run(() => {
      const admin = this.requireAdmin({ activity: true });
      const parsed = parseOrThrow(fileUploadMetaSchema, meta);
      this.mutableProject(projectId);
      if (groupId) {
        const group = this.state.versions.find((v) => v.groupId === groupId);
        if (!group || group.projectId !== projectId) throw new PortalError("NOT_FOUND", "Datei nicht gefunden.");
      }
      const ticket: StoredUpload = {
        uploadId: this.newId(),
        projectId,
        groupId: groupId ?? null,
        meta: parsed,
        createdBy: admin.id,
        expiresAt: this.iso(this.now() + this.uploadTicketTtlMs),
      };
      this.state.uploads.push(ticket);
      return {
        uploadId: ticket.uploadId,
        url: `memory://uploads/${ticket.uploadId}`,
        expiresAt: ticket.expiresAt,
        projectId,
        groupId: ticket.groupId,
      };
    });
  }

  confirmUpload(uploadId: string): Promise<ProjectFile> {
    return this.run(() => {
      const admin = this.requireAdmin({ activity: true });
      const idx = this.state.uploads.findIndex((u) => u.uploadId === uploadId);
      const ticket = this.state.uploads[idx];
      if (!ticket) throw new PortalError("NOT_FOUND", "Upload nicht gefunden.");
      this.state.uploads.splice(idx, 1); // tickets are single-use
      if (Date.parse(ticket.expiresAt) < this.now()) {
        throw new PortalError("INVALID_STATE", "Der Upload-Link ist abgelaufen.");
      }
      this.mutableProject(ticket.projectId);

      // Version creation. Phase 2: one transaction/RPC with a lock on the group and a partial
      // unique index (group_id) WHERE is_current. JS is single-threaded, so this block is atomic.
      const groupId = ticket.groupId ?? this.newId();
      const group = this.state.versions.filter((v) => v.groupId === groupId);
      const nextVersion = group.reduce((max, v) => Math.max(max, v.version), 0) + 1;
      for (const v of group) v.isCurrent = false; // previous versions are kept, never deleted
      const ts = this.iso();
      const version: StoredVersion = {
        id: this.newId(),
        groupId,
        projectId: ticket.projectId,
        version: nextVersion,
        isCurrent: true,
        name: ticket.meta.name,
        mimeType: ticket.meta.mimeType,
        sizeBytes: ticket.meta.sizeBytes,
        status: "pending", // a new version always needs a fresh approval
        scanStatus: "pending",
        uploadedBy: admin.id,
        createdAt: ts,
        approvedAt: null,
        approvedBy: null,
        scanStartedAt: ts,
      };
      this.state.versions.push(version);
      const project = this.state.projects.find((p) => p.id === ticket.projectId);
      if (project) project.updatedAt = ts;
      this.audit(nextVersion === 1 ? "file.upload" : "file.new_version", "file", version.id);
      return this.toFile(version);
    });
  }

  approveFile(fileId: string): Promise<ProjectFile> {
    return this.run(() => {
      const user = this.requireUser({ activity: true });
      const v = this.visibleVersion(user, fileId);
      this.mutableProject(v.projectId);
      if (!v.isCurrent) throw new PortalError("INVALID_STATE", "Nur die aktuelle Version kann freigegeben werden.");
      if (v.scanStatus !== "clean") throw new PortalError("SCAN_NOT_CLEAN", "Die Datei wurde noch nicht als sicher geprüft.");
      if (v.status !== "pending") throw new PortalError("INVALID_STATE", "Die Datei ist bereits freigegeben.");
      v.status = "approved";
      v.approvedAt = this.iso();
      v.approvedBy = user.id;
      this.audit("file.approve", "file", v.id);
      return this.toFile(v);
    });
  }

  revertFile(fileId: string): Promise<ProjectFile> {
    return this.run(() => {
      const user = this.requireUser({ activity: true });
      if (user.role !== "admin") {
        throw new PortalError("FORBIDDEN", "Nur Administratoren können Freigaben zurücknehmen.");
      }
      const v = this.visibleVersion(user, fileId);
      this.mutableProject(v.projectId);
      if (v.status !== "approved") throw new PortalError("INVALID_STATE", "Die Datei ist nicht freigegeben.");
      v.status = "pending";
      v.approvedAt = null;
      v.approvedBy = null;
      this.audit("file.revert", "file", v.id);
      return this.toFile(v);
    });
  }

  deleteFile(groupId: string): Promise<void> {
    return this.run(() => {
      this.requireAdmin({ activity: true });
      const group = this.state.versions.filter((v) => v.groupId === groupId);
      if (group.length === 0) throw new PortalError("NOT_FOUND", "Datei nicht gefunden.");
      this.mutableProject(group[0]!.projectId);
      this.state.versions = this.state.versions.filter((v) => v.groupId !== groupId);
      this.audit("file.delete", "file_group", groupId);
    });
  }

  getDownloadUrl(fileId: string): Promise<DownloadLink> {
    return this.run(() => {
      const user = this.requireUser({ activity: true });
      const v = this.visibleVersion(user, fileId);
      if (v.scanStatus !== "clean") throw new PortalError("SCAN_NOT_CLEAN", "Die Datei wurde noch nicht als sicher geprüft.");
      this.audit("file.download", "file", v.id);
      const body = `Platzhalter-Inhalt (Phase 1)\nDatei: ${v.name}\nVersion: ${v.version}\n`;
      return {
        url: `data:text/plain;charset=utf-8,${encodeURIComponent(body)}`,
        expiresAt: this.iso(this.now() + this.downloadLinkTtlMs),
        fileName: v.name,
      };
    });
  }

  // ---- Members & clients -----------------------------------------------------

  listMembers(projectId: string): Promise<Member[]> {
    return this.run(() => {
      const user = this.requireUser();
      this.visibleProject(user, projectId);
      return this.state.members
        .filter((m) => m.projectId === projectId)
        .map((m) => {
          const u = this.state.users.find((x) => x.id === m.userId)!;
          return {
            userId: u.id,
            projectId,
            email: u.email,
            fullName: u.fullName,
            role: u.role,
            state: u.activated ? "active" : "invited",
            addedAt: m.addedAt,
          } satisfies Member;
        });
    });
  }

  inviteMember(projectId: string, input: InviteInput): Promise<Member> {
    return this.run(() => {
      this.requireAdmin({ activity: true });
      const data = parseOrThrow(inviteSchema, input);
      this.mutableProject(projectId);
      let user = this.state.users.find((u) => u.email.toLowerCase() === data.email.toLowerCase());
      if (user && user.role !== "client") {
        throw new PortalError("VALIDATION", "Nur Kunden können eingeladen werden.", {
          fields: { email: "Diese Adresse gehört zu einem Administrator." },
        });
      }
      if (user && this.hasOpenDeletion("client", user.id)) {
        throw new PortalError("INVALID_STATE", "Dieser Kunde ist zur Löschung vorgemerkt.");
      }
      if (user && this.isMember(projectId, user.id)) {
        throw new PortalError("CONFLICT", "Diese Person ist bereits Mitglied.", {
          fields: { email: "Diese Person ist bereits Mitglied." },
        });
      }
      if (!user) {
        user = {
          id: this.newId(),
          email: data.email,
          fullName: data.fullName,
          role: "client", // invited users are always clients; roles are never taken from input
          company: null,
          mfaEnrolled: false,
          createdAt: this.iso(),
          password: "", // cannot sign in until Phase 2 invite flow sets a password
          activated: false,
        };
        this.state.users.push(user);
      }
      const member: StoredMember = { projectId, userId: user.id, addedAt: this.iso() };
      this.state.members.push(member);
      this.audit("member.invite", "project", projectId);
      return {
        userId: user.id,
        projectId,
        email: user.email,
        fullName: user.fullName,
        role: user.role,
        state: user.activated ? "active" : "invited",
        addedAt: member.addedAt,
      };
    });
  }

  listClients(): Promise<ClientSummary[]> {
    return this.run(() => {
      this.requireAdmin();
      return this.state.users
        .filter((u) => u.role === "client")
        .map((u) => ({
          id: u.id,
          email: u.email,
          fullName: u.fullName,
          company: u.company,
          projectCount: this.state.members.filter((m) => m.userId === u.id).length,
          pendingDeletion: this.hasOpenDeletion("client", u.id),
        }));
    });
  }

  // ---- Retention & deletion --------------------------------------------------

  private hasOpenDeletion(type: DeletionTargetType, id: string): boolean {
    return this.state.deletionRequests.some(
      (r) => r.targetType === type && r.targetId === id && (r.status === "requested" || r.status === "processing"),
    );
  }

  private createDeletionRequest(type: DeletionTargetType, targetId: string, label: string, input: DeletionRequestInput): DeletionRequest {
    const admin = this.requireAdmin({ activity: true });
    const data = parseOrThrow(deletionRequestSchema, input);
    if (this.hasOpenDeletion(type, targetId)) {
      throw new PortalError("CONFLICT", "Für dieses Ziel existiert bereits ein Löschantrag.");
    }
    const now = this.now();
    const request: DeletionRequest = {
      id: this.newId(),
      targetType: type,
      targetId,
      targetLabel: label,
      requestedBy: admin.id,
      reason: data.reason,
      status: "requested",
      createdAt: this.iso(now),
      scheduledFor: this.iso(now + this.state.retentionDays * 24 * 60 * 60 * 1000),
      updatedAt: this.iso(now),
    };
    this.state.deletionRequests.push(request);
    this.audit("deletion.request", type, targetId);
    return request;
  }

  getRetentionPolicy(): Promise<RetentionPolicy> {
    return this.run(() => {
      this.requireUser();
      return { retentionDays: this.state.retentionDays };
    });
  }

  requestClientDeletion(clientId: string, input: DeletionRequestInput): Promise<DeletionRequest> {
    return this.run(() => {
      this.requireAdmin();
      const client = this.state.users.find((u) => u.id === clientId && u.role === "client");
      if (!client) throw new PortalError("NOT_FOUND", "Kunde nicht gefunden.");
      return this.createDeletionRequest("client", client.id, `${client.fullName} <${client.email}>`, input);
    });
  }

  requestProjectDeletion(projectId: string, input: DeletionRequestInput): Promise<DeletionRequest> {
    return this.run(() => {
      this.requireAdmin();
      const project = this.state.projects.find((p) => p.id === projectId);
      if (!project) throw new PortalError("NOT_FOUND", "Projekt nicht gefunden.");
      const request = this.createDeletionRequest("project", project.id, project.title, input);
      // A project scheduled for deletion is archived immediately so clients lose access.
      if (!project.archived) {
        project.archived = true;
        project.archivedAt = this.iso();
        project.updatedAt = project.archivedAt;
        this.audit("project.archive", "project", project.id);
      }
      return request;
    });
  }

  listDeletionRequests(): Promise<DeletionRequest[]> {
    return this.run(() => {
      this.requireAdmin();
      return this.state.deletionRequests.slice().sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    });
  }

  cancelDeletionRequest(requestId: string): Promise<DeletionRequest> {
    return this.run(() => {
      this.requireAdmin({ activity: true });
      const request = this.state.deletionRequests.find((r) => r.id === requestId);
      if (!request) throw new PortalError("NOT_FOUND", "Löschantrag nicht gefunden.");
      if (request.status !== "requested") throw new PortalError("INVALID_STATE", "Der Antrag kann nicht mehr storniert werden.");
      request.status = "cancelled";
      request.updatedAt = this.iso();
      this.audit("deletion.cancel", request.targetType, request.targetId);
      return request;
    });
  }

  // ---- test helpers (not part of the contract) --------------------------------

  /** Read-only snapshot for tests. */
  debugSnapshot(): MemoryState {
    return clone(this.state);
  }
}
