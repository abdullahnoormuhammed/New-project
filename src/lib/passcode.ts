/**
 * The admin passcode.
 *
 * What this protects against: someone who wanders up to the screen, or picks up
 * the remote, finding their way into the settings. That is the realistic threat
 * for a board on a masjid wall, and a passcode handles it.
 *
 * What it does not protect against: anyone who can open developer tools on the
 * device itself. The whole configuration lives in that browser's storage, so it
 * is readable there no matter what this file does. Treat the passcode as a lock
 * on a cupboard door, not a safe.
 */

const UNLOCK_KEY = 'masjid-board:unlocked';

/** SHA-256, hex encoded. */
export async function hashPasscode(passcode: string): Promise<string> {
  const normalized = passcode.trim();
  const bytes = new TextEncoder().encode(`masjid-board:${normalized}`);
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

/** Constant-time-ish comparison. Both values are fixed-length hex digests. */
function digestsMatch(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i += 1) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}

export async function checkPasscode(passcode: string, storedHash: string): Promise<boolean> {
  return digestsMatch(await hashPasscode(passcode), storedHash);
}

export function isValidPasscode(passcode: string): boolean {
  return passcode.trim().length >= 4;
}

/**
 * The unlock is remembered for the browser session only, so a refresh part-way
 * through editing does not ask again, but closing the browser re-locks.
 */
export function rememberUnlock(): void {
  try {
    sessionStorage.setItem(UNLOCK_KEY, '1');
  } catch {
    /* private browsing — the panel simply asks again next time */
  }
}

export function isUnlocked(): boolean {
  try {
    return sessionStorage.getItem(UNLOCK_KEY) === '1';
  } catch {
    return false;
  }
}

export function forgetUnlock(): void {
  try {
    sessionStorage.removeItem(UNLOCK_KEY);
  } catch {
    /* nothing useful to do */
  }
}
