# PortalDataSource – Datenvertrag

Quelle: `src/lib/data/contract.ts`. Phase 2 implementiert **genau diese Signaturen** (z. B. `src/lib/data/supabase.ts`).
Ändert sich eine Signatur, wird diese Datei angepasst und der Grund in `DECISIONS.md` festgehalten.

## Allgemeine Regeln

- Jede Methode gibt ein `Promise` zurück und lehnt mit `PortalError` (`src/lib/data/errors.ts`) ab.
- Der aktuelle Nutzer wird von der Implementierung ermittelt (Phase 2: Supabase-Session/JWT), nie übergeben.
- Autorisierung passiert in der Implementierung (Phase 2: RLS + Server-Checks), nicht in der UI.
- Eingaben werden mit den Zod-Schemas aus `src/lib/validation.ts` validiert → `VALIDATION` mit `details.fields`.
- Geschützte Methoden: `UNAUTHENTICATED` ohne Sitzung, `SESSION_EXPIRED` nach 30 min Inaktivität,
  `MFA_REQUIRED` wenn AAL2 nötig, aber nur AAL1 vorhanden (Admins immer, Clients mit Faktor).
- „Aktivität“ (verlängert die Sitzung): alle schreibenden Aufrufe, `touchSession`, `verifyMfa`. Lesende Aufrufe verlängern nicht.
- Clients erhalten für fremde oder archivierte Projekte `NOT_FOUND`, nicht `FORBIDDEN`.
- Datumswerte sind ISO-8601-Strings (UTC).

## Fehlercodes

| Code | Bedeutung |
|---|---|
| `UNAUTHENTICATED` | keine Sitzung |
| `SESSION_EXPIRED` | Inaktivitäts-Timeout überschritten (Sitzung wird beendet) |
| `MFA_REQUIRED` | zweiter Faktor fehlt (AAL2) |
| `MFA_INVALID` | falscher Code |
| `INVALID_CREDENTIALS` | E-Mail/Passwort falsch |
| `FORBIDDEN` | Rolle reicht nicht |
| `NOT_FOUND` | existiert nicht oder nicht sichtbar |
| `VALIDATION` | Eingaben ungültig (`details.fields`) |
| `CONFLICT` | Duplikat (Mitglied, Löschantrag) |
| `INVALID_STATE` | Zustand erlaubt Aktion nicht (archiviert, schon freigegeben, abgelaufenes Ticket …) |
| `SCAN_NOT_CLEAN` | Download/Freigabe vor erfolgreichem Scan |
| `FILE_REJECTED` | reserviert für Phase 2 (Signatur-/MIME-Prüfung serverseitig) |
| `UNKNOWN` | unerwartet |

## Typen (Auszug)

- `Role = "admin" | "client"`
- `FileStatus = "pending" | "approved"` (Freigabe)
- `ScanStatus = "pending" | "scanning" | "clean" | "infected" | "failed"` (Malware-Scan, unabhängig)
- `AssuranceLevel = "aal1" | "aal2"`
- `ProjectFileVersion` – eine unveränderliche Version (`groupId`, `version`, `isCurrent`, `status`, `scanStatus`, …)
- `ProjectFile` – aktuelle Version + `versionCount`
- `DeletionRequest` – `targetType`, `targetId`, `requestedBy`, `reason`, `status`, `createdAt`, `scheduledFor`, `updatedAt`
- `RetentionPolicy` – `{ retentionDays }`
- `UploadTicket`, `DownloadLink`, `MfaEnrollment`, `SignInResult`, `SessionStatus`, `Member`, `ClientSummary`

## Methoden

### Auth & Sitzung

| Methode | Wer | Beschreibung | Fehler |
|---|---|---|---|
| `signIn({email,password})` | alle | Startet Sitzung mit AAL1. Ergebnis `authenticated` oder `mfa_required`. Konten mit offenem Löschantrag werden abgewiesen. | `VALIDATION`, `INVALID_CREDENTIALS`, `FORBIDDEN` |
| `verifyMfa(code)` | angemeldet (AAL1) | TOTP-Code oder einmaliger Backup-Code → AAL2. | `UNAUTHENTICATED`, `VALIDATION`, `MFA_INVALID` |
| `enrollMfa()` | angemeldet | Startet TOTP-Einrichtung: `factorId`, `secret`, `otpauthUri`, 8 Backup-Codes. | `MFA_REQUIRED` |
| `confirmMfaEnrollment(factorId, code)` | angemeldet | Schließt Einrichtung ab, setzt `mfaEnrolled`, Sitzung → AAL2. | `NOT_FOUND`, `MFA_INVALID` |
| `getCurrentUser()` | alle | Nutzer oder `null` (wirft nicht). | – |
| `getSessionStatus()` | angemeldet | `user`, `aal`, `lastActivityAt`, `expiresAt`. | `UNAUTHENTICATED`, `SESSION_EXPIRED` |
| `touchSession()` | angemeldet | Heartbeat bei Nutzeraktivität. | `UNAUTHENTICATED`, `SESSION_EXPIRED` |
| `signOut()` | alle | Beendet die Sitzung. | – |

