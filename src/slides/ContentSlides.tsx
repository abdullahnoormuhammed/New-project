import type {
  Announcement,
  ClassEntry,
  JanazahNotice,
  MasjidEvent,
  Quote,
} from '../lib/config';
import { getMethod } from '../lib/prayer-times';
import { distanceToKaaba, qiblaDirection } from '../lib/prayer-times';
import { upcomingOccasions } from '../lib/hijri';
import { MONTH_NAMES, fromISODate, parseClock } from '../lib/time';
import { EmptyState, Ornament, Panel, SlideShell } from '../components/ui';
import type { SlideContext } from './types';

// --- announcements -------------------------------------------------------------

export function AnnouncementsSlide({
  items,
  title,
  page,
  ctx,
}: {
  items: Announcement[];
  title: string;
  page?: { index: number; total: number };
  ctx: SlideContext;
}) {
  void ctx;
  const count = Math.min(items.length, 3);
  return (
    <SlideShell
      eyebrow="Notice Board"
      title={title}
      aside={page ? <span className="chip">{`${page.index} of ${page.total}`}</span> : undefined}
    >
      {items.length === 0 ? (
        <EmptyState glyph="✽" headline="No announcements at present" />
      ) : (
        <div className={`announcement-grid count-${count} stagger`}>
          {items.map((item) => (
            <Panel key={item.id} className={`announcement-card priority-${item.priority}`}>
              {item.priority !== 'normal' ? (
                <span className={item.priority === 'urgent' ? 'chip chip-danger' : 'chip chip-warn'}>
                  {item.priority === 'urgent' ? 'Urgent' : 'Important'}
                </span>
              ) : null}
              <div className="title">{item.title}</div>
              <div className="body">{item.body}</div>
            </Panel>
          ))}
        </div>
      )}
    </SlideShell>
  );
}

// --- ayah / hadith --------------------------------------------------------------

const QUOTE_EYEBROW: Record<Quote['kind'], string> = {
  ayah: 'From the Qur’an',
  hadith: 'From the Sunnah',
  dua: 'Du‘a',
};

export function QuoteSlide({ item, ctx }: { item: Quote; ctx: SlideContext }) {
  const showArabic = ctx.config.display.showArabic && Boolean(item.arabic.trim());
  return (
    <div className="quote-slide stagger">
      <span className="eyebrow" style={{ textAlign: 'center' }}>
        {QUOTE_EYEBROW[item.kind]}
      </span>
      {showArabic ? <div className="arabic arabic-text">{item.arabic}</div> : null}
      <Ornament />
      <div className="translation">“{item.translation}”</div>
      <div className="reference">{item.reference}</div>
    </div>
  );
}

// --- events ---------------------------------------------------------------------

export function EventsSlide({
  items,
  title,
  page,
}: {
  items: MasjidEvent[];
  title: string;
  page?: { index: number; total: number };
}) {
  return (
    <SlideShell
      eyebrow="What’s On"
      title={title}
      aside={page ? <span className="chip">{`${page.index} of ${page.total}`}</span> : undefined}
    >
      {items.length === 0 ? (
        <EmptyState glyph="✽" headline="No programmes scheduled" />
      ) : (
        <div className="list-rows stagger">
          {items.map((item) => {
            const date = fromISODate(item.date);
            return (
              <Panel key={item.id} className="list-row">
                <div className="date-badge">
                  {date ? (
                    <>
                      <span className="day numeric">{date.getDate()}</span>
                      <span className="month">{MONTH_NAMES[date.getMonth()].slice(0, 3)}</span>
                    </>
                  ) : (
                    <span className="month">Ongoing</span>
                  )}
                </div>
                <div className="main">
                  <div className="title">{item.title}</div>
                  <div className="meta">
                    {item.speaker ? <span>{item.speaker}</span> : null}
                    {item.speaker && item.location ? <span className="sep" /> : null}
                    {item.location ? <span>{item.location}</span> : null}
                  </div>
                </div>
                <div className="time-col numeric">{item.time}</div>
              </Panel>
            );
          })}
        </div>
      )}
    </SlideShell>
  );
}

// --- janazah --------------------------------------------------------------------

