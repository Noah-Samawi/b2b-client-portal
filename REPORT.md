# REPORT

Stand: 2026-11-25. Ursprüngliche Gates: Linux-Sandbox, Node 22.23, Next.js 16.4.6.
Erneute Prüfung in dieser Umgebung: macOS arm64, Node 22.22.3, Next.js 16.4.6, Playwright Chromium 159 (arm64).

## 1. Quality Gates (Phase 1)

| Gate | Befehl | Ergebnis |
|---|---|---|
| Typecheck | `npm run typecheck` | ✅ 0 Fehler |
| Lint | `npm run lint` | ✅ 0 Fehler, 0 Warnungen |
| Unit-Tests | `npm test` | ✅ 58/58 (5 Dateien) |
| Build | `npm run build` | ✅ 14 Routen, `/admin/projects/[id]` und `/client/projects/[id]` als Partial Prerender |
| E2E + a11y | `PLAYWRIGHT_CHROMIUM_EXECUTABLE=… npm run test:e2e` | ✅ 20/20 (Desktop + Mobile) |
| Routen geprüft | E2E | ✅ `/login`, `/admin`, `/admin/projects/[id]`, `/admin/clients`, `/client`, `/client/projects/[id]`, `/security`, `/impressum`, `/datenschutz`, `/agb`, 404 |
| Responsive | `responsive.spec.ts` (Pixel 7) | ✅ Drawer, kein horizontales Scrollen |
| Admin/Client-Trennung | Unit `access separation` + E2E | ✅ Datenlayer, Guard und Proxy |
| Keine Fixture-Imports in UI | ESLint-Regel + `architecture.test.ts` | ✅ (Regel mit Probedatei verifiziert) |
| Checkliste vollständig | `docs/PHASE1_CHECKLIST.md` | ✅ |
| Barrierefreiheit | axe-core WCAG 2.0/2.1 A+AA | ✅ Login, Admin-Projekt, Client-Projekt ohne Verstöße |

Hinweis zu Playwright: Der erste Lauf nutzte ein x86_64-Chromium unter Rosetta; fünf Tests liefen dort in das 45-Sekunden-Limit (Seite noch bei „Wird geladen …“). Mit nativem arm64-Chromium: **20/20 in 41 s**. Der erste Bericht (Chrome for Testing 153, Linux) bleibt als frühere Messung stehen; die Zahlen oben sind die Wiederholung auf diesem Rechner.

## 2. Was die Phase-1-Tests absichern

- Admin braucht zweiten Faktor; falscher Code wird abgelehnt.
- Clients: nur eigene, nicht archivierte Projekte; keine Admin-Methoden; `/admin*` → Weiterleitung; fremdes Projekt → „nicht gefunden“.
- Gefälschtes Routing-Cookie gewährt keinen Zugriff.
- Download/Freigabe erst bei `clean`; infizierte Dateien für Clients unsichtbar.
- Neue Version: Historie bleibt, Nummer +1, Freigabe → `pending`; parallele Uploads ohne doppelte Versionsnummern.
- Clients können Freigaben nicht zurücknehmen, Admins schon.
- Archivierte Projekte schreibgeschützt und für Clients unsichtbar.
- Löschanträge nur mit Bestätigungswort; Frist = konfigurierte Aufbewahrungsdauer; keine Doppelanträge.
- Idle-Timeout für **beide Rollen**: Ablauf nach 30 min im Datenlayer; Polling verlängert nicht; UI-Warnung nach 25 min.

**Wichtig:** Diese Prüfungen laufen in Phase 1 im Browser. Sie beweisen die Geschäftslogik und das
Vertragsverhalten, aber **keine Sicherheit** – jeder Nutzer kann Browser-Code manipulieren.

## 3. Production-Anforderungen A–I

Alle Punkte setzen echte Infrastruktur voraus (Supabase-Projekt, Vercel-Projekt, ClamAV-Worker,
Backup-Speicher, Anbieterverträge). Phase 1 verbietet Backend, DB und Auth. **Keiner dieser Punkte ist
umgesetzt oder verifiziert.** Entwurf: `docs/PHASE2_ARCHITECTURE.md`.