### Projekte

| Methode | Wer | Beschreibung | Fehler |
|---|---|---|---|
| `listProjectsForUser({includeArchived?})` | alle | Admin: alle (Archiv optional). Client: nur eigene, nie archivierte. Sortiert nach `updatedAt` absteigend. | Session-Fehler |
| `getProject(id)` | alle | Einzelnes Projekt inkl. `fileCount`, `memberCount`. | `NOT_FOUND` |
| `createProject({title,description?})` | Admin | Neues Projekt, Fortschritt 0. | `FORBIDDEN`, `VALIDATION` |
| `updateProject(id, {title?,description?})` | Admin | Teil-Update, mindestens ein Feld. | `FORBIDDEN`, `VALIDATION`, `INVALID_STATE` (archiviert) |
| `setProgress(id, n)` | Admin | Ganzzahl 0–100. | `FORBIDDEN`, `VALIDATION`, `INVALID_STATE` |
| `archiveProject(id)` | Admin | Archivieren → schreibgeschützt, für Clients unsichtbar. | `FORBIDDEN`, `INVALID_STATE` |
| `unarchiveProject(id)` | Admin | Wiederherstellen (nicht bei offenem Löschantrag). | `FORBIDDEN`, `INVALID_STATE` |

### Dateien & Versionen

| Methode | Wer | Beschreibung | Fehler |
|---|---|---|---|
| `listFiles(projectId)` | Mitglieder, Admin | Aktuelle Versionen. Clients sehen keine infizierten Dateien. | `NOT_FOUND` |
| `listFileVersions(groupId)` | Mitglieder, Admin | Alle Versionen, neueste zuerst. | `NOT_FOUND` |
| `requestUploadUrl(projectId, meta, groupId?)` | Admin | Validiert Name/MIME/Größe (≤ 50 MB, Erweiterungs-Whitelist), gibt einmaliges Ticket (10 min). Mit `groupId` = neue Version. | `FORBIDDEN`, `VALIDATION`, `INVALID_STATE`, `NOT_FOUND` |
| `confirmUpload(uploadId)` | Admin | Legt Version an: Nummer serverseitig = max + 1, Vorgänger bleiben, genau eine aktuelle Version, `status=pending`, `scanStatus=pending`. | `NOT_FOUND`, `INVALID_STATE` (abgelaufen) |
| `approveFile(fileId)` | Mitglied (Client), Admin | `pending → approved`, nur aktuelle Version, nur `clean`. | `SCAN_NOT_CLEAN`, `INVALID_STATE`, `NOT_FOUND` |
| `revertFile(fileId)` | **nur Admin** | `approved → pending`. | `FORBIDDEN`, `INVALID_STATE` |
| `deleteFile(groupId)` | Admin | Entfernt die Dateigruppe mit allen Versionen (Phase 2: über kontrollierten Löschprozess). | `FORBIDDEN`, `NOT_FOUND`, `INVALID_STATE` |
| `getDownloadUrl(fileId)` | Mitglied, Admin | Kurzlebiger Link (60 s), nur bei `clean`. | `SCAN_NOT_CLEAN`, `NOT_FOUND` |

### Mitglieder & Kunden

| Methode | Wer | Beschreibung | Fehler |
|---|---|---|---|
| `listMembers(projectId)` | Mitglieder, Admin | Mitglieder mit Status `active`/`invited`. | `NOT_FOUND` |
| `inviteMember(projectId, {email,fullName})` | Admin | Legt ggf. Client an (Rolle immer `client`) und fügt hinzu. | `VALIDATION` (Admin-Adresse), `CONFLICT`, `INVALID_STATE` |
| `listClients()` | Admin | Kunden mit Projektanzahl und `pendingDeletion`. | `FORBIDDEN` |

### Aufbewahrung & Löschung

| Methode | Wer | Beschreibung | Fehler |
|---|---|---|---|
| `getRetentionPolicy()` | angemeldet | `{ retentionDays }` – eine konfigurierbare Frist. | Session-Fehler |
| `requestClientDeletion(clientId, {reason,confirmation})` | Admin | Antrag, `confirmation` muss exakt `LÖSCHEN` sein. `scheduledFor = jetzt + Frist`. | `VALIDATION`, `CONFLICT`, `NOT_FOUND` |
| `requestProjectDeletion(projectId, {reason,confirmation})` | Admin | Wie oben; archiviert das Projekt sofort. | wie oben |
| `listDeletionRequests()` | Admin | Alle Anträge, neueste zuerst. | `FORBIDDEN` |
| `cancelDeletionRequest(id)` | Admin | Nur im Status `requested`. | `INVALID_STATE`, `NOT_FOUND` |

## Nicht Teil des Vertrags

- `getDevLoginHints()` und `resetDemoData()` in `index.ts` sind Phase-1-Hilfen (Phase 2: leer/no-op).
- `debugSnapshot()` existiert nur an der In-Memory-Klasse für Tests.
