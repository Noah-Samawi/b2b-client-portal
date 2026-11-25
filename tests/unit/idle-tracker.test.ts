import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createIdleTracker } from "@/lib/session/idle-tracker";
import { IDLE_TIMEOUT_MS, IDLE_WARNING_MS } from "@/lib/session/config";

describe("idle tracker", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("uses 25/30 minutes", () => {
    expect(IDLE_WARNING_MS).toBe(25 * 60_000);
    expect(IDLE_TIMEOUT_MS).toBe(30 * 60_000);
  });

  it("warns after 25 minutes and times out after 30", () => {
    const onWarn = vi.fn();
    const onTimeout = vi.fn();
    createIdleTracker({ warnAfterMs: IDLE_WARNING_MS, timeoutAfterMs: IDLE_TIMEOUT_MS, onWarn, onTimeout, now: () => Date.now() });
    vi.advanceTimersByTime(IDLE_WARNING_MS - 1);
    expect(onWarn).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(onWarn).toHaveBeenCalledWith(5 * 60_000);
    vi.advanceTimersByTime(5 * 60_000);
    expect(onTimeout).toHaveBeenCalledOnce();
  });

  it("activity resets the timer, but not while the warning is shown", () => {
    const onWarn = vi.fn();
    const onTimeout = vi.fn();
    const t = createIdleTracker({ warnAfterMs: 1000, timeoutAfterMs: 2000, onWarn, onTimeout, now: () => Date.now() });
    vi.advanceTimersByTime(900);
    t.activity();
    vi.advanceTimersByTime(900);
    expect(onWarn).not.toHaveBeenCalled();
    vi.advanceTimersByTime(200);
    expect(t.isWarning()).toBe(true);
    t.activity(); // passive activity must not dismiss the warning
    vi.advanceTimersByTime(1000);
    expect(onTimeout).toHaveBeenCalledOnce();
  });

  it("stayActive dismisses the warning and restarts the timer", () => {
    const onTimeout = vi.fn();
    const t = createIdleTracker({ warnAfterMs: 1000, timeoutAfterMs: 2000, onWarn: () => {}, onTimeout, now: () => Date.now() });
    vi.advanceTimersByTime(1500);
    t.stayActive();
    expect(t.isWarning()).toBe(false);
    vi.advanceTimersByTime(1900);
    expect(onTimeout).not.toHaveBeenCalled();
    vi.advanceTimersByTime(100);
    expect(onTimeout).toHaveBeenCalledOnce();
  });
});
