/**
 * The staff id, read from the stored session.
 *
 * Privileged edge functions now verify the caller server-side, so every mutating call has
 * to carry this. One helper rather than four copies of a try/catch around
 * JSON.parse(localStorage...) — four copies is how one of them silently returns '' and a
 * feature 401s for reasons nobody can find.
 */
export function currentStaffId(): string {
  try {
    return JSON.parse(localStorage.getItem('staffSession') || '{}')?.id || '';
  } catch {
    return '';
  }
}

// staff-login issues a 12-hour token, and signing in on another device replaces it.
const STAFF_SESSION_HOURS = 12;

/**
 * Whether the stored staff session can still be used. The login page used to send anyone
 * holding any stored session straight to the workspace. Once the token expired, the
 * workspace said "sign out and sign in again", offered no way to sign out, and the login
 * page sent them back: a loop that only clearing the browser could break.
 */
export function hasLiveStaffSession(): boolean {
  try {
    const s = JSON.parse(localStorage.getItem('staffSession') || 'null');
    if (!s?.id || !s?.session_token) return false;
    const expires = s.session_expires
      ? new Date(s.session_expires).getTime()
      : Number(s.loginTime || 0) + STAFF_SESSION_HOURS * 60 * 60 * 1000;
    return Number.isFinite(expires) && expires > Date.now();
  } catch {
    return false;
  }
}

/** Forget the stored staff session on this device. */
export function clearStaffSession(): void {
  try { localStorage.removeItem('staffSession'); } catch { /* storage blocked */ }
}
