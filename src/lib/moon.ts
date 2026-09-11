/**
 * Moon phase, computed offline from the mean synodic cycle.
 *
 * Accurate to a few hours, which is all a wall board needs — it is displayed as
 * a named phase and an illumination percentage, not a sighting prediction.
 */

/** Julian date (with fraction) for an instant. */
export function julianDateFromInstant(date: Date): number {
  return date.getTime() / 86400000 + 2440587.5;
}

const SYNODIC_MONTH = 29.530588853;
/** A known new moon: 2000-01-06 18:14 UTC. */
const REFERENCE_NEW_MOON = 2451550.1;

export type MoonPhaseName =
  | 'New Moon'
  | 'Waxing Crescent'
  | 'First Quarter'
  | 'Waxing Gibbous'
  | 'Full Moon'
  | 'Waning Gibbous'
  | 'Last Quarter'
  | 'Waning Crescent';

export interface MoonPhase {
  /** 0 at new moon, 0.5 at full, approaching 1 back at new. */
  fraction: number;
  /** Lit fraction of the disc, 0-1. */
  illumination: number;
  /** Days since the last new moon. */
  ageDays: number;
  name: MoonPhaseName;
  waxing: boolean;
}

export function moonPhase(date: Date): MoonPhase {
  const jd = julianDateFromInstant(date);
  const cycles = (jd - REFERENCE_NEW_MOON) / SYNODIC_MONTH;
  let fraction = cycles - Math.floor(cycles);
  if (fraction < 0) fraction += 1;

  const ageDays = fraction * SYNODIC_MONTH;
  const illumination = (1 - Math.cos(2 * Math.PI * fraction)) / 2;
  const waxing = fraction < 0.5;

  return { fraction, illumination, ageDays, name: phaseName(fraction), waxing };
}

function phaseName(fraction: number): MoonPhaseName {
  // Each named quarter-point gets a narrow window; the rest are crescents/gibbous.
  const eighth = 1 / 8;
  const half = eighth / 2;
  if (fraction < half || fraction >= 1 - half) return 'New Moon';
  if (fraction < eighth * 2 - half) return 'Waxing Crescent';
  if (fraction < eighth * 2 + half) return 'First Quarter';
  if (fraction < eighth * 4 - half) return 'Waxing Gibbous';
  if (fraction < eighth * 4 + half) return 'Full Moon';
  if (fraction < eighth * 6 - half) return 'Waning Gibbous';
  if (fraction < eighth * 6 + half) return 'Last Quarter';
  return 'Waning Crescent';
}

/** Date of the next new moon after the given instant. */
export function nextNewMoon(date: Date): Date {
  const jd = julianDateFromInstant(date);
  const cycles = (jd - REFERENCE_NEW_MOON) / SYNODIC_MONTH;
  const nextJd = REFERENCE_NEW_MOON + Math.ceil(cycles) * SYNODIC_MONTH;
  return new Date((nextJd - 2440587.5) * 86400000);
}

/**
 * SVG path data for the moon's terminator, drawn inside a circle of the given
 * radius centred on (0, 0). Returns the path for the *lit* portion.
 */
export function moonTerminatorPath(fraction: number, radius: number): string {
  // The terminator is an ellipse whose semi-minor axis tracks the phase.
  const curveWidth = Math.abs(Math.cos(2 * Math.PI * fraction)) * radius;
  const waxing = fraction < 0.5;
  const gibbous = fraction > 0.25 && fraction < 0.75;

  // Outer half-circle on the lit side, then the terminator arc back to the top.
  const outerSweep = waxing ? 1 : 0;
  const innerSweep = gibbous ? (waxing ? 1 : 0) : waxing ? 0 : 1;

  return [
    `M 0 ${-radius}`,
    `A ${radius} ${radius} 0 0 ${outerSweep} 0 ${radius}`,
    `A ${curveWidth} ${radius} 0 0 ${innerSweep} 0 ${-radius}`,
    'Z',
  ].join(' ');
}
