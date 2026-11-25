"use client";

import * as React from "react";
import { toPortalError, type PortalError } from "@/lib/data";
import { useSession } from "@/features/auth/session-context";
import { useToast } from "@/components/toast";
import { de } from "@/i18n/de";

/** Maps a PortalError to a German message. Field errors are handled by forms. */
export function errorMessage(err: PortalError): string {
  return de.errors.codes[err.code] ?? de.errors.codes.UNKNOWN;
}

/**
 * Central error handler: session problems end the session, everything else becomes a toast.
 * Returns the normalised error so callers can read field errors.
 */
export function useErrorHandler() {
  const { signOut } = useSession();
  const toast = useToast();
  return React.useCallback(
    (raw: unknown, opts: { silent?: boolean } = {}): PortalError => {
      const err = toPortalError(raw);
      if (err.code === "SESSION_EXPIRED" || err.code === "UNAUTHENTICATED" || err.code === "MFA_REQUIRED") {
        void signOut("expired");
        return err;
      }
      if (!opts.silent) toast.error(errorMessage(err));
      return err;
    },
    [signOut, toast],
  );
}

export interface LoadState<T> {
  data: T | undefined;
  error: PortalError | undefined;
  loading: boolean;
  /** Re-runs the loader without resetting data (silent refresh). */
  reload: () => Promise<void>;
  setData: (update: (prev: T | undefined) => T | undefined) => void;
}

interface Snapshot<T> {
  key: string;
  data: T | undefined;
  error: PortalError | undefined;
  settled: boolean;
}

/**
 * Minimal async loader bound to the data source.
 * `key` identifies the request; when it changes, the loader runs again.
 */
export function useLoad<T>(key: string, fn: () => Promise<T>): LoadState<T> {
  const handleError = useErrorHandler();
  const fnRef = React.useRef(fn);
  const keyRef = React.useRef(key);
  React.useEffect(() => {
    fnRef.current = fn;
    keyRef.current = key;
  });
  const [snap, setSnap] = React.useState<Snapshot<T>>({ key, data: undefined, error: undefined, settled: false });

  const run = React.useCallback(
    async (forKey: string) => {
      try {
        const data = await fnRef.current();
        setSnap((s) => (keyRef.current === forKey ? { key: forKey, data, error: undefined, settled: true } : s));
      } catch (e) {
        const error = handleError(e, { silent: true });
        setSnap((s) => (keyRef.current === forKey ? { key: forKey, data: s.key === forKey ? s.data : undefined, error, settled: true } : s));
      }
    },
    [handleError],
  );

  React.useEffect(() => {
    void run(key);
  }, [key, run]);

  const reload = React.useCallback(() => run(keyRef.current), [run]);
  const setData = React.useCallback(
    (update: (prev: T | undefined) => T | undefined) => setSnap((s) => ({ ...s, data: update(s.data) })),
    [],
  );

  const current = snap.key === key;
  return {
    data: current ? snap.data : undefined,
    error: current ? snap.error : undefined,
    loading: !current || !snap.settled,
    reload,
    setData,
  };
}
