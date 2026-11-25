# Implementation Plan – B2B Client Management Portal (Phase 1)

Stand: 2026-11-25. Quelle der Anforderungen: Projekt-Brief „Prompt 1 Frontend“, Addendum
„Phase 1 additions“, Kickoff „PROJECT KICKOFF“ und Abschnitt „Production architecture A–I“.

## 1. Anforderungsanalyse

| Quelle | Inhalt | Umsetzung in |
|---|---|---|
| Brief | Stack, Design, Routen, Shared Components, Datenlayer, Verhalten, Tests, Deliverables | Phase 1 (dieses Repo) |
| Addendum | Dateiversionen, Scan-Status, Admin-MFA, Idle-Timeout, Löschung/Archivierung, Rechtsseiten, neue Contract-Methoden | Phase 1 |
| Kickoff | Plan zuerst, Checkliste, typisierte Fehler, ScanStatus ≠ FileStatus, Aufbewahrungsfrist, Quality Gates | Phase 1 |
| Production A–I | EU-Residency, RLS, Transaktionen, ClamAV, Outbox, Löschung, Server-Inaktivität, Backups, Security-Verifikation | **Phase 2** – in Phase 1 nicht ausführbar (kein Backend erlaubt, keine Provider-Zugänge). Wird im Vertrag vorbereitet und in `REPORT.md` + `docs/PHASE2_ARCHITECTURE.md` vollständig zugeordnet. |

Konflikt-Auflösung: Phase 1 verbietet echtes Backend/DB/Auth. Die Production-Anforderungen A–I werden
deshalb nicht „simuliert erfüllt“, sondern als offene Phase-2-Punkte mit Status `missing` geführt.
Phase-1-Simulationen (MFA, Scan, Session-Timeout) werden in UI und Doku ausdrücklich als Simulation markiert.

## 2. Architektur

```
src/
  app/                    Routen (App Router). Seiten sind dünn, Logik in features/
  components/ui/          shadcn/ui-Primitives (Button, Card, Dialog, …)
  components/             Shared Components (AppShell, ProgressBar, StatusBadge, ScanBadge,
                          FileRow, UploadDropzone, ConfirmDialog, InviteDialog, Toast, EmptyState, Skeleton)
  features/               admin/, client/, files/, auth/, security/, session/
  i18n/de.ts              alle UI-Texte
  lib/data/
    types.ts              Domänentypen (Project, ProjectFile, ProjectFileVersion, FileStatus, ScanStatus, …)
    errors.ts             PortalError + PortalErrorCode
    contract.ts           interface PortalDataSource
    index.ts              getDataSource() – einziger Einstiegspunkt für UI
    in-memory.ts          PHASE 1 ONLY: Implementierung (Autorisierung, Scan-Simulation, Session-Ablauf)
    fixtures.ts           PHASE 1 ONLY: einzige Datei mit Testdaten
  lib/validation.ts       Zod-Schemas (Phase 2 wiederverwendbar)
  lib/session/            Idle-Timer-Logik (rein, testbar)
  proxy.ts                optimistische Routen-Trennung (Dev-Cookie), keine echte Sicherheit
```

Kernprinzipien:
1. **Nur der Vertrag ist öffentlich.** UI importiert ausschließlich `@/lib/data` (index). ESLint-Regel
   `no-restricted-imports` + ein Vitest-Architekturtest verbieten Imports von `fixtures`/`in-memory` außerhalb von `src/lib/data`.
2. **Autorisierung im Datenlayer**, nicht nur im Routing. Die In-Memory-Implementierung prüft Rolle,
   Mitgliedschaft, Archivstatus, AAL2, Scan-Status und Session-Ablauf bei jedem Aufruf – analog zu RLS/Server-Checks in Phase 2.
