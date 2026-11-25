/**
 * Framework-free idle tracker. The UI layer wires DOM activity events into `activity()`.
 * Warning fires after `warnAfterMs`, timeout after `timeoutAfterMs` (both measured from the last activity).
 * While the warning is shown, passive activity is ignored – only `stayActive()` resets the timer,
 * so a moving mouse cannot silently dismiss the warning.
 */
export interface IdleTrackerOptions {
  warnAfterMs: number;
  timeoutAfterMs: number;
  onWarn: (remainingMs: number) => void;
  onTimeout: () => void;
  onActivity?: () => void;
  now?: () => number;
}

export interface IdleTracker {
  activity(): void;
  stayActive(): void;
  remainingMs(): number;
  isWarning(): boolean;
  stop(): void;
}

export function createIdleTracker(opts: IdleTrackerOptions): IdleTracker {
  const now = opts.now ?? (() => Date.now());
  let last = now();
  let warning = false;
  let stopped = false;
  let warnTimer: ReturnType<typeof setTimeout> | undefined;
  let timeoutTimer: ReturnType<typeof setTimeout> | undefined;

  const clear = () => {
    if (warnTimer) clearTimeout(warnTimer);
    if (timeoutTimer) clearTimeout(timeoutTimer);
  };

  const schedule = () => {
    clear();
    if (stopped) return;
    warnTimer = setTimeout(() => {
      warning = true;
      opts.onWarn(opts.timeoutAfterMs - opts.warnAfterMs);
    }, opts.warnAfterMs);
    timeoutTimer = setTimeout(() => {
      stopped = true;
      clear();
      opts.onTimeout();
    }, opts.timeoutAfterMs);
  };

  const reset = () => {
    last = now();
    warning = false;
    schedule();
    opts.onActivity?.();
  };

  schedule();

  return {
    activity() {
      if (stopped || warning) return;
      reset();
    },
    stayActive() {
      if (stopped) return;
      reset();
    },
    remainingMs() {
      return Math.max(0, opts.timeoutAfterMs - (now() - last));
    },
    isWarning() {
      return warning;
    },
    stop() {
      stopped = true;
      clear();
    },
  };
}
