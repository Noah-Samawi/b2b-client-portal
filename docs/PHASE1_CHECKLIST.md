# Phase 1 – Checkliste

Status: ✅ erledigt · ⚠️ teilweise/mit Abweichung · ❌ fehlt. „Nachweis“ nennt Test oder Datei.
Stand: 2026-11-25.

## Stack

| Anforderung | Status | Nachweis |
|---|---|---|
| Next.js App Router | ✅ | `src/app/` |
| TypeScript strict | ✅ | `tsconfig.json` (`strict: true`), `npm run typecheck` |
| Tailwind CSS + shadcn/ui | ⚠️ | shadcn-Komponenten im shadcn-Stil von Hand (Registry gesperrt), DECISIONS #6 |
| Zod-Validierung (in Phase 2 wiederverwendbar) | ✅ | `src/lib/validation.ts`, `tests/unit/validation.test.ts` |
| Vitest + Playwright | ✅ | `tests/unit`, `tests/e2e` |

## Design

| Anforderung | Status | Nachweis |
|---|---|---|
| Strikter Dark Mode, kein Light Mode | ✅ | `globals.css` (nur dunkle Tokens, `color-scheme: dark`), E2E „dark theme“ |
| Radius 12px auf Cards, Buttons, Inputs, Badges, Dialogen | ✅ | `--radius: 0.75rem`, `rounded-xl` |
| Zinc-Palette, ein Akzent, 1px-Borders | ✅ | Emerald als einziger Akzent |
| Responsive, Sidebar → Drawer auf Mobile | ✅ | `app-shell.tsx`, E2E `responsive.spec.ts` (Pixel 7, kein horizontales Scrollen) |
| Sichtbare Fokusringe, aria-labels, WCAG AA, tastaturbedienbare Dialoge/Menüs | ✅ | axe-core E2E (`a11y.spec.ts`), Tastatur-Test für Dialoge |
| Deutsche UI, alle Texte in `src/i18n/de.ts` | ✅ | Validierungstexte liegen an den Zod-Schemas (DECISIONS #37) |

## Routen

| Route | Status | Nachweis |
|---|---|---|
| `/login` mit Validierung, Fehlertext, Dev-Rollenwahl | ✅ | `login-form.tsx`, E2E |
| `/admin` Projektkarten (Titel, Fortschritt, Dateien, Mitglieder), Suche, „Neues Projekt“ | ✅ | `admin-dashboard.tsx` |
| `/admin/projects/[id]` Header, Titel/Beschreibung editierbar, Slider + Zahl 0–100, Dateiliste mit Badges, Dropzone, Mitglieder + Einladen | ✅ | `admin-project-detail.tsx`, E2E |
| `/client` nur eigene Projekte | ✅ | Unit + E2E |
| `/client/projects/[id]` Fortschritt read-only, Download, Freigeben mit Bestätigung, kein Zurücknehmen | ✅ | E2E „approves a file without revert option“ |
| `/404` | ✅ | `not-found.tsx`, E2E (Status 404) |
| Error Boundary | ✅ | `error.tsx`, `global-error.tsx` |
| `/security` (TOTP-Platzhalter: QR, Code, Backup-Codes) | ✅ | E2E |
| `/impressum`, `/datenschutz`, `/agb` mit „Vom Rechtsberater prüfen lassen“ | ✅ | E2E |
| `/admin/clients` (Kunden, Löschanträge) – zusätzlich | ✅ | E2E |

## Shared Components

AppShell ✅ · ProgressBar ✅ · StatusBadge ✅ · ScanBadge ✅ · FileRow ✅ · UploadDropzone (Drag&Drop + Klick, Typen + 50 MB) ✅ ·
ConfirmDialog ✅ · InviteDialog ✅ · Toast ✅ · EmptyState ✅ · Skeleton ✅ · DeletionDialog ✅ · VersionHistoryDialog ✅

## Datenlayer

| Anforderung | Status | Nachweis |
|---|---|---|
| `types.ts` (Project, ProjectFile, Member, Role, FileStatus, ISO-Daten) | ✅ | |
| `ProjectFileVersion` + Versionshistorie | ✅ | `listFileVersions`, Unit-Test |
| `FileStatus` und `ScanStatus` getrennt | ✅ | `types.ts` |
| `contract.ts` mit allen Brief-Methoden (listProjectsForUser … getDownloadUrl) | ✅ | Architekturtest |
| Addendum-Methoden (listFileVersions, archiveProject, requestClientDeletion, enrollMfa, verifyMfa) | ✅ | Architekturtest |
| Typisierte, konsistente Fehler | ✅ | `errors.ts`, Unit-Tests prüfen `code` |
| Fixtures nur in `fixtures.ts`, Marker „PHASE 1 ONLY“ | ✅ | Architekturtest |
| UI importiert nie Fixtures, nur `getDataSource()` | ✅ | ESLint-Regel + Architekturtest |
| Zod-Schemas: Projekt, Fortschritt, Upload-Metadaten, Einladung | ✅ | + Login, MFA, Löschantrag |
| Phase 2 ersetzbar ohne UI-Änderung | ✅ | nur `createDataSource()` in `index.ts` tauschen |

## Verhalten Phase 1

| Anforderung | Status | Nachweis |
|---|---|---|
| Upload simuliert, Datei erscheint mit `pending` | ✅ | E2E Upload |
| Fortschritt bleibt für die Sitzung erhalten | ✅ | E2E (Reload) |
| Admin kann Freigabe mit Bestätigung zurücknehmen, Client nicht | ✅ | Unit + E2E |
| Empty States und Skeletons | ✅ | |
| Admin-Login mit simuliertem 2. Faktor | ✅ | Unit + E2E |
| Clients ohne Zugriff auf Admin-Routen | ✅ | Proxy + Guard + Datenlayer, E2E |
| Clients sehen nur eigene, nicht archivierte Projekte | ✅ | Unit + E2E |
| Download und Freigabe nur bei `clean` | ✅ | Unit + E2E (Quarantäne) |
| Scan-Simulation (pending → scanning → clean/infected) | ✅ | Unit + E2E |
| Neue Version setzt Freigabe auf `pending` | ✅ | Unit + E2E |
| Versionsnummer serverseitig, keine Duplikate bei parallelen Uploads | ✅ | Unit „concurrent uploads“ |
| Idle-Timeout Admin + Client: Warnung 25 min, Logout 30 min | ✅ | Unit (Tracker + Datenlayer für beide Rollen) |
| Ablauf auch ohne Browser-Timer erzwungen | ✅ (Simulation) | Datenlayer lehnt mit `SESSION_EXPIRED` ab |
| Projekt archivieren | ✅ | Unit + E2E |
| Kunden-/Projekt-Löschantrag mit expliziter Bestätigung | ✅ | Unit + E2E |
| Konfigurierbare Aufbewahrungsfrist, im Dialog angezeigt | ✅ | E2E „retention“ |
| Simulationen nicht als echte Sicherheit dargestellt | ✅ | Hinweise in Login, Sicherheit, Scan-Badge-Titel, README |

## Tests (aus dem Brief)

| Test | Status |
|---|---|
| Vitest: ProgressBar clamp 0–100 | ✅ |
| Vitest: StatusBadge Labels | ✅ |
| Vitest: Schemas lehnen Fortschritt 101 und leere Titel ab | ✅ |
| Playwright: Admin-Login, Projekt öffnen, Fortschritt ändern | ✅ |
| Playwright: Client sieht nur eigene Projekte, gibt Datei frei | ✅ |

## Deliverables

| Datei | Status |
|---|---|
| `README.md` | ✅ |
| `DECISIONS.md` | ✅ |
| `docs/CONTRACT.md` | ✅ |
| `docs/PHASE1_CHECKLIST.md` | ✅ |
| `docs/IMPLEMENTATION_PLAN.md` | ✅ |
| `REPORT.md` (Quality Gates + Production A–I) | ✅ |

## Bekannte Grenzen (bewusst, Phase 1)

- Keine echte Authentifizierung, kein echtes TOTP, kein echter Virenscan, kein echter Download-Inhalt.
- Eingeladene Personen können sich in Phase 1 nicht anmelden (kein Einladungs-Flow ohne Backend).
- Löschanträge werden nur verwaltet; eine Löschung von Daten findet nicht statt.
- Zustand ist pro Browser-Tab (sessionStorage); mehrere Tabs sind nicht synchronisiert.
