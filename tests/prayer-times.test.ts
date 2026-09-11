import test from 'node:test';
import assert from 'node:assert/strict';

import {
  computePrayerTimes,
  distanceToKaaba,
  getMethod,
  julianDay,
  qiblaDirection,
  sunPosition,
  zawaalWindow,
  type CalculationParams,
} from '../src/lib/prayer-times.ts';
import { formatClock } from '../src/lib/time.ts';

/** Durban, South Africa — the location on the board this project was modelled on. */
const DURBAN = { latitude: -29.7833, longitude: 31.0167, elevation: 20 };

function params(overrides: Partial<CalculationParams> = {}): CalculationParams {
  return {
    ...getMethod('SouthAfrica').params,
    imsakParam: { type: 'minutes', value: 10 },
    asrJuristic: 'hanafi',
    highLatitudeRule: 'none',
    ...overrides,
  };
}

const hhmm = (minutes: number) => formatClock(minutes, { hour12: false, padHour: true });

/** Difference in whole minutes between a computed time and an "HH:MM" string. */
function minutesApart(computed: number, expected: string): number {
  const [h, m] = expected.split(':').map(Number);
  return Math.abs(computed - (h * 60 + m));
}

test('julian day matches the known epoch', () => {
  // 2000-01-01 12:00 UT is JD 2451545.0, so midnight that day is 2451544.5.
  assert.equal(julianDay(2000, 1, 1), 2451544.5);
});

test('sun position agrees with NOAA for a reference date', () => {
  // 2026-08-20, at the meridian of Durban. NOAA gives declination 12.34°,
  // equation of time -3.40 minutes.
  const jd = julianDay(2026, 8, 20) - DURBAN.longitude / (15 * 24) + 0.5;
  const position = sunPosition(jd);
  assert.ok(Math.abs(position.declination - 12.34) < 0.1, `declination ${position.declination}`);
  assert.ok(
    Math.abs(position.equationOfTime * 60 - -3.4) < 0.3,
    `equation of time ${position.equationOfTime * 60}`,
  );
});

test('sunrise, noon and sunset match NOAA for Durban', () => {
  const times = computePrayerTimes(new Date(2026, 7, 20), {
    location: DURBAN,
    params: params(),
    utcOffset: 2,
  });

  // NOAA: rise 06:24, solar noon 11:59, set 17:35.
  assert.ok(minutesApart(times.sunrise, '06:24') <= 1, `sunrise ${hhmm(times.sunrise)}`);
  assert.ok(minutesApart(times.zawaal, '11:59') <= 1, `zawaal ${hhmm(times.zawaal)}`);
  assert.ok(minutesApart(times.sunset, '17:35') <= 1, `sunset ${hhmm(times.sunset)}`);
});

test('the zawaal window brackets solar noon', () => {
  const times = computePrayerTimes(new Date(2026, 7, 20), {
    location: DURBAN,
    params: params(),
    utcOffset: 2,
  });
  const window = zawaalWindow(times);
  assert.ok(window.start < times.zawaal && times.zawaal < window.end);
  assert.equal(Math.round(window.end - window.start), 4);
});

test('Asr Hanafi always falls after Asr Shafi‘i, and both before sunset', () => {
  for (const month of [0, 3, 6, 9]) {
    const times = computePrayerTimes(new Date(2026, month, 15), {
      location: DURBAN,
      params: params(),
      utcOffset: 2,
    });
    assert.ok(times.asr < times.asrHanafi, `month ${month}: shafi ${hhmm(times.asr)}`);
    assert.ok(times.asrHanafi < times.sunset, `month ${month}: hanafi ${hhmm(times.asrHanafi)}`);
    assert.ok(times.dhuhr < times.asr);
  }
});

test('the day runs in order, every month of the year', () => {
  for (let month = 0; month < 12; month += 1) {
    const times = computePrayerTimes(new Date(2026, month, 15), {
      location: DURBAN,
      params: params(),
      utcOffset: 2,
    });
    const ordered = [
      times.imsak,
      times.fajr,
      times.sunrise,
      times.ishraaq,
      times.zawaal,
      times.dhuhr,
      times.asr,
      times.sunset,
      times.maghrib,
      times.isha,
    ];
    for (let i = 1; i < ordered.length; i += 1) {
      assert.ok(
        ordered[i] >= ordered[i - 1],
        `month ${month}: index ${i} (${hhmm(ordered[i])}) precedes ${hhmm(ordered[i - 1])}`,
      );
    }
  }
});

