/** Idle-timeout policy. Applies identically to admin and client sessions. */
export const IDLE_WARNING_MS = 25 * 60 * 1000; // warning dialog after 25 minutes
export const IDLE_TIMEOUT_MS = 30 * 60 * 1000; // sign-out after 30 minutes

/** How often user activity is reported to the data source at most (heartbeat throttle). */
export const ACTIVITY_HEARTBEAT_MS = 60 * 1000;
