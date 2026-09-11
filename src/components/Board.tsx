import { useMemo, useRef } from 'react';
import { useConfig } from '../state/ConfigContext';
import { useNow } from '../hooks/useNow';
import { useSlideshow, useSlideshowKeys } from '../hooks/useSlideshow';
import { STAGE_HEIGHT, STAGE_WIDTH, useNightlyReload, useStageScale, useWakeLock } from '../hooks/useStage';
import { buildSchedulePair } from '../lib/schedule';
import { buildSlidePlan } from '../lib/slide-plan';
import { resolvePrayerState, secondsToNextJamaat } from '../lib/prayer-state';
import { minutesOfDay, parseClock, toISODate } from '../lib/time';
import { PATTERN_URL } from '../lib/pattern';
import { BoardHeader } from './BoardHeader';
import { BoardFooter } from './BoardFooter';
import { PreAdhaanBanner, Takeover } from './Takeover';
import { SlideRenderer } from '../slides';
import { makeTimeFormatter } from './ui';
import type { SlideContext } from '../slides/types';

/**
 * The board itself: fixed 1920x1080 stage, persistent header and footer, and a
 * rotating deck that steps aside for the salaah takeovers.
 */
export function Board() {
  const { config } = useConfig();
  const now = useNow(1000);
  const viewportRef = useRef<HTMLDivElement>(null);
  const scale = useStageScale(viewportRef);

  useWakeLock(true);
  useNightlyReload(true, 3);

  // Schedules are rebuilt only when the calendar day or the config changes —
  // not on every one-second tick.
  const dayKey = toISODate(now);
  const [today, tomorrow] = useMemo(
    () => buildSchedulePair(config, new Date(`${dayKey}T00:00:00`)),
    [config, dayKey],
  );

  const plan = useMemo(() => buildSlidePlan(config, new Date(`${dayKey}T00:00:00`)), [config, dayKey]);
  const durations = useMemo(() => plan.map((slide) => slide.seconds), [plan]);

  const nowMinutes = minutesOfDay(now);
  const prayerState = resolvePrayerState({
    today,
    tomorrow,
    nowMinutes,
    alerts: config.alerts,
  });

  const slideshow = useSlideshow({ durations, paused: prayerState.takeover });
  useSlideshowKeys(slideshow, !prayerState.takeover);

  const next = secondsToNextJamaat(today, tomorrow, nowMinutes);
  const currentSlide = plan[slideshow.index] ?? plan[0];

  const ctx: SlideContext = useMemo(
    () => ({
      config,
      now,
      nowMinutes,
      today,
      tomorrow,
      format: makeTimeFormatter(config.display),
    }),
    [config, now, nowMinutes, today, tomorrow],
  );

  const dimmed = isDimHour(config.display, nowMinutes);
  const transitionClass = `slide-enter-${config.display.transition}`;

  return (
    <div className="viewport" ref={viewportRef}>
      <div
        className={`stage ${dimmed ? 'is-dimmed' : ''}`}
        data-theme={config.display.theme}
        style={{
          transform: `scale(${scale})`,
          ['--pattern-url' as string]: `url("${PATTERN_URL}")`,
          ['--dim-level' as string]: String(config.display.nightDimOpacity),
          width: STAGE_WIDTH,
          height: STAGE_HEIGHT,
        }}
      >
        <div className="stage-content">
          <BoardHeader config={config} now={now} hijri={today.hijri} />

          <main className="slide-frame">
            {currentSlide ? (
              <div
                className={`slide-layer ${transitionClass}`}
                key={`${currentSlide.key}:${slideshow.tick}`}
              >
                <SlideRenderer slide={currentSlide} ctx={ctx} />
              </div>
            ) : null}

            <PreAdhaanBanner state={prayerState} />
            <Takeover state={prayerState} config={config} />
          </main>

          <BoardFooter
            config={config}
            nextPrayer={next.prayer}
            secondsToJamaat={next.seconds}
            nextIsTomorrow={next.tomorrow}
            slideCount={plan.length}
            slideIndex={slideshow.index}
          />
        </div>
      </div>
    </div>
  );
}

/** True when "now" falls inside the configured overnight dimming window. */
function isDimHour(display: { nightDimEnabled: boolean; nightDimStart: string; nightDimEnd: string }, nowMinutes: number): boolean {
  if (!display.nightDimEnabled) return false;
  const start = parseClock(display.nightDimStart);
  const end = parseClock(display.nightDimEnd);
  if (start === null || end === null) return false;
  // The window normally wraps midnight, e.g. 22:00 → 04:00.
  return start <= end ? nowMinutes >= start && nowMinutes < end : nowMinutes >= start || nowMinutes < end;
}