test('day length at the equator on an equinox is about twelve hours', () => {
  const times = computePrayerTimes(new Date(2026, 2, 20), {
    location: { latitude: 0, longitude: 0, elevation: 0 },
    params: params(),
    utcOffset: 0,
  });
  const dayLength = times.sunset - times.sunrise;
  assert.ok(Math.abs(dayLength - 720) < 10, `day length ${dayLength} minutes`);
});

test('an interval-based Isha hangs off Maghrib', () => {
  const times = computePrayerTimes(new Date(2026, 7, 20), {
    location: DURBAN,
    params: params({ ishaParam: { type: 'minutes', value: 90 } }),
    utcOffset: 2,
  });
  assert.equal(Math.round(times.isha - times.maghrib), 90);
});

test('high latitudes produce usable times rather than NaN', () => {
  // London in June: the sun sets, but never dips to 18° below the horizon, so
  // Fajr and Isha have no true solution and the fallback rules must take over.
  const location = { latitude: 51.5074, longitude: -0.1278, elevation: 0 };
  const midsummer = new Date(2026, 5, 21);

  const unguarded = computePrayerTimes(midsummer, {
    location,
    params: params({ highLatitudeRule: 'none' }),
    utcOffset: 2,
  });
  assert.ok(Number.isNaN(unguarded.fajr), 'without a rule, Fajr is genuinely undefined');

  for (const rule of ['middleOfNight', 'seventhOfNight', 'angleBased'] as const) {
    const guarded = computePrayerTimes(midsummer, {
      location,
      params: params({ highLatitudeRule: rule }),
      utcOffset: 2,
    });
    assert.ok(Number.isFinite(guarded.fajr), `${rule}: Fajr is ${guarded.fajr}`);
    assert.ok(Number.isFinite(guarded.isha), `${rule}: Isha is ${guarded.isha}`);
    assert.ok(guarded.fajr < guarded.sunrise, `${rule}: Fajr must precede sunrise`);
  }
});

test('per-prayer adjustments shift the calculated time', () => {
  const base = computePrayerTimes(new Date(2026, 7, 20), {
    location: DURBAN,
    params: params(),
    utcOffset: 2,
  });
  const shifted = computePrayerTimes(new Date(2026, 7, 20), {
    location: DURBAN,
    params: params(),
    utcOffset: 2,
    adjustments: { fajr: 5, isha: -3 },
  });
  assert.equal(Math.round(shifted.fajr - base.fajr), 5);
  assert.equal(Math.round(shifted.isha - base.isha), -3);
});

test('qibla from Durban points roughly north-north-east', () => {
  const bearing = qiblaDirection(DURBAN);
  assert.ok(bearing > 0 && bearing < 40, `bearing ${bearing}`);
  // Great-circle distance from Durban to the Kaaba is a little under 5,800 km.
  const distance = distanceToKaaba(DURBAN);
  assert.ok(Math.abs(distance - 5768) < 30, `distance ${distance} km`);
});

test('polar day leaves times undefined rather than wrong', () => {
  // Tromsø at midsummer: the sun does not set at all, so there is no sunrise to
  // anchor a fallback to. NaN is the honest answer — the board prints "--:--".
  const times = computePrayerTimes(new Date(2026, 5, 21), {
    location: { latitude: 69.65, longitude: 18.96, elevation: 0 },
    params: params({ highLatitudeRule: 'middleOfNight' }),
    utcOffset: 2,
  });
  assert.ok(Number.isNaN(times.sunrise));
  assert.equal(formatClock(times.fajr), '--:--');
});

test('the qibla from due south of the Kaaba points due north', () => {
  const bearing = qiblaDirection({ latitude: 0, longitude: 39.6255745, elevation: 0 });
  assert.ok(Math.abs(bearing) < 0.01 || Math.abs(bearing - 360) < 0.01, `bearing ${bearing}`);
});
