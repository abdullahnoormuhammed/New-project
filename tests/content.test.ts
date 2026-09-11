import test from 'node:test';
import assert from 'node:assert/strict';

import { DEFAULT_CONFIG, cloneConfig, type MasjidConfig } from '../src/lib/config.ts';
import {
  activeAnnouncements,
  activeJanazah,
  buildSlidePlan,
  paginate,
  upcomingEvents,
} from '../src/lib/slide-plan.ts';
import { importConfig, mergeConfig, normalizeConfig } from '../src/lib/storage.ts';
import {
  ISLAMIC_WEEKDAYS,
  gregorianToJDN,
  hijriToJDN,
  jdnToGregorian,
  jdnToHijri,
  toHijri,
  upcomingOccasions,
} from '../src/lib/hijri.ts';
import { moonPhase, nextNewMoon } from '../src/lib/moon.ts';

const TODAY = new Date(2026, 8, 16);

function config(mutate: (draft: MasjidConfig) => void = () => {}): MasjidConfig {
  const draft = cloneConfig(DEFAULT_CONFIG);
  mutate(draft);
  return draft;
}

// --- pagination ---------------------------------------------------------------------

test('pagination balances the pages rather than stranding one item', () => {
  assert.deepEqual(paginate([1, 2, 3], 3), [[1, 2, 3]]);
  assert.deepEqual(paginate([1, 2, 3, 4], 3), [
    [1, 2],
    [3, 4],
  ]);
  assert.deepEqual(paginate([1, 2, 3, 4, 5, 6, 7], 3), [
    [1, 2, 3],
    [4, 5, 6],
    [7],
  ]);
  assert.deepEqual(paginate([], 3), []);
});

// --- content filtering --------------------------------------------------------------

test('announcements respect their date window', () => {
  const items = config().announcements.map((item, index) => ({
    ...item,
    id: `a${index}`,
    startDate: index === 1 ? '2026-10-01' : null,
    endDate: index === 2 ? '2026-09-01' : null,
  }));

  const active = activeAnnouncements(items, TODAY);
  const ids = active.map((a) => a.id);
  assert.ok(ids.includes('a0'), 'an open-ended notice shows');
  assert.ok(!ids.includes('a1'), 'a notice that has not started is hidden');
  assert.ok(!ids.includes('a2'), 'a notice that has ended is hidden');
});

test('a disabled announcement never shows, whatever its dates', () => {
  const items = [{ ...config().announcements[0], enabled: false }];
  assert.equal(activeAnnouncements(items, TODAY).length, 0);
});

test('events drop off after their date and sort soonest first', () => {
  const events = [
    { id: 'e1', title: 'Later', date: '2026-10-05', time: '', speaker: '', location: '', enabled: true },
    { id: 'e2', title: 'Past', date: '2026-08-01', time: '', speaker: '', location: '', enabled: true },
    { id: 'e3', title: 'Soon', date: '2026-09-20', time: '', speaker: '', location: '', enabled: true },
    { id: 'e4', title: 'Standing', date: '', time: '', speaker: '', location: '', enabled: true },
  ];
  const upcoming = upcomingEvents(events, TODAY);
  assert.deepEqual(
    upcoming.map((e) => e.id),
    ['e3', 'e1', 'e4'],
    'undated programmes sort to the end',
  );
});

test('an event dated today still shows', () => {
  const events = [
    { id: 'e1', title: 'Today', date: '2026-09-16', time: '', speaker: '', location: '', enabled: true },
  ];
  assert.equal(upcomingEvents(events, TODAY).length, 1);
});

test('janazah notices expire on their own', () => {
  const notices = [
    { id: 'j1', name: 'A', age: '', salaahTime: '', salaahVenue: '', burialVenue: '', expiresOn: '2026-09-16', enabled: true },
    { id: 'j2', name: 'B', age: '', salaahTime: '', salaahVenue: '', burialVenue: '', expiresOn: '2026-09-15', enabled: true },
    { id: 'j3', name: 'C', age: '', salaahTime: '', salaahVenue: '', burialVenue: '', expiresOn: null, enabled: true },
  ];
  assert.deepEqual(
    activeJanazah(notices, TODAY).map((n) => n.id),
    ['j1', 'j3'],
  );
});

// --- the deck ------------------------------------------------------------------------

