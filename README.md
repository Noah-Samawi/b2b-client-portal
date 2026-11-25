# Kundenportal – B2B Client Management Portal (Phase 1)

Frontend-Prototyp für ein B2B-Kundenportal: Projekte, Fortschritt, Dateien mit Versionen,
Virenscan-Status, Freigaben, Mitglieder, Archivierung und Löschanträge.

> **Phase 1 = kein Backend.** Anmeldung, zweiter Faktor, Virenscan und Sitzungsablauf sind
> **Simulationen** im Browser und **kein Produktionsschutz**. Alle Daten liegen hinter dem
> Vertrag `PortalDataSource` und werden in Phase 2 durch Supabase ersetzt – ohne UI-Änderungen.

## Stack

Next.js 16 (App Router, Cache Components) · TypeScript strict · Tailwind CSS v4 · shadcn/ui-Komponenten
(Radix) · Zod · Vitest + Testing Library · Playwright + axe-core

## Setup

```bash
npm install
npm run dev          # http://localhost:3000
```

Node.js ≥ 20.9.

## Scripts

| Befehl | Zweck |
|---|---|
| `npm run dev` | Entwicklungsserver |
| `npm run build` / `npm start` | Produktions-Build / -Server |
| `npm run typecheck` | Route-Typen erzeugen + `tsc --noEmit` |
| `npm run lint` | ESLint (inkl. Architekturregel, 0 Warnungen erlaubt) |
| `npm test` | Vitest (Datenlayer, Komponenten, Validierung, Idle-Timer, Architektur) |
| `npm run test:e2e` | Playwright (baut nicht selbst – vorher `npm run build`) |
| `npm run check` | alles in der richtigen Reihenfolge |

Playwright-Browser: `npx playwright install chromium`. Wenn der Download nicht möglich ist,
einen vorhandenen Chromium nutzen: `PLAYWRIGHT_CHROMIUM_EXECUTABLE=/pfad/zu/chrome npm run test:e2e`.

## Rollen wechseln (nur Phase 1)

Auf `/login` gibt es den Block **„Entwicklung: Rolle wählen“**. Er füllt Demo-Zugangsdaten aus:

| Rolle | E-Mail | Passwort | Zweiter Faktor |
|---|---|---|---|
| Admin | `admin@example.test` | `Admin1234!` | Pflicht, Demo-Code `123456` |
| Kunde A (Muster GmbH) | `anna.becker@muster-gmbh.test` | `Kunde1234!` | optional (unter `/security` einrichtbar) |
| Kunde B (Beispiel AG) | `jonas.weber@beispiel-ag.test` | `Kunde1234!` | optional |

Weitere Demo-Verhalten:
- Dateinamen mit `eicar`, `virus`, `infected` oder `malware` werden vom simulierten Scanner als infiziert markiert.
- Scan-Dauer: ca. 2,5 s (`pending → scanning → clean/infected`).
- Zustand liegt in `sessionStorage` – Tab schließen setzt alles auf die Fixtures zurück.

## Datenlayer

```
src/lib/data/
  types.ts       Domänentypen (FileStatus ≠ ScanStatus, ProjectFileVersion, DeletionRequest …)
  errors.ts      PortalError mit festen Codes
  contract.ts    interface PortalDataSource  ← einziges Ziel für Phase 2
  index.ts       getDataSource()             ← einziger Import für die UI
  in-memory.ts   PHASE 1 ONLY: Implementierung inkl. Autorisierung
  fixtures.ts    PHASE 1 ONLY: einzige Datei mit Testdaten
src/lib/validation.ts   Zod-Schemas, auch für Phase 2 (Server)
```

- UI importiert **nur** `@/lib/data`. ESLint (`no-restricted-imports`) und `tests/unit/architecture.test.ts` erzwingen das.
- Autorisierung passiert **im Datenlayer** (Rolle, Mitgliedschaft, Archiv, AAL2, Scan-Status, Sitzungsablauf) – wie später RLS + Server-Checks.
- Jede Methode wirft `PortalError` mit `code`; die UI übersetzt Codes über `src/i18n/de.ts`.
- Methodenbeschreibung: [`docs/CONTRACT.md`](docs/CONTRACT.md).

Phase 2: `src/lib/data/supabase.ts` implementiert denselben Vertrag, `createDataSource()` in `index.ts` gibt ihn zurück,
`getDevLoginHints()` liefert `[]`, `fixtures.ts`/`in-memory.ts` werden aus dem Produktions-Build entfernt.

## Routen

`/login` · `/admin` · `/admin/projects/[id]` · `/admin/clients` · `/client` · `/client/projects/[id]` ·
`/security` · `/impressum` · `/datenschutz` · `/agb` · 404 · Error Boundary (`error.tsx`, `global-error.tsx`)

## Dokumentation

- [`docs/IMPLEMENTATION_PLAN.md`](docs/IMPLEMENTATION_PLAN.md) – Plan vor der Umsetzung
- [`DECISIONS.md`](DECISIONS.md) – technische Entscheidungen und Begründungen
- [`docs/CONTRACT.md`](docs/CONTRACT.md) – Datenvertrag
- [`docs/PHASE1_CHECKLIST.md`](docs/PHASE1_CHECKLIST.md) – alle Anforderungen mit Status
- [`REPORT.md`](REPORT.md) – Quality Gates, Testergebnisse, offene Production-Anforderungen A–I
- [`docs/PHASE2_ARCHITECTURE.md`](docs/PHASE2_ARCHITECTURE.md) – Entwurf für Supabase/Vercel (nicht ausgeführt)
# b2b-client-portal