export function JanazahSlide({
  items,
  title,
  ctx,
}: {
  items: JanazahNotice[];
  title: string;
  ctx: SlideContext;
}) {
  return (
    <SlideShell eyebrow="Janazah Notice" title={title}>
      <div className="janazah-slide stagger">
        <div className="janazah-dua">
          {ctx.config.display.showArabic ? (
            <div className="arabic arabic-text">إِنَّا لِلَّٰهِ وَإِنَّا إِلَيْهِ رَاجِعُون</div>
          ) : null}
          <div>Indeed we belong to Allah, and to Him we shall return.</div>
        </div>

        {items.map((item) => (
          <Panel key={item.id} className="janazah-card" accent>
            <div className="deceased">
              <div className="name">{item.name}</div>
              {item.age ? <div className="age">{item.age}</div> : null}
            </div>
            <div className="field">
              <div className="label">Janazah Salaah</div>
              <div className="value">{item.salaahTime}</div>
              {item.salaahVenue ? <div className="age">{item.salaahVenue}</div> : null}
            </div>
            <div className="field">
              <div className="label">Burial</div>
              <div className="value">{item.burialVenue || '—'}</div>
            </div>
          </Panel>
        ))}
      </div>
    </SlideShell>
  );
}

// --- classes --------------------------------------------------------------------

export function ClassesSlide({
  items,
  title,
  page,
}: {
  items: ClassEntry[];
  title: string;
  page?: { index: number; total: number };
}) {
  return (
    <SlideShell
      eyebrow="Ta‘leem"
      title={title}
      aside={page ? <span className="chip">{`${page.index} of ${page.total}`}</span> : undefined}
    >
      <div className="list-rows stagger">
        {items.map((item) => (
          <Panel key={item.id} className="list-row">
            <div className="date-badge">
              <span className="month">Class</span>
            </div>
            <div className="main">
              <div className="title">{item.title}</div>
              <div className="meta">
                <span>{item.schedule}</span>
                {item.teacher ? <span className="sep" /> : null}
                {item.teacher ? <span>{item.teacher}</span> : null}
              </div>
            </div>
            <div className="time-col numeric">{item.time}</div>
          </Panel>
        ))}
      </div>
    </SlideShell>
  );
}

// --- jumu'ah ---------------------------------------------------------------------

export function JumuahSlide({ ctx, title }: { ctx: SlideContext; title: string }) {
  const { jumuah } = ctx.config;
  const show = (value: string) => {
    const minutes = parseClock(value);
    return minutes === null ? value : ctx.format(minutes);
  };

  return (
    <SlideShell eyebrow="Every Friday" title={title}>
      <div className="jumuah-slide stagger">
        <div className="jumuah-times">
          <Panel accent className="jumuah-card">
            <div className="label">Adhaan</div>
            <div className="value numeric">{show(jumuah.adhaanTime)}</div>
          </Panel>
          <Panel accent className="jumuah-card">
            <div className="label">Khutbah &amp; Salaah</div>
            <div className="value numeric">{show(jumuah.salaahTime)}</div>
          </Panel>
        </div>

        {jumuah.second.enabled ? (
          <div className="jumuah-times">
            <Panel className="jumuah-card">
              <div className="label">{jumuah.second.label} · Adhaan</div>
              <div className="value numeric">{show(jumuah.second.adhaanTime)}</div>
            </Panel>
            <Panel className="jumuah-card">
              <div className="label">{jumuah.second.label} · Salaah</div>
              <div className="value numeric">{show(jumuah.second.salaahTime)}</div>
            </Panel>
          </div>
        ) : null}

        {jumuah.note ? <div className="jumuah-note">{jumuah.note}</div> : null}
      </div>
    </SlideShell>
  );
}

// --- islamic calendar -------------------------------------------------------------

export function OccasionsSlide({ ctx, title }: { ctx: SlideContext; title: string }) {
  const occasions = upcomingOccasions(ctx.now, ctx.config.calculation.hijriAdjustment, 4);

  return (
    <SlideShell
      eyebrow="Islamic Calendar"
      title={title}
      aside={<span className="chip">Subject to moon sighting</span>}
    >
      {occasions.length === 0 ? (
        <EmptyState glyph="☾" headline="No upcoming occasions" />
      ) : (
        <div className="occasion-grid stagger">
          {occasions.map((occasion) => (
            <Panel key={occasion.name} className="occasion-card">
              <div>
                <div className="name">{occasion.name}</div>
                <div className="when">
                  {occasion.gregorianDate.getDate()}{' '}
                  {MONTH_NAMES[occasion.gregorianDate.getMonth()]}{' '}
                  {occasion.gregorianDate.getFullYear()}
                  {occasion.note ? ` · ${occasion.note}` : ''}
                </div>
              </div>
              <div className="countdown">
                <div className="number numeric">{occasion.daysAway}</div>
                <div className="unit">{occasion.daysAway === 1 ? 'day' : 'days'}</div>
              </div>
            </Panel>
          ))}
        </div>
      )}
    </SlideShell>
  );
}

