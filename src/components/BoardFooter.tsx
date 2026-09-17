import { useMemo } from 'react';
import type { MasjidConfig } from '../lib/config';
import type { ResolvedPrayer } from '../lib/schedule';
import { formatDuration } from '../lib/time';

interface Props {
  config: MasjidConfig;
  nextPrayer: ResolvedPrayer;
  secondsToJamaat: number;
  nextIsTomorrow: boolean;
  slideCount: number;
  slideIndex: number;
  /** Set in the minutes before an adhaan; the pill takes the warning over. */
  adhaanWarning: { prayerName: string; seconds: number } | null;
}

/**
 * The persistent bottom bar: the live next-salaah countdown, the scrolling
 * notice ticker, and a progress indicator for the deck.
 *
 * In the minutes before an adhaan this same pill carries the warning, rather
 * than floating a second banner over the slides. The board is dense — anything
 * floating over it covers something — and a countdown to the adhaan belongs in
 * the place people already read countdowns.
 */
export function BoardFooter({
  config,
  nextPrayer,
  secondsToJamaat,
  nextIsTomorrow,
  slideCount,
  slideIndex,
  adhaanWarning,
}: Props) {
  const { display } = config;

  const messages = useMemo(
    () => display.tickerMessages.map((m) => m.trim()).filter(Boolean),
    [display.tickerMessages],
  );

  return (
    <footer className="board-footer">
      {adhaanWarning ? (
        <div className="next-pill is-alert">
          <div>
            <div className="label">Adhaan</div>
            <div className="prayer">{adhaanWarning.prayerName}</div>
          </div>
          <div className="countdown numeric">{formatDuration(adhaanWarning.seconds)}</div>
        </div>
      ) : (
        <div className="next-pill">
          <div>
            <div className="label">Next Salaah{nextIsTomorrow ? ' · Tomorrow' : ''}</div>
            <div className="prayer">{nextPrayer.name} Jamaat</div>
          </div>
          <div className="countdown numeric">{formatDuration(secondsToJamaat, true)}</div>
        </div>
      )}

      {display.tickerEnabled && messages.length > 0 ? (
        <Ticker messages={messages} />
      ) : (
        <div />
      )}

      <div className="footer-right">
        {display.footerText ? <span className="footer-brand">{display.footerText}</span> : null}
        <div className="slide-dots">
          {Array.from({ length: slideCount }, (_, i) => (
            <span key={i} className={`dot ${i === slideIndex ? 'is-active' : ''}`} />
          ))}
        </div>
      </div>
    </footer>
  );
}

/**
 * A seamless marquee. The list is rendered twice and the track translated by
 * exactly -50%, so the loop has no visible seam or jump.
 */
function Ticker({ messages }: { messages: string[] }) {
  // Roughly 90px of travel per second reads comfortably from across a hall.
  const totalChars = messages.join('').length;
  const durationSeconds = Math.max(18, Math.round((totalChars * 22) / 90));

  const items = [...messages, ...messages];

  return (
    <div className="ticker">
      <div className="ticker-track" style={{ animationDuration: `${durationSeconds}s` }}>
        {items.map((message, index) => (
          <span className="ticker-item" key={`${index}-${message.slice(0, 12)}`}>
            <span className="dot" />
            {message}
          </span>
        ))}
      </div>
    </div>
  );
}
