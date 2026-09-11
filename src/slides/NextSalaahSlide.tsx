import { findNextPrayer } from '../lib/schedule';
import { formatDuration, MINUTES_PER_DAY } from '../lib/time';
import { Panel } from '../components/ui';
import type { SlideContext } from './types';

/**
 * A single, unmissable countdown to the next jamaat — the slide people glance
 * at from the door. The bar underneath shows how far through the gap between
 * the previous jamaat and this one we are.
 */
export function NextSalaahSlide({ ctx }: { ctx: SlideContext }) {
  const { today, tomorrow, nowMinutes, config, format } = ctx;
  const next = findNextPrayer(today, tomorrow, nowMinutes);
  const secondsToJamaat = Math.max(0, Math.round((next.jamaatAt - nowMinutes) * 60));
  const adhaanPassed = nowMinutes >= next.adhaanAt;

  // Everything the countdown needs about the salaah that came before it.
  const all = [
    ...today.prayers.map((p) => ({ prayer: p, jamaatAt: p.jamaat })),
    ...tomorrow.prayers.map((p) => ({ prayer: p, jamaatAt: p.jamaat + MINUTES_PER_DAY })),
  ];
  const currentIndex = all.findIndex((entry) => entry.jamaatAt === next.jamaatAt);
  const previous = currentIndex > 0 ? all[currentIndex - 1] : null;
  const following = currentIndex >= 0 && currentIndex + 1 < all.length ? all[currentIndex + 1] : null;

  const windowStart = previous ? previous.jamaatAt : next.jamaatAt - 120;
  const span = Math.max(1, next.jamaatAt - windowStart);
  const progress = Math.min(100, Math.max(0, ((nowMinutes - windowStart) / span) * 100));

  return (
    <div className="countdown-slide">
      <Panel accent className="countdown-main">
        <span className="caption">{next.tomorrow ? 'Tomorrow · Next Salaah' : 'Next Salaah'}</span>
        <div className="prayer-name">{next.prayer.name}</div>
        {config.display.showArabic ? (
          <div className="arabic prayer-arabic">{next.prayer.arabic}</div>
        ) : null}
        <div className="digits numeric">{formatDuration(secondsToJamaat, true)}</div>
        <span className="caption">
          {adhaanPassed ? 'until the iqamah' : 'until the jamaat'}
        </span>
        <div className="countdown-progress">
          <div className="fill" style={{ width: `${progress}%` }} />
        </div>
      </Panel>

      <div className="countdown-aside stagger">
        <Panel className="mini-stat">
          <span className="label">Adhaan</span>
          <span className="value numeric">{format(next.prayer.adhaan)}</span>
          <span className="sub">
            {adhaanPassed
              ? 'Adhaan has been called'
              : `in ${formatDuration(Math.max(0, Math.round((next.adhaanAt - nowMinutes) * 60)))}`}
          </span>
        </Panel>

        <Panel className="mini-stat">
          <span className="label">Jamaat</span>
          <span className="value numeric">{format(next.prayer.jamaat)}</span>
          <span className="sub">
            {next.prayer.isJumuah ? 'Jumu‘ah congregation' : 'Congregational salaah'}
          </span>
        </Panel>

        <Panel className="mini-stat">
          <span className="label">Thereafter</span>
          <span className="value numeric">
            {following ? format(following.prayer.jamaat) : '—'}
          </span>
          <span className="sub">{following ? `${following.prayer.name} Jamaat` : 'End of the day'}</span>
        </Panel>
      </div>
    </div>
  );
}
