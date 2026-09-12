/**
 * Expands the configured deck into the slides that will actually be shown.
 *
 * Two things happen here. Empty slides are dropped — a board with no janazah
 * notice should never display an empty "Janazah Notices" screen. And long lists
 * are paginated into several slides, so the deck's progress dots stay honest
 * and no card is ever squeezed to fit.
 */

import type {
  Announcement,
  ClassEntry,
  JanazahNotice,
  MasjidConfig,
  MasjidEvent,
  Quote,
  SlideConfig,
  SlideType,
} from './config.ts';
import { SLIDE_LABELS } from './config.ts';
import { fromISODate, startOfDay } from './time.ts';

export type SlidePayload =
  | { type: 'prayerBoard' }
  | { type: 'nextSalaah' }
  | { type: 'announcements'; items: Announcement[] }
  | { type: 'quote'; item: Quote }
  | { type: 'events'; items: MasjidEvent[] }
  | { type: 'janazah'; items: JanazahNotice[] }
  | { type: 'classes'; items: ClassEntry[] }
  | { type: 'jumuah' }
  | { type: 'occasions' }
  | { type: 'qibla' };

export interface PlannedSlide {
  /** Stable across re-plans so React does not remount a slide mid-display. */
  key: string;
  seconds: number;
  title: string;
  payload: SlidePayload;
  /** Set when a list was split across several slides. */
  page?: { index: number; total: number };
}

/**
 * Split a list into pages of at most `max`, balancing the last two pages so a
 * list of four never renders as a page of three and a lonely page of one.
 */
export function paginate<T>(items: T[], max: number): T[][] {
  if (items.length === 0) return [];
  if (items.length <= max) return [items];

  const pageCount = Math.ceil(items.length / max);
  const perPage = Math.ceil(items.length / pageCount);
  const pages: T[][] = [];
  for (let i = 0; i < items.length; i += perPage) {
    pages.push(items.slice(i, i + perPage));
  }
  return pages;
}

const isEnabled = <T extends { enabled: boolean }>(item: T) => item.enabled;

/** Announcements inside their start/end window (a missing bound is open-ended). */
export function activeAnnouncements(items: Announcement[], today: Date): Announcement[] {
  const day = startOfDay(today).getTime();
  return items.filter((item) => {
    if (!item.enabled) return false;
    const start = fromISODate(item.startDate);
    const end = fromISODate(item.endDate);
    if (start && day < start.getTime()) return false;
    if (end && day > end.getTime()) return false;
    return true;
  });
}

/** Events from today onwards, soonest first. Undated events sort to the end. */
export function upcomingEvents(items: MasjidEvent[], today: Date): MasjidEvent[] {
  const day = startOfDay(today).getTime();
  return items
    .filter(isEnabled)
    .filter((item) => {
      const date = fromISODate(item.date);
      return !date || date.getTime() >= day;
    })
    .sort((a, b) => {
      const aDate = fromISODate(a.date)?.getTime() ?? Number.MAX_SAFE_INTEGER;
      const bDate = fromISODate(b.date)?.getTime() ?? Number.MAX_SAFE_INTEGER;
      return aDate - bDate;
    });
}

/** Janazah notices that have not passed their expiry date. */
export function activeJanazah(items: JanazahNotice[], today: Date): JanazahNotice[] {
  const day = startOfDay(today).getTime();
  return items.filter((item) => {
    if (!item.enabled) return false;
    const expires = fromISODate(item.expiresOn);
    return !expires || expires.getTime() >= day;
  });
}

export function buildSlidePlan(config: MasjidConfig, today: Date): PlannedSlide[] {
  const plan: PlannedSlide[] = [];
  const defaultSeconds = config.display.defaultSlideSeconds;

  for (const slide of config.slides) {
    if (!slide.enabled) continue;
    const seconds = slide.durationSeconds > 0 ? slide.durationSeconds : defaultSeconds;
    const title = slide.title?.trim() || SLIDE_LABELS[slide.type];
    plan.push(...expand(slide, { seconds, title }, config, today));
  }

  // A board must always show something; the timetable is the safe fallback.
  if (plan.length === 0) {
    plan.push({
      key: 'fallback-board',
      seconds: defaultSeconds,
      title: SLIDE_LABELS.prayerBoard,
      payload: { type: 'prayerBoard' },
    });
  }

  return plan;
}

