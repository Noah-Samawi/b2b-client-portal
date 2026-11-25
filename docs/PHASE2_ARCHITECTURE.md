# Phase 2 – Architekturentwurf (Production A–I)

> **Status: Entwurf. Nichts davon ist ausgeführt, deployt oder getestet.**
> SQL unten ist eine Vorlage für `supabase/migrations`, kein geprüfter Code. Jede Aussage zu Regionen
> und Anbietern muss gegen die tatsächlich gebuchte Infrastruktur und die Auftragsverarbeitungsverträge
> geprüft werden, bevor „EU-Datenresidenz“ oder „DSGVO-konform“ behauptet wird.

Grundsatz: Die UI bleibt unverändert. `src/lib/data/supabase.ts` implementiert `PortalDataSource`.
Schreibende und sicherheitskritische Operationen laufen über Server Actions/Route Handlers bzw. Postgres-RPCs;
RLS ist die letzte Verteidigungslinie, nicht Middleware.

## A. EU-Datenresidenz

| Komponente | Ziel | Hinweis |
|---|---|---|
| Supabase Postgres/Auth/Storage | Projekt in `eu-central-1` (Frankfurt) anlegen | Region ist bei Projekterstellung zu wählen und später nicht änderbar. |
| Supabase Edge Functions | Aufruf mit `x-region: eu-central-1` bzw. `region` im supabase-js-Client; für Webhooks/CORS `?forceFunctionRegion=eu-central-1` | Ohne Angabe laufen Functions am Rand nahe dem Aufrufer. Bei explizit gesetzter Region gibt es keine automatische Umleitung bei Ausfall. |
| Vercel Functions | `vercel.json` → `"regions": ["fra1"]` (bereits im Repo) | Default ist `iad1` (USA). Failover-Regionen nur EU wählen (z. B. `dub1`, `cdg1`), falls genutzt. |
| Statische Assets / CDN | global | Enthalten keine Kundendaten. |
| Private Dokumente | private Bucket, signierte URLs (60 s), `Cache-Control: private, no-store` | Prüfen, ob Supabase-Storage-CDN signierte Antworten außerhalb der EU cacht → als Restrisiko in REPORT.md. |
| E-Mail | EU-Anbieter mit AVV | Keine Dokumentinhalte in E-Mails, nur Hinweis + Link. |
| Logs/Analytics | keine personenbezogenen Daten, keine Dateiinhalte | Logger mit Allowlist für Felder; IDs statt E-Mails. |

Mögliche Drittlandbezüge, die geprüft werden müssen: Supabase Inc. und Vercel Inc. sind US-Unternehmen
(Support-/Admin-Zugriffe, Sub-Prozessoren). Grundlage (DPF/SCCs) dokumentieren.

## B. Autorisierung

- RLS auf **jeder** Tabelle, `force row level security`. Rollen nur in `profiles.role`, änderbar ausschließlich über `security definer`-Funktion mit Admin-Prüfung.
- `restrictive` Policies für: Client darf `profiles.role` nie ändern, keine `projects`-/`project_members`-Writes, keine `scan_status`-Writes.
- Admin-Operationen prüfen `auth.jwt()->>'aal' = 'aal2'`.
- Service-Role-Key nur serverseitig (`server-only`-Import), nie `NEXT_PUBLIC_`.
- Tests direkt gegen PostgREST und Storage-API mit Client-JWTs (nicht nur UI).

```sql
-- Entwurf
create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin')
     and coalesce(auth.jwt()->>'aal', '') = 'aal2'
$$;

create policy "clients read own non-archived projects" on public.projects
  for select to authenticated
  using (public.is_admin() or (not archived and exists (
    select 1 from public.project_members m where m.project_id = id and m.user_id = auth.uid())));

create policy "no self role change" on public.profiles as restrictive
  for update to authenticated
  using (true) with check (role = (select role from public.profiles where id = auth.uid()) or public.is_admin());
```

## C. Transaktionssichere Versionierung

```sql
-- Entwurf
create unique index file_versions_one_current_per_group
  on public.file_versions (group_id) where is_current;
create unique index file_versions_group_version on public.file_versions (group_id, version);

create or replace function public.create_file_version(p_project uuid, p_group uuid, p_name text,
  p_mime text, p_size bigint, p_storage_path text) returns public.file_versions
language plpgsql security definer set search_path = '' as $$
declare v_next int; v_row public.file_versions;
begin
  if not public.is_admin() then raise exception 'FORBIDDEN' using errcode = '42501'; end if;
  perform pg_advisory_xact_lock(hashtext(p_group::text));          -- Gruppe sperren
  select coalesce(max(version), 0) + 1 into v_next from public.file_versions where group_id = p_group;
  update public.file_versions set is_current = false where group_id = p_group and is_current;
  insert into public.file_versions (project_id, group_id, version, is_current, name, mime_type,
    size_bytes, storage_path, status, scan_status, uploaded_by)
  values (p_project, p_group, v_next, true, p_name, p_mime, p_size, p_storage_path,
    'pending', 'pending', auth.uid())
  returning * into v_row;
  insert into public.audit_log (actor_id, action, entity, entity_id) values (auth.uid(), 'file.version', 'file', v_row.id);
  return v_row;
end $$;
```

