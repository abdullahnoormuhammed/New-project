import type { MasjidConfig } from '../lib/config';
import type { DaySchedule } from '../lib/schedule';
import type { PlannedSlide } from '../lib/slide-plan';

/** Everything a slide needs to render, assembled once per tick by the board. */
export interface SlideContext {
  config: MasjidConfig;
  now: Date;
  /** Minutes from midnight, with seconds precision. */
  nowMinutes: number;
  today: DaySchedule;
  tomorrow: DaySchedule;
  /** Formats minutes-from-midnight using the board's clock settings. */
  format: (minutes: number, withSeconds?: boolean) => string;
}

export interface SlideProps<P = PlannedSlide['payload']> {
  slide: PlannedSlide;
  payload: P;
  ctx: SlideContext;
}