interface SlideMeta {
  seconds: number;
  title: string;
}

function expand(
  slide: SlideConfig,
  meta: SlideMeta,
  config: MasjidConfig,
  today: Date,
): PlannedSlide[] {
  const single = (payload: SlidePayload): PlannedSlide[] => [
    { key: slide.id, seconds: meta.seconds, title: meta.title, payload },
  ];

  const paged = <T,>(
    items: T[],
    perPage: number,
    toPayload: (page: T[]) => SlidePayload,
  ): PlannedSlide[] => {
    const pages = paginate(items, perPage);
    return pages.map((page, index) => ({
      key: `${slide.id}:${index}`,
      seconds: meta.seconds,
      title: meta.title,
      payload: toPayload(page),
      ...(pages.length > 1 ? { page: { index: index + 1, total: pages.length } } : {}),
    }));
  };

  switch (slide.type) {
    case 'prayerBoard':
      return single({ type: 'prayerBoard' });

    case 'nextSalaah':
      return single({ type: 'nextSalaah' });

    case 'announcements':
      return paged(activeAnnouncements(config.announcements, today), 3, (items) => ({
        type: 'announcements',
        items,
      }));

    case 'quote':
      // Each ayah or hadith gets the full screen — they are meant to be read.
      return config.quotes.filter(isEnabled).map((item, index) => ({
        key: `${slide.id}:${item.id}`,
        seconds: meta.seconds,
        title: meta.title,
        payload: { type: 'quote', item },
        ...(config.quotes.filter(isEnabled).length > 1
          ? { page: { index: index + 1, total: config.quotes.filter(isEnabled).length } }
          : {}),
      }));

    case 'events':
      return paged(upcomingEvents(config.events, today), 4, (items) => ({
        type: 'events',
        items,
      }));

    case 'janazah':
      return paged(activeJanazah(config.janazah, today), 2, (items) => ({
        type: 'janazah',
        items,
      }));

    case 'classes':
      return paged(config.classes.filter(isEnabled), 4, (items) => ({
        type: 'classes',
        items,
      }));

    case 'jumuah':
      return config.jumuah.enabled ? single({ type: 'jumuah' }) : [];

    case 'occasions':
      return single({ type: 'occasions' });

    case 'qibla':
      return single({ type: 'qibla' });

    default:
      return [];
  }
}

/** Used by the admin panel to explain what a slide will do. */
export function describeSlide(type: SlideType, config: MasjidConfig, today: Date): string {
  switch (type) {
    case 'announcements': {
      const count = activeAnnouncements(config.announcements, today).length;
      return count === 0 ? 'No active announcements — this slide is skipped.' : `${count} active`;
    }
    case 'events': {
      const count = upcomingEvents(config.events, today).length;
      return count === 0 ? 'No upcoming programmes — this slide is skipped.' : `${count} upcoming`;
    }
    case 'janazah': {
      const count = activeJanazah(config.janazah, today).length;
      return count === 0 ? 'No current notices — this slide is skipped.' : `${count} notice(s)`;
    }
    case 'quote': {
      const count = config.quotes.filter(isEnabled).length;
      return count === 0 ? 'No items — this slide is skipped.' : `${count} item(s), one per slide`;
    }
    case 'classes': {
      const count = config.classes.filter(isEnabled).length;
      return count === 0 ? 'No classes listed — this slide is skipped.' : `${count} listed`;
    }
    case 'jumuah':
      return config.jumuah.enabled ? "Jumu'ah times" : "Jumu'ah is switched off — slide skipped.";
    default:
      return 'Always shown';
  }
}
