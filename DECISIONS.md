# DECISIONS

Jede Entscheidung mit Begründung. Format: **Entscheidung** – Begründung (– Konsequenz für Phase 2).

## Rahmen

1. **Brief + Addendum aus dem Planungschat übernommen.** Der Kickoff verweist auf „main project brief“ und „addendum“, die nicht beilagen. Verwendet wurden „Prompt 1: Frontend“ und „Addendum (Phase 1 additions)“ aus dem Planungsgespräch.
2. **Production-Anforderungen A–I sind Phase 2.** Phase 1 verbietet echtes Backend, DB und Auth. A–I setzen Supabase, Vercel, ClamAV, Backups voraus. Sie werden nicht „simuliert erfüllt“, sondern in `REPORT.md` als offen geführt; der Vertrag ist so geschnitten, dass sie ohne UI-Änderung umsetzbar sind (siehe `docs/PHASE2_ARCHITECTURE.md`).
3. **Simulationen sind sichtbar markiert** (Login-Hinweis, MFA-Demo-Code, „Virenscan (Simulation)“, Sicherheitsseite), damit nichts als echte Sicherheit missverstanden wird.

## Stack & Setup

4. **Next.js 16.4 (aktuelles create-next-app) mit `cacheComponents` + `partialPrefetching`** – Default des Generators, zukunftssicher. Dynamische Params werden mit `React.use(params)` innerhalb `<Suspense>` gelesen, `useSearchParams` ebenfalls in `<Suspense>`.
5. **`proxy.ts` statt `middleware.ts`** – in Next 16 umbenannt.
6. **shadcn/ui-Komponenten von Hand im shadcn-Stil** (`radix-ui`, `class-variance-authority`, `tailwind-merge`). Die shadcn-Registry (`ui.shadcn.com`) war in der Build-Umgebung per Proxy gesperrt. Gleiche API/Tokens wie shadcn; Komponenten können später per CLI ersetzt werden.
7. **Schrift `geist` als npm-Paket** statt `next/font/google` – kein Netzwerkzugriff beim Build nötig.
8. **Tailwind v4, Design-Tokens als CSS-Variablen** (shadcn-Namen). Nur dunkle Werte, `color-scheme: dark`, keine `prefers-color-scheme`-Weiche → strikter Dark Mode.
9. **Akzentfarbe Emerald** (einziger Akzent), Zinc-Neutraltöne, 1px-Borders, Radius 12px (`--radius: 0.75rem`, `rounded-xl` überall).
10. **`@types/node@22`** – Vitest 5 verlangt ≥ 22 als Peer.

## Architektur Datenlayer

11. **Implementierung und Daten getrennt:** `in-memory.ts` (Logik, keine Daten) und `fixtures.ts` (nur Daten). Der Brief nennt beides „fixtures.ts“; die Trennung hält die Datei-Regel („einzige Datei mit Fixture-Daten“) ein und macht die Logik testbar. Beide tragen den Marker `PHASE 1 ONLY`.
12. **Einziger UI-Einstieg `@/lib/data` (index.ts) mit `getDataSource()`** – durch ESLint-Regel und Architekturtest erzwungen.
13. **Aktueller Nutzer wird von der Implementierung aufgelöst**, Methoden haben keinen `actorId`-Parameter. Entspricht Supabase (JWT) und verhindert, dass die UI Identität „behaupten“ kann.
14. **Autorisierung im Datenlayer statt nur im Routing.** Rolle, Projektmitgliedschaft, Archivstatus, AAL2, Scan-Status und Sitzungsablauf werden pro Aufruf geprüft. Clients erhalten bei fremden/archivierten Projekten `NOT_FOUND` statt `FORBIDDEN` (keine Existenz-Leaks) – Phase 2: RLS-Verhalten identisch.
15. **Typisierte Fehler** `PortalError` mit festen Codes (`UNAUTHENTICATED`, `SESSION_EXPIRED`, `MFA_REQUIRED`, `MFA_INVALID`, `INVALID_CREDENTIALS`, `FORBIDDEN`, `NOT_FOUND`, `VALIDATION`, `CONFLICT`, `INVALID_STATE`, `SCAN_NOT_CLEAN`, `FILE_REJECTED`, `UNKNOWN`). Validierungsfehler tragen `details.fields`.
16. **Zod-Validierung zusätzlich im Datenlayer** – nicht nur in Formularen. Phase 2 nutzt dieselben Schemas serverseitig.
17. **Zustand in `sessionStorage` gespiegelt** – erfüllt „persists in memory for the session only“ und überlebt Reloads/Playwright-Navigation. Kein `localStorage` (keine Persistenz über die Sitzung hinaus).
18. **Injizierbare Uhr und ID-Fabrik** → Scan-Simulation und Session-Ablauf deterministisch testbar.
19. **Künstliche Latenz 150 ms** im Browser, damit Skeletons/Ladezustände sichtbar sind (Tests: 0 ms).

## Domäne

