import {
  createId,
  type Announcement,
  type Appeal,
  type ClassEntry,
  type JanazahNotice,
  type MasjidConfig,
  type MasjidEvent,
  type Priority,
  type Quote,
} from '../../lib/config';
import {
  DateField,
  ItemCard,
  NumberField,
  SelectField,
  TextAreaField,
  TextField,
  moveItem,
} from '../fields';

export interface SectionProps {
  config: MasjidConfig;
  update: (patch: Partial<MasjidConfig> | ((prev: MasjidConfig) => MasjidConfig)) => void;
}

/**
 * The six content lists share one shape: add, reorder, toggle, edit, delete.
 * This builds those four callbacks for a given list on the config.
 */
function listOps<K extends keyof MasjidConfig, T extends { id: string; enabled: boolean }>(
  key: K,
  items: T[],
  update: SectionProps['update'],
) {
  const write = (next: T[]) => update({ [key]: next } as unknown as Partial<MasjidConfig>);
  return {
    add: (item: T) => write([...items, item]),
    patch: (id: string, changes: Partial<T>) =>
      write(items.map((item) => (item.id === id ? { ...item, ...changes } : item))),
    remove: (id: string) => write(items.filter((item) => item.id !== id)),
    move: (index: number, direction: -1 | 1) => write(moveItem(items, index, direction)),
  };
}

// --- announcements ----------------------------------------------------------------

const PRIORITY_OPTIONS: Array<{ value: Priority; label: string }> = [
  { value: 'normal', label: 'Normal' },
  { value: 'important', label: 'Important — amber marker' },
  { value: 'urgent', label: 'Urgent — red marker' },
];

export function AnnouncementsSection({ config, update }: SectionProps) {
  const ops = listOps('announcements', config.announcements, update);

  return (
    <>
      <h1>Announcements</h1>
      <p className="lede">
        Notices shown on the announcements slide. Three fit on a screen at a time; anything beyond
        that is split over further slides automatically. An announcement outside its date range is
        hidden without you having to remember to delete it.
      </p>

      <div className="btn-row" style={{ marginBottom: 18 }}>
        <button
          className="btn btn-primary"
          type="button"
          onClick={() =>
            ops.add({
              id: createId('ann'),
              title: 'New announcement',
              body: '',
              priority: 'normal',
              startDate: null,
              endDate: null,
              enabled: true,
            } as Announcement)
          }
        >
          + Add announcement
        </button>
      </div>

      {config.announcements.map((item, index) => (
        <ItemCard
          key={item.id}
          index={index}
          total={config.announcements.length}
          label="Announcement"
          enabled={item.enabled}
          onToggle={(enabled) => ops.patch(item.id, { enabled })}
          onMove={(direction) => ops.move(index, direction)}
          onDelete={() => ops.remove(item.id)}
        >
          <div className="field-grid">
            <TextField
              label="Title"
              value={item.title}
              onChange={(title) => ops.patch(item.id, { title })}
            />
            <SelectField
              label="Priority"
              value={item.priority}
              options={PRIORITY_OPTIONS}
              onChange={(priority) => ops.patch(item.id, { priority })}
            />
            <DateField
              label="Show from"
              value={item.startDate}
              onChange={(startDate) => ops.patch(item.id, { startDate })}
              note="Leave blank to start immediately."
            />
            <DateField
              label="Show until"
              value={item.endDate}
              onChange={(endDate) => ops.patch(item.id, { endDate })}
              note="Leave blank to show indefinitely."
            />
          </div>
          <div style={{ marginTop: 14 }}>
            <TextAreaField
              label="Message"
              value={item.body}
              onChange={(body) => ops.patch(item.id, { body })}
              note="Keep it to a few sentences — it is read from across the hall."
            />
          </div>
        </ItemCard>
      ))}
    </>
  );
}

// --- events -----------------------------------------------------------------------

export function EventsSection({ config, update }: SectionProps) {
  const ops = listOps('events', config.events, update);

  return (
    <>
      <h1>Programmes &amp; Events</h1>
      <p className="lede">
        Upcoming programmes, listed soonest first. Anything dated before today drops off the board on
        its own. Leave the date blank for a standing weekly programme.
      </p>

      <div className="btn-row" style={{ marginBottom: 18 }}>
        <button
          className="btn btn-primary"
          type="button"
          onClick={() =>
            ops.add({
              id: createId('ev'),
              title: 'New programme',
              date: '',
              time: '',
              speaker: '',
              location: '',
              enabled: true,
            } as MasjidEvent)
          }
        >
          + Add programme
        </button>
      </div>

      {config.events.map((item, index) => (
        <ItemCard
          key={item.id}
          index={index}
          total={config.events.length}
          label="Programme"
          enabled={item.enabled}
          onToggle={(enabled) => ops.patch(item.id, { enabled })}
          onMove={(direction) => ops.move(index, direction)}
          onDelete={() => ops.remove(item.id)}
        >
          <div className="field-grid">
            <TextField label="Title" value={item.title} onChange={(title) => ops.patch(item.id, { title })} />
            <DateField
              label="Date"
              value={item.date || null}
              onChange={(date) => ops.patch(item.id, { date: date ?? '' })}
              note="Blank for a standing programme."
            />
            <TextField
              label="Time"
              value={item.time}
              onChange={(time) => ops.patch(item.id, { time })}
              placeholder="19:30 or After Maghrib"
            />
            <TextField
              label="Speaker"
              value={item.speaker}
              onChange={(speaker) => ops.patch(item.id, { speaker })}
            />
            <TextField
              label="Venue"
              value={item.location}
              onChange={(location) => ops.patch(item.id, { location })}
            />
          </div>
        </ItemCard>
      ))}
    </>
  );
}

