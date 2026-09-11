import type { MasjidConfig } from '../lib/config';
import { formatHijri, type HijriDate } from '../lib/hijri';
import { WEEKDAY_NAMES, formatGregorianDate, minutesOfDay } from '../lib/time';
import { makeTimeFormatter } from './ui';

/**
 * The persistent top bar: live clock, masjid identity, and both calendars.
 * It stays on screen through every slide so a musallee entering mid-rotation
 * always sees the time and the date.
 */
export function BoardHeader({
  config,
  now,
  hijri,
}: {
  config: MasjidConfig;
  now: Date;
  hijri: HijriDate;
}) {
  const { display, masjid } = config;
  const format = makeTimeFormatter(display);
  const minutes = minutesOfDay(now);
  const clock = format(minutes);
  const seconds = String(now.getSeconds()).padStart(2, '0');
  const meridiem = now.getHours() < 12 ? 'AM' : 'PM';

  return (
    <header className="board-header">
      <div className="header-clock">
        <div className="time numeric">
          {clock}
          {display.showSeconds ? <span className="seconds numeric">{seconds}</span> : null}
          {display.hour12 && !display.showMeridiem ? (
            <span className="meridiem">{meridiem}</span>
          ) : null}
        </div>
        <div className="weekday">{WEEKDAY_NAMES[now.getDay()]}</div>
      </div>

      <div className="header-identity">
        <div style={{ display: 'flex', alignItems: 'center', gap: 24 }}>
          {masjid.logoDataUrl ? (
            <img className="header-logo" src={masjid.logoDataUrl} alt="" />
          ) : null}
          <div>
            <div className="name">{masjid.name}</div>
            <div className="header-ornament">
              <span className="place">
                {[masjid.suburb, masjid.city].filter(Boolean).join(' · ')}
              </span>
            </div>
          </div>
        </div>
      </div>

      <div className="header-dates">
        <div className="gregorian numeric">{formatGregorianDate(now)}</div>
        <div className="hijri numeric">{formatHijri(hijri)}</div>
        <div className="hijri-weekday">
          {display.showArabic ? hijri.weekdayNameArabic : hijri.weekdayName}
        </div>
      </div>
    </header>
  );
}