3. **Aktueller Nutzer wird von der Implementierung aufgelöst** (wie Supabase über das JWT). Methoden bekommen keinen `actorId`-Parameter, damit sich die UI nicht ändern muss.
4. **Typisierte Fehler:** jede Methode wirft `PortalError` mit festem `code`; UI mappt Codes auf deutsche Texte.
5. **Zeit ist injizierbar** (`clock`) → Scan-Simulation und Session-Ablauf deterministisch testbar.
6. Zustand liegt im Browser-Speicher und wird in `sessionStorage` gespiegelt („nur für die Sitzung“), damit Reloads und Playwright-Navigation funktionieren.

## 3. Datenvertrag (Kurzfassung, Details in docs/CONTRACT.md)

Auth/Session: `signIn`, `verifyMfa`, `enrollMfa`, `confirmMfaEnrollment`, `getCurrentUser`, `touchSession`, `getSessionStatus`, `signOut`
Projekte: `listProjectsForUser`, `getProject`, `createProject`, `updateProject`, `setProgress`, `archiveProject`, `unarchiveProject`
Dateien: `listFiles`, `listFileVersions`, `requestUploadUrl`, `confirmUpload`, `approveFile`, `revertFile`, `deleteFile`, `getDownloadUrl`
Mitglieder/Kunden: `listMembers`, `inviteMember`, `listClients`
Löschung/Aufbewahrung: `getRetentionPolicy`, `requestClientDeletion`, `requestProjectDeletion`, `listDeletionRequests`, `cancelDeletionRequest`

Typen: `FileStatus = pending|approved`, `ScanStatus = pending|scanning|clean|infected|failed` (getrennt),
`ProjectFileVersion` (Versionshistorie, gruppiert über `groupId`), `DeletionRequest`, `RetentionPolicy`, `MfaEnrollment`, `SessionStatus`.

## 4. Geschäftsregeln (verbindlich, getestet)

- Admin-Login → `mfa_required` → `verifyMfa` → AAL2. Admin-Operationen ohne AAL2 → `MFA_REQUIRED`.
- Client → Admin-Routen/-Methoden → `FORBIDDEN`. Client sieht nur eigene, nicht archivierte Projekte.
- Download/Freigabe nur bei `scanStatus = clean` → sonst `SCAN_NOT_CLEAN`. Infizierte Dateien: kein Client-Zugriff.
- Neue Version: Vorgänger bleibt erhalten, `isCurrent` wechselt, Versionsnummer = max + 1, Status → `pending`, Scan neu.
- Client kann Freigabe nicht zurücknehmen (`FORBIDDEN`); Admin kann mit Bestätigung.
- Inaktivität: Warnung nach 25 min, Logout nach 30 min; der Datenlayer lehnt Aufrufe nach Ablauf mit `SESSION_EXPIRED` ab (simulierte Server-Prüfung).
- Löschanträge nur mit expliziter Bestätigung (Zod: Bestätigungswort), zeigen die konfigurierbare Aufbewahrungsfrist.

## 5. Reihenfolge (aus dem Kickoff)

1. Setup + Design-System → 2. Vertrag, Typen, Fixtures, Validierung → 3. Shared UI → 4. Admin →
5. Client → 6. Upload/Versionen/Scan/Freigaben → 7. MFA, Timeout, Löschung, Archiv → 8. Rechtsseiten →
9. Tests + Fehlerbehandlung → 10. Doku + Polish + Quality Gates.

## 6. Quality Gates

`npm run typecheck`, `npm run lint`, `npm run test` (Vitest), `npm run build`, `npm run test:e2e` (Playwright),
Routen-Check, Architekturtest „keine Fixture-Imports in UI“, responsives Layout (Playwright Mobile-Viewport),
Admin/Client-Trennung (Unit + E2E), vollständige `docs/PHASE1_CHECKLIST.md`.

## 7. Bewusste Abweichungen / Risiken

- shadcn-Registry ist in der Build-Umgebung gesperrt → Komponenten im shadcn-Stil von Hand mit `radix-ui`, `cva`, `tailwind-merge` (siehe DECISIONS.md).
- Next.js 16 mit `cacheComponents`: dynamische Params werden in `<Suspense>` gelesen.
- Phase-2-Anforderungen A–I sind nicht implementierbar ohne Supabase/Vercel/ClamAV-Zugang → `REPORT.md`.
