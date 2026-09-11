/**
 * The salaah state machine.
 *
 * Around each prayer the board stops rotating slides and takes over the screen:
 *
 *   idle → approaching → adhaan → awaitingJamaat → salaah → idle
 *
 * `approaching` opens `preAdhaanMinutes` before the adhaan, `adhaan` holds for
 * `adhaanHoldMinutes`, `awaitingJamaat` counts down to the iqamah, and `salaah`
 * covers the congregation itself.
 */

import type { AlertsConfig } from './config.ts';
import type { DaySchedule, ResolvedPrayer } from './schedule.ts';
import { findNextPrayer } from './schedule.ts';
import { MINUTES_PER_DAY } from './time.ts';

export type PrayerPhase = 'idle' | 'approaching' | 'adhaan' | 'awaitingJamaat' | 'salaah';

export interface PrayerState {
  phase: PrayerPhase;
  /** The prayer the phase relates to; null when idle. */
  prayer: ResolvedPrayer | null;
  /** Seconds until the phase's target moment (adhaan, jamaat, or the end). */
  secondsRemaining: number;
  /** True whenever the board should suppress normal slide rotation. */
  takeover: boolean;
}

export interface PrayerStateInput {
  today: DaySchedule;
  tomorrow: DaySchedule;
  /** Minutes from midnight, fractional — pass seconds precision for a live countdown. */
  nowMinutes: number;
  alerts: AlertsConfig;
}

const IDLE: PrayerState = { phase: 'idle', prayer: null, secondsRemaining: 0, takeover: false };

export function resolvePrayerState(input: PrayerStateInput): PrayerState {
  const { today, tomorrow, nowMinutes, alerts } = input;
  if (!alerts.enabled) return IDLE;

  // Look at every prayer whose window could plausibly contain "now": today's
  // full set, plus tomorrow's Fajr for the minutes just before midnight.
  const candidates: Array<{ prayer: ResolvedPrayer; adhaan: number; jamaat: number }> = [
    ...today.prayers.map((p) => ({ prayer: p, adhaan: p.adhaan, jamaat: p.jamaat })),
    ...tomorrow.prayers.map((p) => ({
      prayer: p,
      adhaan: p.adhaan + MINUTES_PER_DAY,
      jamaat: p.jamaat + MINUTES_PER_DAY,
    })),
    // Yesterday's Isha can still be "in salaah" just after midnight.
    ...today.prayers.map((p) => ({
      prayer: p,
      adhaan: p.adhaan - MINUTES_PER_DAY,
      jamaat: p.jamaat - MINUTES_PER_DAY,
    })),
  ];

  for (const candidate of candidates) {
    const state = phaseFor(candidate.prayer, candidate.adhaan, candidate.jamaat, nowMinutes, alerts);
    if (state) return state;
  }

  return IDLE;
}

function phaseFor(
  prayer: ResolvedPrayer,
  adhaan: number,
  jamaat: number,
  nowMinutes: number,
  alerts: AlertsConfig,
): PrayerState | null {
  const toSeconds = (minutes: number) => Math.max(0, Math.round(minutes * 60));

  const preStart = adhaan - alerts.preAdhaanMinutes;
  const adhaanEnd = adhaan + alerts.adhaanHoldMinutes;
  const salaahEnd = jamaat + (alerts.salaahInProgressMinutes[prayer.key] ?? 12);

  if (nowMinutes < preStart || nowMinutes >= salaahEnd) return null;

  if (nowMinutes < adhaan) {
    return {
      phase: 'approaching',
      prayer,
      secondsRemaining: toSeconds(adhaan - nowMinutes),
      // The pre-adhaan notice is a banner over the normal slides, not a takeover.
      takeover: false,
    };
  }

  if (nowMinutes < Math.min(adhaanEnd, jamaat)) {
    return {
      phase: 'adhaan',
      prayer,
      secondsRemaining: toSeconds(Math.min(adhaanEnd, jamaat) - nowMinutes),
      takeover: true,
    };
  }

  if (nowMinutes < jamaat) {
    return {
      phase: 'awaitingJamaat',
      prayer,
      secondsRemaining: toSeconds(jamaat - nowMinutes),
      takeover: alerts.showIqamahCountdown,
    };
  }

  return {
    phase: 'salaah',
    prayer,
    secondsRemaining: toSeconds(salaahEnd - nowMinutes),
    takeover: true,
  };
}

/** Seconds until the next jamaat, for the countdown strip. */
export function secondsToNextJamaat(
  today: DaySchedule,
  tomorrow: DaySchedule,
  nowMinutes: number,
): { prayer: ResolvedPrayer; seconds: number; tomorrow: boolean } {
  const pointer = findNextPrayer(today, tomorrow, nowMinutes);
  return {
    prayer: pointer.prayer,
    seconds: Math.max(0, Math.round((pointer.jamaatAt - nowMinutes) * 60)),
    tomorrow: pointer.tomorrow,
  };
}