20. **`FileStatus` (pending/approved) und `ScanStatus` (pending/scanning/clean/infected/failed) getrennt.** Freigabe und Malware-Prüfung sind unabhängige Achsen.
21. **Dateiversionen über `groupId`.** Jede Version ist ein eigener Datensatz (`ProjectFileVersion`), genau eine hat `isCurrent`. Neue Version: Nummer = max + 1 (im Datenlayer berechnet), Vorgänger bleiben erhalten, Status → `pending`, Scan neu. `ProjectFile` = aktuelle Version + `versionCount`.
22. **Freigabe nur für die aktuelle Version** und nur bei `scanStatus = clean`. Download ebenfalls nur bei `clean`.
23. **Infizierte Dateien** sind für Clients unsichtbar (Liste, Verlauf, Download, Freigabe → `NOT_FOUND`), für Admins sichtbar aber gesperrt. Sie zählen für Clients nicht in `fileCount`.
24. **Clients können Freigaben nicht zurücknehmen** (`FORBIDDEN`); die UI zeigt keine Option. Admins können es mit Bestätigung.
25. **Upload in zwei Schritten** `requestUploadUrl` → (Binär-Upload) → `confirmUpload`, Tickets einmalig und mit Ablauf. Entspricht signierten Storage-Upload-URLs in Phase 2.
26. **Eingeladene Personen sind immer `client`** – Rolle kommt nie aus Eingaben (Schutz vor Rechteausweitung).
27. **Archivierte Projekte sind schreibgeschützt** (`INVALID_STATE`) und für Clients unsichtbar.
28. **Löschanträge** für Kunden und Projekte: Grund + Bestätigungswort `LÖSCHEN` (Zod-Literal), `scheduledFor = createdAt + retentionDays`, stornierbar, keine Doppelanträge (`CONFLICT`). Projekt-Löschantrag archiviert sofort. Kunden mit offenem Antrag können sich nicht anmelden. **Eine echte Löschung findet in Phase 1 nicht statt.**
29. **Eine konfigurierbare Aufbewahrungsfrist** (`retentionDays`, Default 30) über `getRetentionPolicy()`.
30. **Zusätzliche Vertragsmethoden** über Brief/Addendum hinaus: `signIn`, `getCurrentUser`, `getSessionStatus`, `touchSession`, `signOut`, `confirmMfaEnrollment`, `unarchiveProject`, `listClients`, `requestProjectDeletion`, `listDeletionRequests`, `cancelDeletionRequest`, `getRetentionPolicy`. Begründung: Auth, Archiv und Löschung brauchen sie, sonst müsste die UI an Fixtures vorbei.

## Auth, MFA, Sitzung

31. **AAL-Modell wie Supabase** (`aal1`/`aal2`). Admins brauchen immer `aal2`; Clients nur, wenn sie einen Faktor eingerichtet haben.
32. **MFA-Simulation:** Demo-Code `123456`, 8 einmalige Backup-Codes, QR-Platzhalter. Kein echtes TOTP – das wäre im Browser ohnehin keine Sicherheit.
33. **Login-Seite mit Dev-Rollenwahl**, die Demo-Zugangsdaten ausfüllt; die Rolle des Kontos entscheidet über den Bereich (Brief: „dev-only role switch“). Phase 2: entfernen.
34. **Idle-Timeout identisch für Admin und Client:** Warnung nach 25 min, Abmeldung nach 30 min. Zwei Ebenen: Browser-Tracker (UX) + Prüfung im Datenlayer bei jedem Aufruf (`SESSION_EXPIRED`). **Nur nutzerinitiierte Aktionen verlängern** die Sitzung; lesende Aufrufe (z. B. Scan-Polling) nicht. Während der Warnung beendet nur „Angemeldet bleiben“ die Warnung.
35. **`proxy.ts` mit Routing-Cookie `kp_role`** für sofortige Weiterleitung ohne Flackern. Ausdrücklich **keine** Sicherheitsgrenze (Test: gefälschtes Cookie gewährt keinen Zugriff, weil der Datenlayer keine Sitzung hat).
36. **`Cache-Control: private, no-store`** für Portalrouten, Security-Header (`nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy`, `Permissions-Policy`), `poweredByHeader: false`.

## UI

37. **Alle UI-Texte in `src/i18n/de.ts`**; Validierungstexte direkt an den Zod-Schemas (werden in Phase 2 serverseitig gleich ausgegeben).
38. **Barrierefreiheit:** Skip-Link, sichtbare Fokusringe, `aria-label` an Icon-Buttons, Label-in-Name (WCAG 2.5.3), Dialoge mit Fokusfalle (Radix), `role="alertdialog"` für Bestätigungen, Live-Region für Toasts, `progressbar`-Semantik. Geprüft mit axe-core (WCAG 2.0/2.1 A+AA) auf Login, Admin-Projekt, Client-Projekt.
39. **Eigener Toast** statt zusätzlicher Bibliothek (wenig Code, volle Kontrolle über `aria-live`).
40. **Fehleranzeige ohne interne Details** (Error Boundary zeigt nur Digest) – keine Datenlecks.

## Tests

41. **Vitest** für Datenlayer (Rechte, Scan, Versionen, Archiv, Löschung, Timeout), Komponenten, Schemas, Idle-Tracker und Architektur.
42. **Playwright gegen den Produktions-Build** (`next start`), Desktop + Mobile (Pixel 7). Chromium-Pfad per Umgebungsvariable überschreibbar.
