import type { PlannedSlide } from '../lib/slide-plan';
import { PrayerBoardSlide } from './PrayerBoardSlide';
import { NextSalaahSlide } from './NextSalaahSlide';
import {
  AnnouncementsSlide,
  AppealSlide,
  ClassesSlide,
  EventsSlide,
  JanazahSlide,
  JumuahSlide,
  OccasionsSlide,
  QiblaSlide,
  QuoteSlide,
} from './ContentSlides';
import type { SlideContext } from './types';

/** Dispatches a planned slide to its renderer. */
export function SlideRenderer({ slide, ctx }: { slide: PlannedSlide; ctx: SlideContext }) {
  const { payload, title, page } = slide;

  switch (payload.type) {
    case 'prayerBoard':
      return <PrayerBoardSlide ctx={ctx} />;
    case 'nextSalaah':
      return <NextSalaahSlide ctx={ctx} />;
    case 'announcements':
      return <AnnouncementsSlide items={payload.items} title={title} page={page} ctx={ctx} />;
    case 'quote':
      return <QuoteSlide item={payload.item} ctx={ctx} />;
    case 'events':
      return <EventsSlide items={payload.items} title={title} page={page} />;
    case 'janazah':
      return <JanazahSlide items={payload.items} title={title} ctx={ctx} />;
    case 'appeal':
      return <AppealSlide item={payload.item} title={title} />;
    case 'classes':
      return <ClassesSlide items={payload.items} title={title} page={page} />;
    case 'jumuah':
      return <JumuahSlide ctx={ctx} title={title} />;
    case 'occasions':
      return <OccasionsSlide ctx={ctx} title={title} />;
    case 'qibla':
      return <QiblaSlide ctx={ctx} title={title} />;
    default:
      return null;
  }
}

export type { SlideContext } from './types';