// --- janazah ----------------------------------------------------------------------

export function JanazahSection({ config, update }: SectionProps) {
  const ops = listOps('janazah', config.janazah, update);

  return (
    <>
      <h1>Janazah Notices</h1>
      <p className="lede">
        When there are no notices the slide is skipped entirely, so the board never shows an empty
        janazah screen. Set an expiry date and the notice removes itself after the burial.
      </p>

      <div className="btn-row" style={{ marginBottom: 18 }}>
        <button
          className="btn btn-primary"
          type="button"
          onClick={() =>
            ops.add({
              id: createId('jnz'),
              name: '',
              age: '',
              salaahTime: 'After Dhuhr Salaah',
              salaahVenue: config.masjid.name,
              burialVenue: '',
              expiresOn: null,
              enabled: true,
            } as JanazahNotice)
          }
        >
          + Add notice
        </button>
      </div>

      {config.janazah.length === 0 ? (
        <div className="admin-banner is-ok">
          No notices at present — the janazah slide is not in the rotation.
        </div>
      ) : null}

      {config.janazah.map((item, index) => (
        <ItemCard
          key={item.id}
          index={index}
          total={config.janazah.length}
          label="Notice"
          enabled={item.enabled}
          onToggle={(enabled) => ops.patch(item.id, { enabled })}
          onMove={(direction) => ops.move(index, direction)}
          onDelete={() => ops.remove(item.id)}
        >
          <div className="field-grid">
            <TextField
              label="Name of the deceased"
              value={item.name}
              onChange={(name) => ops.patch(item.id, { name })}
            />
            <TextField
              label="Age / description"
              value={item.age}
              onChange={(age) => ops.patch(item.id, { age })}
              placeholder="Aged 74 · of Sea Cow Lake"
            />
            <TextField
              label="Janazah salaah"
              value={item.salaahTime}
              onChange={(salaahTime) => ops.patch(item.id, { salaahTime })}
              placeholder="After Dhuhr Salaah"
            />
            <TextField
              label="Salaah venue"
              value={item.salaahVenue}
              onChange={(salaahVenue) => ops.patch(item.id, { salaahVenue })}
            />
            <TextField
              label="Burial"
              value={item.burialVenue}
              onChange={(burialVenue) => ops.patch(item.id, { burialVenue })}
              placeholder="Brook Street Cemetery"
            />
            <DateField
              label="Remove after"
              value={item.expiresOn}
              onChange={(expiresOn) => ops.patch(item.id, { expiresOn })}
            />
          </div>
        </ItemCard>
      ))}
    </>
  );
}

// --- appeals -----------------------------------------------------------------------

export function AppealsSection({ config, update }: SectionProps) {
  const ops = listOps('appeals', config.appeals, update);

  return (
    <>
      <h1>Appeals &amp; Fundraising</h1>
      <p className="lede">
        Each appeal gets its own slide with a progress meter. Update the raised amount whenever the
        treasurer reports in — the meter follows.
      </p>

      <div className="btn-row" style={{ marginBottom: 18 }}>
        <button
          className="btn btn-primary"
          type="button"
          onClick={() =>
            ops.add({
              id: createId('ap'),
              title: 'New appeal',
              description: '',
              currency: 'R',
              target: 100000,
              raised: 0,
              details: '',
              enabled: true,
            } as Appeal)
          }
        >
          + Add appeal
        </button>
      </div>

      {config.appeals.map((item, index) => (
        <ItemCard
          key={item.id}
          index={index}
          total={config.appeals.length}
          label="Appeal"
          enabled={item.enabled}
          onToggle={(enabled) => ops.patch(item.id, { enabled })}
          onMove={(direction) => ops.move(index, direction)}
          onDelete={() => ops.remove(item.id)}
        >
          <div className="field-grid">
            <TextField label="Title" value={item.title} onChange={(title) => ops.patch(item.id, { title })} />
            <TextField
              label="Currency symbol"
              value={item.currency}
              onChange={(currency) => ops.patch(item.id, { currency })}
            />
            <NumberField
              label="Target"
              value={item.target}
              min={0}
              step={1000}
              onChange={(target) => ops.patch(item.id, { target })}
            />
            <NumberField
              label="Raised so far"
              value={item.raised}
              min={0}
              step={100}
              onChange={(raised) => ops.patch(item.id, { raised })}
            />
          </div>
          <div style={{ marginTop: 14 }}>
            <TextAreaField
              label="Description"
              value={item.description}
              onChange={(description) => ops.patch(item.id, { description })}
            />
          </div>
          <div style={{ marginTop: 14 }}>
            <TextField
              label="Banking details / call to action"
              value={item.details}
              onChange={(details) => ops.patch(item.id, { details })}
              note="Shown in a highlighted box. Keep it to one line."
            />
          </div>
        </ItemCard>
      ))}
    </>
  );
}

