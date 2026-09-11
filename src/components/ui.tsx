import type { ReactNode } from 'react';
import type { DisplayConfig } from '../lib/config';
import { formatClock } from '../lib/time';

/** A glass surface. `accent` gives it the lit border used for hero panels. */
export function Panel({
  children,
  className = '',
  accent = false,
  style,
}: {
  children: ReactNode;
  className?: string;
  accent?: boolean;
  style?: React.CSSProperties;
}) {
  return (
    <div className={`panel ${accent ? 'panel-accent' : ''} ${className}`.trim()} style={style}>
      {children}
    </div>
  );
}

/** Standard slide scaffolding: eyebrow, title, optional right-hand aside. */
export function SlideShell({
  eyebrow,
  title,
  aside,
  children,
}: {
  eyebrow?: string;
  title: string;
  aside?: ReactNode;
  children: ReactNode;
}) {
  return (
    <>
      <div className="slide-head">
        <div className="headings">
          {eyebrow ? <span className="eyebrow">{eyebrow}</span> : null}
          <h1 className="slide-title">{title}</h1>
        </div>
        {aside}
      </div>
      <div className="slide-body">{children}</div>
    </>
  );
}

export function EmptyState({ glyph, headline, detail }: { glyph: string; headline: string; detail?: string }) {
  return (
    <div className="empty-state">
      <div className="glyph">{glyph}</div>
      <div className="headline">{headline}</div>
      {detail ? <div style={{ fontSize: 24 }}>{detail}</div> : null}
    </div>
  );
}

/** Formats minutes-from-midnight according to the board's display settings. */
export function makeTimeFormatter(display: DisplayConfig) {
  return (minutes: number, withSeconds = false) =>
    formatClock(minutes, {
      hour12: display.hour12,
      showMeridiem: display.showMeridiem,
      showSeconds: withSeconds,
    });
}

/** Decorative separator used between title blocks. */
export function Ornament() {
  return (
    <div className="quote-ornament">
      <svg width="42" height="42" viewBox="0 0 42 42" aria-hidden="true">
        <path
          d="M21 3 L30 12 L39 21 L30 30 L21 39 L12 30 L3 21 L12 12 Z"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
        />
        <circle cx="21" cy="21" r="5" fill="none" stroke="currentColor" strokeWidth="1.5" />
      </svg>
    </div>
  );
}
