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
