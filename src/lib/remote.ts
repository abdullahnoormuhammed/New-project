/**
 * Shared settings, so the committee can edit from a phone and the screen on the
 * wall follows.
 *
 * The design rule here is that **the board must never depend on the network to
 * keep working**. The last known settings are always cached on the device, the
 * board renders from that cache immediately, and the network fetch is a
 * background refresh. If the internet is down — or was never there — the screen
 * carries on showing correct times indefinitely.
 *
 * There is deliberately no realtime websocket and no Supabase client library.
 * A plain polled fetch is far more robust on the sort of browser a TV ships
 * with, and a notice board does not need sub-second propagation.
 */

export interface RemoteSettings {
  /** Supabase project URL, e.g. https://abcd.supabase.co */
  url: string;
  /** The project's publishable ("anon") key. Safe to ship — it grants nothing on its own. */
  anonKey: string;
  /** Which board's settings to load. One deployment can serve several masjids. */
  slug: string;
}

export interface RemoteConfigRecord {
  config: unknown;
  updatedAt: string;
}

const EDIT_KEY_STORAGE = 'masjid-board:edit-key';

/**
 * Where the connection details come from, in order:
 *   1. the URL — `?board=slug`, so one deployment can serve several masjids
 *   2. build-time environment variables baked in at deploy
 *
 * Returns null when nothing is configured, which is a supported mode: the board
 * then runs entirely on its own device, exactly as it did before sync existed.
 */
export function resolveRemoteSettings(): RemoteSettings | null {
  const env = import.meta.env;
  const url = String(env.VITE_SUPABASE_URL ?? '').trim().replace(/\/+$/, '');
  const anonKey = String(env.VITE_SUPABASE_ANON_KEY ?? '').trim();
  if (!url || !anonKey) return null;

  const fromUrl = new URLSearchParams(window.location.search).get('board');
  const slug = (fromUrl ?? String(env.VITE_BOARD_SLUG ?? '')).trim();
  if (!slug) return null;

  return { url, anonKey, slug };
}

/** True when this deployment has shared settings wired up. */
export function isRemoteConfigured(): boolean {
  return resolveRemoteSettings() !== null;
}

// --- the edit key -------------------------------------------------------------

/**
 * Pulls the write credential out of the editor's link (`#admin&k=…`) and strips
 * it from the address bar, so it does not sit in a screenshot or get pasted on
 * with the rest of the URL.
 *
 * The fragment is used rather than a query string because fragments are never
 * sent to the server and so never land in server logs.
 *
 * Note that this does **not** store the key. A key off a URL is only a
 * candidate until the database has confirmed it — otherwise a mistyped or stale
 * link would look like working access, and edits would appear to save while
 * never reaching the screens.
 */
export function captureEditKeyFromUrl(): string | null {
  const hash = window.location.hash.replace(/^#/, '');
  if (!hash) return null;

  const params = new URLSearchParams(hash.includes('&') ? hash.slice(hash.indexOf('&') + 1) : '');
  const key = params.get('k');
  if (!key) return null;

  // Keep the #admin route, drop the secret.
  history.replaceState(null, '', `${window.location.pathname}${window.location.search}#admin`);
  return key.trim();
}

export function storeEditKey(key: string): void {
  try {
    localStorage.setItem(EDIT_KEY_STORAGE, key.trim());
  } catch {
    /* private browsing — the key will have to be entered again next time */
  }
}

export function readEditKey(): string | null {
  try {
    return localStorage.getItem(EDIT_KEY_STORAGE);
  } catch {
    return null;
  }
}

export function clearEditKey(): void {
  try {
    localStorage.removeItem(EDIT_KEY_STORAGE);
  } catch {
    /* nothing useful to do */
  }
}

// --- reading and writing ------------------------------------------------------

function rpcUrl(settings: RemoteSettings, fn: string): string {
  return `${settings.url}/rest/v1/rpc/${fn}`;
}

function headers(settings: RemoteSettings): HeadersInit {
  return {
    'Content-Type': 'application/json',
    apikey: settings.anonKey,
    Authorization: `Bearer ${settings.anonKey}`,
  };
}

export class RemoteError extends Error {
  constructor(
    message: string,
    readonly status?: number,
  ) {
    super(message);
    this.name = 'RemoteError';
  }
}

/** Fetch the shared settings. Returns null when the board row does not exist yet. */
export async function fetchRemoteConfig(
  settings: RemoteSettings,
  signal?: AbortSignal,
): Promise<RemoteConfigRecord | null> {
  const response = await fetch(rpcUrl(settings, 'board_read'), {
    method: 'POST',
    headers: headers(settings),
    body: JSON.stringify({ p_slug: settings.slug }),
    signal,
    cache: 'no-store',
  });

  if (!response.ok) {
    throw new RemoteError(`Could not read the shared settings (${response.status}).`, response.status);
  }

  const rows = (await response.json()) as Array<{ config: unknown; updated_at: string }>;
  if (!Array.isArray(rows) || rows.length === 0) return null;
  return { config: rows[0].config, updatedAt: rows[0].updated_at };
}

/**
 * Push settings to every screen. Rejects when the edit key is wrong — the check
 * happens in the database, so a wrong key can never write.
 */
export async function pushRemoteConfig(
  settings: RemoteSettings,
  editKey: string,
  config: unknown,
): Promise<string> {
  const response = await fetch(rpcUrl(settings, 'board_write'), {
    method: 'POST',
    headers: headers(settings),
    body: JSON.stringify({ p_slug: settings.slug, p_token: editKey, p_config: config }),
  });

  if (response.status === 403 || response.status === 401) {
    throw new RemoteError('That edit key is not accepted for this board.', response.status);
  }
  if (!response.ok) {
    const body = await response.text().catch(() => '');
    // The database raises insufficient_privilege for a bad key or unknown board.
    if (/42501|invalid board or edit key/i.test(body)) {
      throw new RemoteError('That edit key is not accepted for this board.', 403);
    }
    throw new RemoteError(`Could not save to the screens (${response.status}).`, response.status);
  }

  const updatedAt = (await response.json()) as string;
  return updatedAt;
}

/** Confirms an edit key without changing anything, for the "connect" screen. */
export async function verifyEditKey(settings: RemoteSettings, editKey: string): Promise<boolean> {
  const response = await fetch(rpcUrl(settings, 'board_check_key'), {
    method: 'POST',
    headers: headers(settings),
    body: JSON.stringify({ p_slug: settings.slug, p_token: editKey }),
  });
  if (!response.ok) return false;
  return (await response.json()) === true;
}

/** The editor's shareable link, for the panel to display. */
export function buildEditorLink(editKey: string): string {
  const base = `${window.location.origin}${window.location.pathname}`;
  const board = new URLSearchParams(window.location.search).get('board');
  const query = board ? `?board=${encodeURIComponent(board)}` : '';
  return `${base}${query}#admin&k=${encodeURIComponent(editKey)}`;
}

/** How often the board asks for fresh settings, in milliseconds. */
export const POLL_INTERVAL_MS = 20000;