test('slides with no content are left out of the deck', () => {
  const plan = buildSlidePlan(config(), TODAY);
  assert.equal(
    plan.some((slide) => slide.payload.type === 'janazah'),
    false,
    'there are no janazah notices by default',
  );
  assert.ok(plan.some((slide) => slide.payload.type === 'prayerBoard'));
});

test('a long announcement list is split over several slides', () => {
  const plan = buildSlidePlan(
    config((draft) => {
      draft.announcements = Array.from({ length: 7 }, (_, i) => ({
        id: `a${i}`,
        title: `Notice ${i}`,
        body: '',
        priority: 'normal' as const,
        startDate: null,
        endDate: null,
        enabled: true,
      }));
    }),
    TODAY,
  );

  const announcementSlides = plan.filter((slide) => slide.payload.type === 'announcements');
  assert.equal(announcementSlides.length, 3);
  assert.deepEqual(announcementSlides[0].page, { index: 1, total: 3 });
  const total = announcementSlides.reduce(
    (sum, slide) => sum + (slide.payload.type === 'announcements' ? slide.payload.items.length : 0),
    0,
  );
  assert.equal(total, 7, 'every notice appears exactly once');
});

test('a disabled slide is removed from the rotation', () => {
  const plan = buildSlidePlan(
    config((draft) => {
      draft.slides = draft.slides.map((slide) =>
        slide.type === 'qibla' ? { ...slide, enabled: false } : slide,
      );
    }),
    TODAY,
  );
  assert.equal(
    plan.some((slide) => slide.payload.type === 'qibla'),
    false,
  );
});

test('the deck is never empty', () => {
  const plan = buildSlidePlan(
    config((draft) => {
      draft.slides = draft.slides.map((slide) => ({ ...slide, enabled: false }));
    }),
    TODAY,
  );
  assert.equal(plan.length, 1);
  assert.equal(plan[0].payload.type, 'prayerBoard');
});

test('a slide with no duration falls back to the default', () => {
  const plan = buildSlidePlan(
    config((draft) => {
      draft.display.defaultSlideSeconds = 33;
      draft.slides = [{ id: 's1', type: 'prayerBoard', enabled: true, durationSeconds: 0 }];
    }),
    TODAY,
  );
  assert.equal(plan[0].seconds, 33);
});

// --- storage --------------------------------------------------------------------------

test('a stored config gains fields added by a later version', () => {
  const stored = { masjid: { name: 'Masjid An-Noor' } };
  const merged = normalizeConfig(stored);
  assert.equal(merged.masjid.name, 'Masjid An-Noor');
  assert.equal(merged.masjid.city, DEFAULT_CONFIG.masjid.city, 'untouched fields keep their default');
  assert.ok(Array.isArray(merged.slides), 'the deck is present even though it was not stored');
});

test('lists are replaced wholesale, not merged element by element', () => {
  const merged = normalizeConfig({ announcements: [] });
  assert.equal(merged.announcements.length, 0, 'a deleted announcement stays deleted');
});

test('nonsense values are clamped instead of breaking the board', () => {
  const merged = normalizeConfig({
    location: { latitude: 999, longitude: -999 },
    display: { defaultSlideSeconds: 0 },
    slides: 'not a list',
  });
  assert.equal(merged.location.latitude, 90);
  assert.equal(merged.location.longitude, -180);
  assert.equal(merged.display.defaultSlideSeconds, 5, 'an out-of-range value clamps to the minimum');
  assert.ok(Array.isArray(merged.slides));

  // Something that is not a number at all falls back to the default instead.
  const garbled = normalizeConfig({ display: { defaultSlideSeconds: 'soon' } });
  assert.equal(garbled.display.defaultSlideSeconds, 20);
});

test('importing rubbish reports an error rather than throwing', () => {
  assert.equal(importConfig('{not json').ok, false);
  assert.equal(importConfig('[1,2,3]').ok, false);
  assert.equal(importConfig('{"masjid":{"name":"X"}}').ok, true);
});

test('merging ignores undefined but keeps explicit nulls', () => {
  const merged = mergeConfig({ a: 1, b: 2 }, { a: undefined, b: null }) as Record<string, unknown>;
  assert.equal(merged.a, 1);
  assert.equal(merged.b, null);
});

// --- the Islamic calendar ---------------------------------------------------------------

