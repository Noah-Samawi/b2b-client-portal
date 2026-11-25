/**
 * Public entry point of the data layer. UI code imports ONLY from "@/lib/data".
 *
 * Phase 2: replace the body of `createDataSource()` with the Supabase implementation
 * (src/lib/data/supabase.ts) and make `getDevLoginHints()` return []. No UI change is needed.
 */
import type { PortalDataSource } from "./contract";
import { InMemoryPortalDataSource, type MemoryState, type StateStorage } from "./in-memory"; // PHASE 1 ONLY
import { createFixtureState, DEMO_ACCOUNTS, DEMO_MFA_CODE } from "./fixtures"; // PHASE 1 ONLY

export type { PortalDataSource } from "./contract";
export * from "./types";
export * from "./errors";

const STORAGE_KEY = "kundenportal.phase1.state.v1";

/** Mirrors the in-memory state into sessionStorage: data lives for the browser session only. */
function sessionStorageAdapter(): StateStorage | undefined {
  if (typeof window === "undefined" || !window.sessionStorage) return undefined;
  return {
    load() {
      try {
        const raw = window.sessionStorage.getItem(STORAGE_KEY);
        return raw ? (JSON.parse(raw) as MemoryState) : null;
      } catch {
        return null;
      }
    },
    save(state) {
      try {
        window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(state));
      } catch {
        /* storage full or blocked: keep working in memory only */
      }
    },
    clear() {
      window.sessionStorage.removeItem(STORAGE_KEY);
    },
  };
}

function createDataSource(): PortalDataSource {
  return new InMemoryPortalDataSource(createFixtureState(), {
    mfaCode: DEMO_MFA_CODE,
    storage: sessionStorageAdapter(),
    latencyMs: 150,
    scanDurationMs: 2500,
  });
}

let instance: PortalDataSource | null = null;

/** Returns the process-wide data source (browser singleton). */
export function getDataSource(): PortalDataSource {
  if (!instance) instance = createDataSource();
  return instance;
}

export interface DevLoginHint {
  label: string;
  email: string;
  password: string;
}

/** Demo credentials for the dev-only role switch on /login. Phase 2: return []. */
export function getDevLoginHints(): { accounts: DevLoginHint[]; mfaCode: string | null } {
  return { accounts: DEMO_ACCOUNTS.map((a) => ({ ...a })), mfaCode: DEMO_MFA_CODE };
}

/** Dev helper: discard all session data and reload fixtures. Phase 2: no-op. */
export function resetDemoData(): void {
  sessionStorageAdapter()?.clear();
  instance = null;
}
