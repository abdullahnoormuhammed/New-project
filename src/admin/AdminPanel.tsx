import { useState } from 'react';
import { useConfig } from '../state/ConfigContext';
import {
  activeAnnouncements,
  activeJanazah,
  upcomingEvents,
} from '../lib/slide-plan';
import {
  AnnouncementsSection,
  ClassesSection,
  EventsSection,
  JanazahSection,
  QuotesSection,
} from './sections/ContentSections';
import {
  AlertsSection,
  BackupSection,
  CalculationSection,
  DisplaySection,
  MasjidSection,
  PasscodeSection,
  ScreensSection,
  SlidesSection,
  TimesSection,
} from './sections/SetupSections';

type SectionId =
  | 'masjid'
  | 'calculation'
  | 'times'
  | 'slides'
  | 'announcements'
  | 'events'
  | 'janazah'
  | 'quotes'
  | 'classes'
  | 'display'
  | 'alerts'
  | 'passcode'
  | 'screens'
  | 'backup';

const NAV: Array<{ id: SectionId; label: string; group: string }> = [
  { id: 'masjid', label: 'Masjid', group: 'Setup' },
  { id: 'calculation', label: 'Location & Calculation', group: 'Setup' },
  { id: 'times', label: 'Adhaan & Jamaat', group: 'Setup' },
  { id: 'slides', label: 'Slides', group: 'Setup' },
  { id: 'announcements', label: 'Announcements', group: 'Content' },
  { id: 'events', label: 'Programmes', group: 'Content' },
  { id: 'janazah', label: 'Janazah Notices', group: 'Content' },
  { id: 'quotes', label: 'Ayah & Hadith', group: 'Content' },
  { id: 'classes', label: 'Madrasah', group: 'Content' },
  { id: 'screens', label: 'Screens', group: 'Board' },
  { id: 'display', label: 'Display', group: 'Board' },
  { id: 'alerts', label: 'Salaah Alerts', group: 'Board' },
  { id: 'passcode', label: 'Passcode', group: 'Board' },
  { id: 'backup', label: 'Backup & Restore', group: 'Board' },
];

/**
 * The management panel. Every edit is written straight to local storage and the
 * board picks it up immediately — there is no save button to forget.
 */
export function AdminPanel({ onClose }: { onClose: () => void }) {
  const { config, update, replace, reset, saveError } = useConfig();
  const [section, setSection] = useState<SectionId>('masjid');
  const today = new Date();

  const counts: Partial<Record<SectionId, number>> = {
    announcements: activeAnnouncements(config.announcements, today).length,
    events: upcomingEvents(config.events, today).length,
    janazah: activeJanazah(config.janazah, today).length,
    quotes: config.quotes.filter((q) => q.enabled).length,
    classes: config.classes.filter((c) => c.enabled).length,
    slides: config.slides.filter((s) => s.enabled).length,
  };

  let lastGroup = '';

  return (
    <div className="admin">
      <aside className="admin-sidebar">
        <div className="admin-brand">
          <div className="title">{config.masjid.name || 'Masjid Board'}</div>
          <div className="subtitle">Board management</div>
        </div>

        <nav className="admin-nav">
          {NAV.map((item) => {
            const showGroup = item.group !== lastGroup;
            lastGroup = item.group;
            return (
              <div key={item.id}>
                {showGroup ? (
                  <div
                    style={{
                      fontSize: 11,
                      fontWeight: 800,
                      letterSpacing: '0.16em',
                      textTransform: 'uppercase',
                      color: '#5f7f77',
                      padding: '14px 14px 6px',
                    }}
                  >
                    {item.group}
                  </div>
                ) : null}
                <button
                  type="button"
                  className={section === item.id ? 'is-active' : ''}
                  onClick={() => setSection(item.id)}
                >
                  <span>{item.label}</span>
                  {counts[item.id] !== undefined ? (
                    <span className="count">{counts[item.id]}</span>
                  ) : null}
                </button>
              </div>
            );
          })}
        </nav>

        <div className="admin-sidebar-footer">
          <button className="btn btn-primary" type="button" onClick={onClose}>
            ← Back to the board
          </button>
          <span style={{ fontSize: 12, color: '#6d8c84', lineHeight: 1.5 }}>
            Changes save as you type — the board updates straight away.
          </span>
        </div>
      </aside>

      <main className="admin-main">
        {saveError ? <div className="admin-banner is-warning">{saveError}</div> : null}

        {section === 'masjid' ? <MasjidSection config={config} update={update} /> : null}
        {section === 'calculation' ? <CalculationSection config={config} update={update} /> : null}
        {section === 'times' ? <TimesSection config={config} update={update} /> : null}
        {section === 'slides' ? <SlidesSection config={config} update={update} /> : null}
        {section === 'announcements' ? <AnnouncementsSection config={config} update={update} /> : null}
        {section === 'events' ? <EventsSection config={config} update={update} /> : null}
        {section === 'janazah' ? <JanazahSection config={config} update={update} /> : null}
        {section === 'quotes' ? <QuotesSection config={config} update={update} /> : null}
        {section === 'classes' ? <ClassesSection config={config} update={update} /> : null}
        {section === 'screens' ? <ScreensSection /> : null}
        {section === 'display' ? <DisplaySection config={config} update={update} /> : null}
        {section === 'alerts' ? <AlertsSection config={config} update={update} /> : null}
        {section === 'passcode' ? <PasscodeSection config={config} update={update} /> : null}
        {section === 'backup' ? (
          <BackupSection config={config} replace={replace} reset={reset} />
        ) : null}
      </main>
    </div>
  );
}