| # | Anforderung | Status | Vorbereitet in Phase 1 | Offen |
|---|---|---|---|---|
| A | EU-Datenresidenz | ❌ offen (⚠️ Teilvorbereitung) | `vercel.json` mit `regions: ["fra1"]`; `Cache-Control: private, no-store` für Portalrouten; keine Analytics/Logs mit Personendaten im Code | Supabase-Projekt in `eu-central-1` anlegen, Edge-Function-Region erzwingen, Storage-CDN-Verhalten für signierte URLs prüfen, Datenflüsse/Sub-Prozessoren/Drittlandtransfers (Supabase Inc., Vercel Inc.) mit AVV dokumentieren. **Keine Aussage „EU-only“ oder „DSGVO-konform“ ohne diese Prüfung.** |
| B | Starke Autorisierung (RLS, AAL2, Storage) | ❌ offen | Regeln im Datenlayer identisch modelliert und getestet; Rollen nie aus Eingaben; `NOT_FOUND` statt `FORBIDDEN` | RLS/Restrictive Policies, Storage-Policies, Tests gegen PostgREST/Storage-API direkt |
| C | Transaktionssichere Versionierung | ❌ offen | Versionsnummer serverseitig, eine aktuelle Version, keine Löschung bei Upload (Unit-getestet) | RPC mit Lock, partieller Unique-Index, Nebenläufigkeitstest gegen Postgres |
| D | Malware-Scan mit ClamAV | ❌ offen | `ScanStatus` + Quarantäne-Verhalten + UI | EU-Worker, Magic-Byte-Prüfung, Quarantäne-Bucket, Scan-Logs, Monitoring |
| E | Zuverlässige Benachrichtigungen | ❌ offen | – (Phase 1 versendet nichts) | `notification_outbox`, Worker, Idempotenz, 3 Retries |
| F | Aufbewahrung & Löschung | ❌ offen (⚠️ UI/Vertrag fertig) | `deletion_requests`-Modell, eine Frist, Bestätigung, Storno | Idempotenter DB+Storage-Löschjob, Audit-Aufbewahrung, Export inkl. Versionen |
| G | Server-seitige Inaktivität | ❌ offen (⚠️ simuliert) | Ablaufprüfung pro Aufruf im Datenlayer, nur Aktivität verlängert | Server-verifizierbare Aktivität, Absicherung gegen direkten Supabase-API-Zugriff, Tests beider Rollen |
| H | Backup & Restore | ❌ offen | – | Verschlüsselte DB- und Storage-Backups getrennt von Produktion, Restore-Test mit Ergebnis |
| I | Sicherheitsverifikation | ❌ offen | Testmatrix definiert | Alle Tests gegen echte Infrastruktur ausführen und hier dokumentieren |

### Restore-Ergebnisse
Noch keine – es existiert keine Produktionsinfrastruktur.

### Sicherheitstests gegen echte Infrastruktur
Noch keine. Vorlage für die Dokumentation pro Test:

| Test | Methode | Erwartung | Ergebnis | Datum |
|---|---|---|---|---|
| Cross-Client-Lesen `projects` | PostgREST mit JWT Kunde B | 0 Zeilen | – | – |
| Rollen-Eskalation `profiles.role` | PATCH mit Client-JWT | abgelehnt | – | – |
| … | | | | |

## 4. Infrastrukturzugang (GitHub und Supabase)

Phase 1 braucht kein Backend. Geprüft wurde nur, ob die vorhandene Infrastruktur erreichbar ist. Es wurde kein zweites Repository und kein zweites Supabase-Projekt angelegt. Es wurden keine Dateien gelöscht und keine Secrets committet.

### GitHub

| Prüfung | Ergebnis |
|---|---|
| Repository | https://github.com/Noah-Samawi/b2b-client-portal.git (öffentlich, Default-Branch `main`) |
| Remote-Historie | leer (`size: 0`, Commits-API HTTP 409 „Git Repository is empty“) |
| Lokales Git vor dieser Prüfung | kein `.git`, kein `origin` |
| Bestehende Dateien | unverändert übernommen, nichts überschrieben oder gelöscht |

`origin` zeigt auf dieses Repository. Auf `main` lag bereits ein Commit (`052d733`, nur `README.md`, 2026-11-25 01:27). Diese Historie bleibt. Der Phase-1-Stand liegt im Folge-Commit, nach den Quality Gates. Keine Datei aus dem ersten Commit wurde überschrieben.

### Supabase

CLI `2.106.0` ist installiert und bei einer Organisation angemeldet. Ein Projekt für dieses Portal ist darüber **nicht** erreichbar. `supabase link` ist nicht gelaufen. Im Repo gibt es kein `supabase/config.toml` und keine `.env` (nur `.env.example`).

Sichtbare Projekte (kein Portal-Projekt):

| Ref | Region | Status | Name |
|---|---|---|---|
| `ateuoebupqdbyodxgwzy` | `eu-west-1` (Irland) | INACTIVE | persönliches Standardprojekt |
| `vcqgvlxjekywfgotqhto` | `eu-west-1` (Irland) | INACTIVE | `shiftflow_app` |
| `tzmtgkwygfytsuuiylhh` | `eu-central-1` (Frankfurt) | ACTIVE_HEALTHY | `m_sharif` |

Frankfurt ist für **dieses** Portal nicht belegt. Das einzige Projekt in `eu-central-1` gehört zu einer anderen Anwendung und wurde nicht verknüpft.

Supabase MCP fehlt in dieser Session: kein Eintrag in der Cursor-MCP-Konfiguration, kein Namespace `supabase` unter den verfügbaren Tools. Ohne OAuth sind keine Projekt-Tools aufrufbar.

Für Phase 2 fehlt damit:

1. Der Projekt-Ref des Portals, falls es in einer Organisation liegt, die dieses CLI-Token nicht sieht (erneut anmelden, Zugriff auf diese Org). Keines der drei sichtbaren Projekte verwenden.
2. Supabase MCP in Cursor einrichten und den OAuth-Login abschließen.
3. Lokal `.env` aus `.env.example`: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`. `SUPABASE_SERVICE_ROLE_KEY` nur serverseitig, nie `NEXT_PUBLIC_`, nie ins Repository.

## 5. Bekannte Abweichungen

- shadcn/ui-Komponenten wurden von Hand im shadcn-Stil gebaut (Registry gesperrt).
- Fixtures sind auf `fixtures.ts` (Daten) und `in-memory.ts` (Logik) aufgeteilt; beide `PHASE 1 ONLY`.
- Drei statt zwei Projekte in den Fixtures (das dritte ist archiviert, um Archivierung zeigen zu können).
