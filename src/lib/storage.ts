/**
 * Config persistence. The board is designed to run unattended on a TV, so the
 * rule here is "never lose the screen": a corrupt or partial stored config
 * falls back to the defaults rather than throwing.
 */

import { CONFIG_VERSION, DEFAULT_CONFIG, cloneConfig, type MasjidConfig } from './config.ts';

const STORAGE_KEY = 'masjid-board:config:v1';

type Plain = Record<string, unknown>;

const isPlainObject = (value: unknown): value is Plain =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

/**
 * Merge stored values over the defaults so a config saved by an older build
 * still gains any newly added fields. Arrays are replaced wholesale — they are
 * content lists, and merging them element-wise would resurrect deleted rows.
 */
export function mergeConfig(base: unknown, patch: unknown): unknown {
  if (!isPlainObject(base) || !isPlainObject(patch)) {
    return patch === undefined ? base : patch;
  }
  const result: Plain = { ...base };
  for (const [key, value] of Object.entries(patch)) {
    if (value === undefined) continue;
    result[key] = key in base ? mergeConfig(base[key], value) : value;
  }
  return result;
}

export function loadConfig(): MasjidConfig {
  if (typeof localStorage === 'undefined') return cloneConfig(DEFAULT_CONFIG);
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return cloneConfig(DEFAULT_CONFIG);
    const parsed = JSON.parse(raw);
    return normalizeConfig(parsed);
  } catch (error) {
    console.warn('[masjid-board] stored config could not be read, using defaults', error);
    return cloneConfig(DEFAULT_CONFIG);
  }
}

export function saveConfig(config: MasjidConfig): boolean {
  if (typeof localStorage === 'undefined') return false;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
    return true;
  } catch (error) {
    console.warn('[masjid-board] config could not be saved', error);
    return false;
  }
}

export function clearConfig(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* nothing useful to do on a locked-down kiosk browser */
  }
}

/** Coerce arbitrary parsed JSON into a usable config. */
export function normalizeConfig(input: unknown): MasjidConfig {
  const merged = mergeConfig(cloneConfig(DEFAULT_CONFIG), input) as MasjidConfig;
  merged.version = CONFIG_VERSION;

  // Guard the few fields that would break rendering outright if malformed.
  if (!Array.isArray(merged.slides) || merged.slides.length === 0) {
    merged.slides = cloneConfig(DEFAULT_CONFIG.slides);
  }
  for (const list of ['announcements', 'events', 'janazah', 'appeals', 'quotes', 'classes'] as const) {
    if (!Array.isArray(merged[list])) {
      (merged[list] as unknown[]) = [];
    }
  }
  if (!Array.isArray(merged.overrides)) merged.overrides = [];
  if (!Array.isArray(merged.display.tickerMessages)) merged.display.tickerMessages = [];

  merged.location.latitude = clampNumber(merged.location.latitude, -90, 90, 0);
  merged.location.longitude = clampNumber(merged.location.longitude, -180, 180, 0);
  merged.location.elevation = clampNumber(merged.location.elevation, -500, 9000, 0);
  merged.display.defaultSlideSeconds = clampNumber(merged.display.defaultSlideSeconds, 5, 600, 20);

  return merged;
}

function clampNumber(value: unknown, min: number, max: number, fallback: number): number {
  const num = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(num)) return fallback;
  return Math.min(max, Math.max(min, num));
}

export function exportConfig(config: MasjidConfig): string {
  return JSON.stringify(config, null, 2);
}

export interface ImportResult {
  ok: boolean;
  config?: MasjidConfig;
  error?: string;
}

export function importConfig(json: string): ImportResult {
  try {
    const parsed = JSON.parse(json);
    if (!isPlainObject(parsed)) return { ok: false, error: 'The file is not a config object.' };
    return { ok: true, config: normalizeConfig(parsed) };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : 'Could not parse the file.' };
  }
}