Vorgängerversionen werden nie gelöscht; `deleteFile` läuft über den Löschprozess (F).

## D. Malware-Scan

- Upload in privaten Quarantäne-Pfad, `scan_status = 'pending'`; Clients haben per Policy nur Zugriff bei `scan_status = 'clean'`.
- ClamAV-Worker in EU (eigener Container, z. B. EU-Hoster), zieht Jobs aus `scan_jobs`, prüft MIME per Magic Bytes (`file --mime-type`/libmagic) gegen Whitelist, scannt mit `clamd`, schreibt Ergebnis über Service-Funktion (`set_scan_result`), die nur der Worker-Rolle erlaubt ist.
- `infected` → Objekt in Quarantäne-Bucket verschieben, Audit-Eintrag, Admin-Benachrichtigung.
- Monitoring: Health-Check des Workers, Alter der Signaturen (`freshclam`), Länge der Warteschlange.

## E. Benachrichtigungen

```sql
-- Entwurf
create table public.notification_outbox (
  id uuid primary key default gen_random_uuid(),
  idempotency_key text not null unique,
  kind text not null,
  recipient_id uuid not null references public.profiles(id),
  payload jsonb not null,            -- keine Dokumentinhalte
  status text not null default 'pending' check (status in ('pending','sent','failed')),
  attempts int not null default 0 check (attempts <= 3),
  last_error text,
  created_at timestamptz not null default now(),
  sent_at timestamptz
);
```

Outbox-Zeile wird in derselben Transaktion wie die fachliche Änderung geschrieben; ein Worker versendet
asynchron, max. 3 Versuche mit Backoff. Fehler beim Mailanbieter rollen nichts zurück.

## F. Aufbewahrung & Löschung

- `deletion_requests(id, requester_id, target_type, target_id, status, reason, created_at, scheduled_for, processed_at, error)`.
- `retention_settings` mit genau einer Zeile (`retention_days`).
- Geplanter Job: nur Anträge mit `status='requested'` und `scheduled_for <= now()` → `processing` → DB-Löschung in Transaktion → danach Storage-Objekte (alle Versionen) → `completed`. Idempotent (wiederholbar), Storage erst nach validiertem DB-Schritt.
- Audit-Einträge werden pseudonymisiert statt gelöscht, Aufbewahrung laut dokumentierter Richtlinie.
- Export (Art. 15/20) enthält alle Versionen.

## G. Server-seitige Inaktivität

- Tabelle `session_activity(session_id, user_id, last_activity_at)`; Update bei jeder schreibenden Server-Operation.
- Prüffunktion in jeder RPC/Policy für geschützte Operationen: `now() - last_activity_at <= interval '30 minutes'`, sonst Fehler `SESSION_EXPIRED` und Sitzung widerrufen.
- Damit direkte PostgREST-Zugriffe die Regel nicht umgehen, hängen Policies an dieser Prüfung (oder kurze JWT-Laufzeit + Refresh nur bei Aktivität). Muss gegen das tatsächliche Supabase-Session-Verhalten getestet werden.

## H. Backup & Restore

- Postgres: Supabase-Backups/PITR (planabhängig prüfen) **plus** eigener verschlüsselter `pg_dump` in separaten EU-Speicher.
- Storage: privater Bucket wird separat gesichert (Supabase-Backups enthalten keine Storage-Objekte – zu verifizieren), verschlüsselt, getrennt von Produktion.
- Frequenz/Aufbewahrung dokumentieren; Restore-Test für DB **und** Dateien mit Ergebnis in REPORT.md.

## I. Sicherheitsverifikation

Testmatrix (RLS-Integrationstests mit Supabase local + E2E):
RLS je Tabelle · Storage-Policies · Cross-Client-Zugriff · Rollen-Eskalation · MFA/AAL2 · abgelaufene Sitzung ·
Zugriff auf infizierte Datei · Ablauf signierter URLs · Löschung und Wiederherstellung. Jedes Ergebnis in REPORT.md.