// --- quotes ------------------------------------------------------------------------

const QUOTE_KINDS: Array<{ value: Quote['kind']; label: string }> = [
  { value: 'ayah', label: 'Ayah — from the Qur’an' },
  { value: 'hadith', label: 'Hadith — from the Sunnah' },
  { value: 'dua', label: 'Du‘a' },
];

export function QuotesSection({ config, update }: SectionProps) {
  const ops = listOps('quotes', config.quotes, update);

  return (
    <>
      <h1>Ayah &amp; Hadith</h1>
      <p className="lede">
        Each entry is given the full screen in turn. Arabic is rendered right-to-left in a naskh
        face; leave it blank to show the translation alone.
      </p>

      <div className="btn-row" style={{ marginBottom: 18 }}>
        <button
          className="btn btn-primary"
          type="button"
          onClick={() =>
            ops.add({
              id: createId('q'),
              arabic: '',
              translation: '',
              reference: '',
              kind: 'hadith',
              enabled: true,
            } as Quote)
          }
        >
          + Add entry
        </button>
      </div>

      {config.quotes.map((item, index) => (
        <ItemCard
          key={item.id}
          index={index}
          total={config.quotes.length}
          label="Entry"
          enabled={item.enabled}
          onToggle={(enabled) => ops.patch(item.id, { enabled })}
          onMove={(direction) => ops.move(index, direction)}
          onDelete={() => ops.remove(item.id)}
        >
          <div className="field-grid">
            <SelectField
              label="Type"
              value={item.kind}
              options={QUOTE_KINDS}
              onChange={(kind) => ops.patch(item.id, { kind })}
            />
            <TextField
              label="Reference"
              value={item.reference}
              onChange={(reference) => ops.patch(item.id, { reference })}
              placeholder="Sahih al-Bukhari 645"
            />
          </div>
          <div style={{ marginTop: 14 }}>
            <TextAreaField
              label="Arabic"
              value={item.arabic}
              onChange={(arabic) => ops.patch(item.id, { arabic })}
              rows={3}
              note="Optional. Paste with harakat for the best result."
            />
          </div>
          <div style={{ marginTop: 14 }}>
            <TextAreaField
              label="Translation"
              value={item.translation}
              onChange={(translation) => ops.patch(item.id, { translation })}
              rows={3}
            />
          </div>
        </ItemCard>
      ))}
    </>
  );
}

// --- classes -----------------------------------------------------------------------

export function ClassesSection({ config, update }: SectionProps) {
  const ops = listOps('classes', config.classes, update);

  return (
    <>
      <h1>Madrasah &amp; Ta‘leem</h1>
      <p className="lede">The standing class timetable, four to a slide.</p>

      <div className="btn-row" style={{ marginBottom: 18 }}>
        <button
          className="btn btn-primary"
          type="button"
          onClick={() =>
            ops.add({
              id: createId('cl'),
              title: 'New class',
              schedule: '',
              time: '',
              teacher: '',
              enabled: true,
            } as ClassEntry)
          }
        >
          + Add class
        </button>
      </div>

      {config.classes.map((item, index) => (
        <ItemCard
          key={item.id}
          index={index}
          total={config.classes.length}
          label="Class"
          enabled={item.enabled}
          onToggle={(enabled) => ops.patch(item.id, { enabled })}
          onMove={(direction) => ops.move(index, direction)}
          onDelete={() => ops.remove(item.id)}
        >
          <div className="field-grid">
            <TextField label="Title" value={item.title} onChange={(title) => ops.patch(item.id, { title })} />
            <TextField
              label="Days"
              value={item.schedule}
              onChange={(schedule) => ops.patch(item.id, { schedule })}
              placeholder="Monday — Thursday"
            />
            <TextField
              label="Time"
              value={item.time}
              onChange={(time) => ops.patch(item.id, { time })}
              placeholder="14:30 — 16:30"
            />
            <TextField
              label="Teacher"
              value={item.teacher}
              onChange={(teacher) => ops.patch(item.id, { teacher })}
            />
          </div>
        </ItemCard>
      ))}
    </>
  );
}