// --- qibla & masjid info ------------------------------------------------------------

export function QiblaSlide({ ctx, title }: { ctx: SlideContext; title: string }) {
  const { config } = ctx;
  const location = {
    latitude: config.location.latitude,
    longitude: config.location.longitude,
    elevation: config.location.elevation,
  };
  const bearing = qiblaDirection(location);
  const distance = distanceToKaaba(location);
  const method = getMethod(config.calculation.method);

  const rows: Array<[string, string]> = [
    ['Masjid', config.masjid.name],
    ['Location', [config.masjid.suburb, config.masjid.city].filter(Boolean).join(', ') || '—'],
    ['Coordinates', `${location.latitude.toFixed(4)}°, ${location.longitude.toFixed(4)}°`],
    ['Distance to the Kaaba', `${Math.round(distance).toLocaleString('en-ZA')} km`],
    ['Calculation', method.name],
    ['Asr', config.calculation.asrJuristic === 'hanafi' ? 'Hanafi (2× shadow)' : 'Shafi‘i (1× shadow)'],
  ];

  if (config.masjid.phone) rows.push(['Telephone', config.masjid.phone]);
  if (config.masjid.website) rows.push(['Website', config.masjid.website]);

  return (
    <SlideShell eyebrow="Direction of Prayer" title={title}>
      <div className="qibla-slide stagger">
        <Panel accent className="qibla-compass">
          <Compass bearing={bearing} />
          <div className="bearing numeric">{bearing.toFixed(1)}°</div>
          <div className="caption">from true north</div>
        </Panel>

        <Panel className="info-list">
          {rows.map(([label, value]) => (
            <div className="info-row" key={label}>
              <span className="label">{label}</span>
              <span className="value">{value}</span>
            </div>
          ))}
        </Panel>
      </div>
    </SlideShell>
  );
}

function Compass({ bearing }: { bearing: number }) {
  const size = 440;
  const centre = size / 2;
  const radius = centre - 22;

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden="true">
      <circle cx={centre} cy={centre} r={radius} fill="none" stroke="var(--line)" strokeWidth="2" />
      <circle cx={centre} cy={centre} r={radius - 16} fill="none" stroke="var(--line-soft)" strokeWidth="1" />

      {/* Degree ticks every 15°, with the cardinals drawn longer. */}
      {Array.from({ length: 24 }, (_, i) => {
        const angle = (i * 15 * Math.PI) / 180;
        const isCardinal = i % 6 === 0;
        const outer = radius;
        const inner = radius - (isCardinal ? 18 : 9);
        return (
          <line
            key={i}
            x1={centre + Math.sin(angle) * inner}
            y1={centre - Math.cos(angle) * inner}
            x2={centre + Math.sin(angle) * outer}
            y2={centre - Math.cos(angle) * outer}
            stroke={isCardinal ? 'var(--text-dim)' : 'var(--line-soft)'}
            strokeWidth={isCardinal ? 2.5 : 1.5}
          />
        );
      })}

      {(['N', 'E', 'S', 'W'] as const).map((label, i) => {
        const angle = (i * 90 * Math.PI) / 180;
        const r = radius - 40;
        return (
          <text
            key={label}
            x={centre + Math.sin(angle) * r}
            y={centre - Math.cos(angle) * r + 10}
            textAnchor="middle"
            fontSize="26"
            fontWeight="800"
            fill="var(--text-faint)"
          >
            {label}
          </text>
        );
      })}

      {/* The qibla needle. */}
      <g transform={`rotate(${bearing} ${centre} ${centre})`}>
        <line
          x1={centre}
          y1={centre}
          x2={centre}
          y2={centre - radius + 26}
          stroke="var(--gold)"
          strokeWidth="6"
          strokeLinecap="round"
        />
        <polygon
          points={`${centre},${centre - radius + 6} ${centre - 15},${centre - radius + 38} ${centre + 15},${centre - radius + 38}`}
          fill="var(--gold)"
        />
      </g>
      <circle cx={centre} cy={centre} r="10" fill="var(--accent)" />
    </svg>
  );
}
