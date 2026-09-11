import { zawaalWindow } from '../lib/prayer-times';
import { findCurrentPrayer, findNextPrayer } from '../lib/schedule';
import { isRamadan } from '../lib/hijri';
import { MoonWidget } from '../components/MoonIcon';
import { Panel } from '../components/ui';
import type { SlideContext } from './types';

/**
 * The main board: the full salaah timetable with adhaan and jamaat columns,
 * the day's solar times alongside it, and the special-schedule strip beneath.
 *
 * The prayer currently in force is highlighted; the next one is flagged.
 */
export function PrayerBoardSlide({ ctx }: { ctx: SlideContext }) {
  const { config, today, tomorrow, nowMinutes, now, format } = ctx;
  const current = findCurrentPrayer(today, nowMinutes);
  const next = findNextPrayer(today, tomorrow, nowMinutes);
  const zawaal = zawaalWindow(today.solar);
  const ramadan = isRamadan(today.hijri);

  const solarRows: Array<{ label: string; value: string; highlight?: boolean }> = [
    { label: ramadan ? 'Suhur Ends' : 'Imsak', value: format(today.solar.imsak), highlight: ramadan },
    { label: 'Sunrise', value: format(today.solar.sunrise) },
    { label: 'Ishraaq', value: format(today.solar.ishraaq) },
    { label: 'Zawaal', value: `${format(zawaal.start)} — ${format(zawaal.end)}` },
    { label: 'Asr Shafi‘i', value: format(today.solar.asr) },
    { label: 'Asr Hanafi', value: format(today.solar.asrHanafi) },
    { label: 'Sunset', value: format(today.solar.sunset) },
    { label: ramadan ? 'Iftaar' : 'Maghrib Begins', value: format(today.solar.maghrib), highlight: ramadan },
    { label: 'Isha Begins', value: format(today.solar.isha) },
    { label: 'Islamic Midnight', value: format(today.solar.midnight) },
  ];

  if (!config.calculation.showBothAsr) {
    const keep = config.calculation.asrJuristic === 'hanafi' ? 'Asr Hanafi' : 'Asr Shafi‘i';
    const index = solarRows.findIndex((row) => row.label !== keep && row.label.startsWith('Asr'));
    if (index >= 0) solarRows.splice(index, 1);
  }

  return (
    <div className="board-grid">
      <div style={{ display: 'flex', flexDirection: 'column', gap: 18, minHeight: 0 }}>
        <Panel className="stagger" style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
          <div className="panel-header">
            <h2>Daily Times</h2>
            <span className="eyebrow">Solar</span>
          </div>
          <div className="solar-list" style={{ flex: 1 }}>
            {solarRows.map((row) => (
              <div className={`solar-row ${row.highlight ? 'is-highlight' : ''}`} key={row.label}>
                <span className="label">{row.label}</span>
                <span className="value numeric">{row.value}</span>
              </div>
            ))}
          </div>
        </Panel>
        <MoonWidget date={now} />
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', minHeight: 0 }}>
        <Panel accent style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
          <div className="panel-header">
            <h2>Salaah Timetable</h2>
            {today.activeOverrides.length > 0 ? (
              <span className="chip chip-accent">{today.activeOverrides[0].label}</span>
            ) : (
              <span className="eyebrow">Adhaan &amp; Jamaat</span>
            )}
          </div>

          <div style={{ padding: '10px 26px 20px', flex: 1 }}>
            <table className="time-table">
              <thead>
                <tr>
                  <th>Salaah</th>
                  <th>Adhaan</th>
                  <th>Jamaat</th>
                </tr>
              </thead>
              <tbody>
                {today.prayers.map((prayer) => {
                  const isCurrent = current?.key === prayer.key && !next.tomorrow && next.prayer.key !== prayer.key;
                  const isNext = !next.tomorrow && next.prayer.key === prayer.key;
                  return (
                    <tr
                      key={prayer.key}
                      className={`${isCurrent ? 'is-current' : ''} ${isNext ? 'is-next' : ''}`.trim()}
                    >
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center' }}>
                          <div>
                            <div className="prayer-name">{prayer.name}</div>
                            {config.display.showArabic ? (
                              <div className="arabic prayer-arabic">{prayer.arabic}</div>
                            ) : null}
                          </div>
                          {isNext ? <span className="row-flag">Next</span> : null}
                          {prayer.overriddenBy ? (
                            <span className="row-flag is-quiet">{prayer.overriddenBy}</span>
                          ) : null}
                        </div>
                      </td>
                      <td>
                        <div className="time-value numeric">{format(prayer.adhaan)}</div>
                      </td>
                      <td className="jamaat-cell">
                        <div className="time-value numeric">{format(prayer.jamaat)}</div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Panel>

        <SpecialStrip ctx={ctx} />
      </div>
    </div>
  );
}

/** Jumu'ah and any weekday/holiday overrides, printed under the table. */
function SpecialStrip({ ctx }: { ctx: SlideContext }) {
  const { config, format, today } = ctx;
  const rows: Array<{ title: string; sub: string; adhaan: string; jamaat: string; jumuah?: boolean }> = [];

  // On a Friday the table itself already carries Jumu'ah in place of Dhuhr, so
  // repeating it here would just say the same thing twice.
  if (config.jumuah.enabled && !today.isFriday) {
    rows.push({
      title: config.jumuah.label,
      sub: 'Every Friday',
      adhaan: config.jumuah.adhaanTime,
      jamaat: config.jumuah.salaahTime,
      jumuah: true,
    });
    if (config.jumuah.second.enabled) {
      rows.push({
        title: config.jumuah.second.label,
        sub: 'Every Friday',
        adhaan: config.jumuah.second.adhaanTime,
        jamaat: config.jumuah.second.salaahTime,
        jumuah: true,
      });
    }
  }

  for (const override of config.overrides) {
    if (!override.enabled) continue;
    for (const [key, patch] of Object.entries(override.prayers)) {
      if (!patch?.adhaan || !patch?.jamaat) continue;
      if (patch.adhaan.mode !== 'fixed' || patch.jamaat.mode !== 'fixed') continue;
      rows.push({
        title: `${key.charAt(0).toUpperCase()}${key.slice(1)}`,
        sub: override.label,
        adhaan: patch.adhaan.time,
        jamaat: patch.jamaat.time,
      });
    }
  }

  if (rows.length === 0) return null;

  // Fixed times are stored as 24-hour strings; render them in the board's format.
  const render = (value: string) => {
    const [hours, mins] = value.split(':').map(Number);
    return Number.isFinite(hours) && Number.isFinite(mins) ? format(hours * 60 + mins) : value;
  };

  return (
    <div className="special-strip">
      {rows.slice(0, 3).map((row, index) => (
        <div className={`special-row ${row.jumuah ? 'is-jumuah' : ''}`} key={`${row.title}-${index}`}>
          <div>
            <div className="title">{row.title}</div>
            <div className="sub">{row.sub}</div>
          </div>
          <div className="value numeric">{render(row.adhaan)}</div>
          <div className="value numeric">{render(row.jamaat)}</div>
        </div>
      ))}
    </div>
  );
}
