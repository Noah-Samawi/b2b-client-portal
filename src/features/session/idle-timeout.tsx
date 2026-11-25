"use client";

import * as React from "react";
import { getDataSource } from "@/lib/data";
import { createIdleTracker, type IdleTracker } from "@/lib/session/idle-tracker";
import { ACTIVITY_HEARTBEAT_MS, IDLE_TIMEOUT_MS, IDLE_WARNING_MS } from "@/lib/session/config";
import { useSession } from "@/features/auth/session-context";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { de } from "@/i18n/de";

const ACTIVITY_EVENTS = ["pointerdown", "keydown", "wheel", "touchstart", "scroll", "mousemove"] as const;

/**
 * Browser-side idle handling (same policy for admins and clients).
 * The data source independently rejects calls after the timeout (Phase 2: server-side check),
 * so closing the tab or disabling JavaScript cannot extend a session.
 */
export function IdleTimeout({ warnAfterMs = IDLE_WARNING_MS, timeoutAfterMs = IDLE_TIMEOUT_MS }: { warnAfterMs?: number; timeoutAfterMs?: number }) {
  const { signOut } = useSession();
  const [warning, setWarning] = React.useState(false);
  const [remaining, setRemaining] = React.useState(0);
  const tracker = React.useRef<IdleTracker | null>(null);
  const lastBeat = React.useRef(0);

  React.useEffect(() => {
    const heartbeat = () => {
      const now = Date.now();
      if (now - lastBeat.current < ACTIVITY_HEARTBEAT_MS) return;
      lastBeat.current = now;
      getDataSource()
        .touchSession()
        .catch(() => void signOut("expired"));
    };
    const t = createIdleTracker({
      warnAfterMs,
      timeoutAfterMs,
      onWarn: () => setWarning(true),
      onTimeout: () => {
        setWarning(false);
        void signOut("idle");
      },
      onActivity: heartbeat,
    });
    tracker.current = t;
    const onActivity = () => t.activity();
    for (const ev of ACTIVITY_EVENTS) window.addEventListener(ev, onActivity, { passive: true });
    return () => {
      t.stop();
      for (const ev of ACTIVITY_EVENTS) window.removeEventListener(ev, onActivity);
    };
  }, [warnAfterMs, timeoutAfterMs, signOut]);

  React.useEffect(() => {
    if (!warning) return;
    const tick = () => setRemaining(Math.ceil((tracker.current?.remainingMs() ?? 0) / 1000));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [warning]);

  function stay() {
    lastBeat.current = 0; // force a heartbeat so the data source records the activity
    tracker.current?.stayActive();
    setWarning(false);
  }

  return (
    <Dialog open={warning} onOpenChange={(o) => !o && stay()}>
      <DialogContent role="alertdialog" hideClose data-testid="idle-warning">
        <DialogHeader>
          <DialogTitle>{de.session.warningTitle}</DialogTitle>
          <DialogDescription aria-live="polite">{de.session.warningText(remaining)}</DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={() => void signOut("signedOut")}>
            {de.session.logoutNow}
          </Button>
          <Button onClick={stay} autoFocus>
            {de.session.stay}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