test('the tabular Hijri date is correct for a known Gregorian date', () => {
  const hijri = toHijri(new Date(2026, 7, 20));
  assert.equal(hijri.year, 1448);
  assert.equal(hijri.month, 3);
  assert.equal(hijri.day, 6);
  assert.equal(hijri.monthName, "Rabi' ul Awwal");
  assert.equal(hijri.weekdayName, ISLAMIC_WEEKDAYS[4]); // Yawm al-Khamis
});

test('the shipped adjustment reproduces the board this was modelled on', () => {
  // That board read "8 Rabi' ul Awwal 1448" on Thursday 20 August 2026 — two
  // days ahead of the tabular calendar, which is what the adjustment is for.
  const hijri = toHijri(new Date(2026, 7, 20), DEFAULT_CONFIG.calculation.hijriAdjustment);
  assert.equal(hijri.day, 8);
  assert.equal(hijri.monthName, "Rabi' ul Awwal");
  assert.equal(hijri.year, 1448);
});

test('the Gregorian Julian Day agrees with the Unix epoch', () => {
  for (const [y, m, d] of [
    [1900, 1, 1],
    [2000, 2, 29],
    [2026, 1, 31],
    [2026, 9, 16],
    [2100, 12, 31],
  ]) {
    const reference = Math.floor(Date.UTC(y, m - 1, d) / 86400000) + 2440588;
    assert.equal(gregorianToJDN(y, m, d), reference, `${y}-${m}-${d}`);
  }
});

test('Hijri conversion round-trips across sixty years', () => {
  let mismatches = 0;
  for (let jdn = gregorianToJDN(2000, 1, 1); jdn <= gregorianToJDN(2060, 1, 1); jdn += 1) {
    const hijri = jdnToHijri(jdn);
    if (hijriToJDN(hijri.year, hijri.month, hijri.day) !== jdn) mismatches += 1;
  }
  assert.equal(mismatches, 0);
});

test('the Gregorian conversion round-trips too', () => {
  const jdn = gregorianToJDN(2026, 9, 16);
  const back = jdnToGregorian(jdn);
  assert.equal(back.getFullYear(), 2026);
  assert.equal(back.getMonth(), 8);
  assert.equal(back.getDate(), 16);
});

test('the adjustment shifts the Hijri date by whole days', () => {
  const plain = toHijri(new Date(2026, 7, 20));
  const shifted = toHijri(new Date(2026, 7, 20), 1);
  assert.equal(shifted.day, plain.day + 1);
});

test('after maghrib the Islamic date has already rolled over', () => {
  const before = toHijri(new Date(2026, 7, 20), 0, false);
  const after = toHijri(new Date(2026, 7, 20), 0, true);
  assert.equal(after.day, before.day + 1);
  assert.equal(after.weekdayName, ISLAMIC_WEEKDAYS[5], 'the weekday rolls over as well');
});

test('upcoming occasions are in the future and correctly ordered', () => {
  const occasions = upcomingOccasions(TODAY, 0, 4);
  assert.equal(occasions.length, 4);
  for (const occasion of occasions) {
    assert.ok(occasion.daysAway >= 0, `${occasion.name} is ${occasion.daysAway} days away`);
  }
  for (let i = 1; i < occasions.length; i += 1) {
    assert.ok(occasions[i].daysAway >= occasions[i - 1].daysAway);
  }
});

// --- the moon ----------------------------------------------------------------------------

test('the moon phase runs a full cycle', () => {
  const newMoon = nextNewMoon(TODAY);
  const atNew = moonPhase(newMoon);
  assert.ok(atNew.illumination < 0.02, `illumination ${atNew.illumination}`);
  assert.equal(atNew.name, 'New Moon');

  const full = new Date(newMoon.getTime() + 14.77 * 86400000);
  const atFull = moonPhase(full);
  assert.ok(atFull.illumination > 0.98, `illumination ${atFull.illumination}`);
  assert.equal(atFull.name, 'Full Moon');

  const waxing = moonPhase(new Date(newMoon.getTime() + 5 * 86400000));
  assert.equal(waxing.waxing, true);
  const waning = moonPhase(new Date(newMoon.getTime() + 20 * 86400000));
  assert.equal(waning.waxing, false);
});

test('the moon age stays inside one synodic month', () => {
  for (let days = 0; days < 60; days += 1) {
    const phase = moonPhase(new Date(TODAY.getTime() + days * 86400000));
    assert.ok(phase.ageDays >= 0 && phase.ageDays < 29.54, `age ${phase.ageDays}`);
    assert.ok(phase.illumination >= 0 && phase.illumination <= 1);
  }
});
