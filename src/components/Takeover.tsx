import type { AlertsConfig, MasjidConfig } from '../lib/config';
import type { PrayerState } from '../lib/prayer-state';
import { formatDuration } from '../lib/time';

/**
 * The full-screen salaah takeovers. Around each prayer the deck steps aside for
 * three states in turn: the adhaan itself, the countdown to the iqamah, and the
 * congregation — the last deliberately quiet so the screen is not a distraction
 * in front of the saffs.
 */
export function Takeover({ state, config }: { state: PrayerState; config: MasjidConfig }) {
  const { alerts, display } = config;
  if (!state.prayer || !state.takeover) return null;

  switch (state.phase) {
    case 'adhaan':
      return <AdhaanTakeover state={state} alerts={alerts} showArabic={display.showArabic} />;
    case 'awaitingJamaat':
      return <IqamahTakeover state={state} />;
    case 'salaah':
      return <SalaahTakeover state={state} alerts={alerts} />;
    default:
      return null;
  }
}

function AdhaanTakeover({
  state,
  alerts,
  showArabic,
}: {
  state: PrayerState;
  alerts: AlertsConfig;
  showArabic: boolean;
}) {
  return (
    <div className="takeover">
      <div className="kicker">Adhaan</div>
      <h1 className="headline">{state.prayer!.name}</h1>
      {showArabic ? (
        <div className="arabic arabic-headline">حَيَّ عَلَى الصَّلَاة</div>
      ) : (
        <div className="subline">Hasten to the salaah</div>
      )}
      <div className="subline">Respond to the mu’adhin, then read the du‘a of the adhaan.</div>
      {alerts.phoneReminder ? (
        <div className="reminder">
          <PhoneGlyph />
          {alerts.phoneReminder}
        </div>
      ) : null}
    </div>
  );
}

function IqamahTakeover({ state }: { state: PrayerState }) {
  return (
    <div className="takeover">
      <div className="kicker">{state.prayer!.name} Jamaat in</div>
      <div className="countdown-huge numeric">{formatDuration(state.secondsRemaining)}</div>
      <div className="subline">
        Complete your sunnah salaah and straighten the saff — shoulder to shoulder.
      </div>
    </div>
  );
}

function SalaahTakeover({ state, alerts }: { state: PrayerState; alerts: AlertsConfig }) {
  return (
    <div className={`takeover ${alerts.blackoutDuringSalaah ? 'is-blackout' : ''}`}>
      {!alerts.blackoutDuringSalaah ? <div className="kicker">In Progress</div> : null}
      <h1 className="headline">{state.prayer!.name} Salaah</h1>
      {!alerts.blackoutDuringSalaah ? (
        <div className="subline">The board will return shortly, in shaa Allah.</div>
      ) : null}
    </div>
  );
}

function PhoneGlyph() {
  return (
    <svg width="34" height="34" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <rect x="6" y="2" width="12" height="20" rx="2.5" stroke="currentColor" strokeWidth="2" />
      <line x1="10.5" y1="18.5" x2="13.5" y2="18.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <line x1="3" y1="21" x2="21" y2="3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}
