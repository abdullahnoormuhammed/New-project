import { useMemo, useRef, useState } from 'react';
import {
  SLIDE_LABELS,
  createId,
  type AdhaanRule,
  type JamaatRule,
  type MasjidConfig,
  type ScheduleOverride,
  type SlideConfig,
  type ThemeId,
} from '../../lib/config';
import {
  CALCULATION_METHODS,
  PRAYER_KEYS,
  type AsrJuristic,
  type CalculationMethodId,
  type HighLatitudeRule,
  type PrayerKey,
} from '../../lib/prayer-times';
import { PRAYER_LABELS, buildDaySchedule, prayerLabel } from '../../lib/schedule';
import { describeSlide } from '../../lib/slide-plan';
import { WEEKDAY_NAMES, type Rounding } from '../../lib/time';
import { exportConfig, importConfig } from '../../lib/storage';
import { checkPasscode, forgetUnlock, hashPasscode, isValidPasscode } from '../../lib/passcode';
import {
  Field,
  NumberField,
  SelectField,
  Section,
  Switch,
  TextAreaField,
  TextField,
  TimeField,
  moveItem,
} from '../fields';
import { makeTimeFormatter } from '../../components/ui';
import type { SectionProps } from './ContentSections';

// --- masjid identity ---------------------------------------------------------------

export function MasjidSection({ config, update }: SectionProps) {
  const fileRef = useRef<HTMLInputElement>(null);

  const readLogo = (file: File) => {
    const reader = new FileReader();
    reader.onload = () => {
      // Stored as a data URL so the logo travels with an exported config.
      update((prev) => ({ ...prev, masjid: { ...prev.masjid, logoDataUrl: String(reader.result) } }));
    };
    reader.readAsDataURL(file);
  };

  return (
    <>
      <h1>Masjid</h1>
      <p className="lede">The name and details printed across the top of every slide.</p>

      <Section title="Identity">
        <div className="field-grid">
          <TextField
            label="Masjid name"
            value={config.masjid.name}
            onChange={(name) => update((p) => ({ ...p, masjid: { ...p.masjid, name } }))}
          />
          <TextField
            label="Suburb"
            value={config.masjid.suburb}
            onChange={(suburb) => update((p) => ({ ...p, masjid: { ...p.masjid, suburb } }))}
          />
          <TextField
            label="City"
            value={config.masjid.city}
            onChange={(city) => update((p) => ({ ...p, masjid: { ...p.masjid, city } }))}
          />
          <TextField
            label="Telephone"
            value={config.masjid.phone}
            onChange={(phone) => update((p) => ({ ...p, masjid: { ...p.masjid, phone } }))}
          />
          <TextField
            label="Website"
            value={config.masjid.website}
            onChange={(website) => update((p) => ({ ...p, masjid: { ...p.masjid, website } }))}
          />
        </div>
      </Section>

      <Section title="Logo" hint="Shown beside the masjid name. A square PNG with a transparent background works best.">
        <div className="btn-row">
          {config.masjid.logoDataUrl ? (
            <img
              src={config.masjid.logoDataUrl}
              alt=""
              style={{ height: 64, width: 64, objectFit: 'contain', borderRadius: 10, background: 'rgba(255,255,255,0.06)' }}
            />
          ) : null}
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            style={{ display: 'none' }}
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) readLogo(file);
              event.target.value = '';
            }}
          />
          <button className="btn" type="button" onClick={() => fileRef.current?.click()}>
            {config.masjid.logoDataUrl ? 'Replace logo' : 'Upload logo'}
          </button>
          {config.masjid.logoDataUrl ? (
            <button
              className="btn btn-danger"
              type="button"
              onClick={() => update((p) => ({ ...p, masjid: { ...p.masjid, logoDataUrl: null } }))}
            >
              Remove
            </button>
          ) : null}
        </div>
      </Section>
    </>
  );
}

// --- location & calculation ---------------------------------------------------------

const ASR_OPTIONS: Array<{ value: AsrJuristic; label: string }> = [
  { value: 'standard', label: 'Shafi‘i, Maliki, Hanbali — shadow ×1' },
  { value: 'hanafi', label: 'Hanafi — shadow ×2' },
];

const HIGH_LAT_OPTIONS: Array<{ value: HighLatitudeRule; label: string }> = [
  { value: 'none', label: 'None — use the calculated angle' },
  { value: 'middleOfNight', label: 'Middle of the night' },
  { value: 'seventhOfNight', label: 'One seventh of the night' },
  { value: 'angleBased', label: 'Angle-based' },
];

const ROUNDING_OPTIONS: Array<{ value: Rounding; label: string }> = [
  { value: 'nearest', label: 'Nearest minute' },
  { value: 'up', label: 'Always round up — later' },
  { value: 'down', label: 'Always round down — earlier' },
];

export function CalculationSection({ config, update }: SectionProps) {
  const [locating, setLocating] = useState<string | null>(null);
  const calc = config.calculation;
  const patchCalc = (changes: Partial<MasjidConfig['calculation']>) =>
    update((p) => ({ ...p, calculation: { ...p.calculation, ...changes } }));

  const preview = useMemo(() => buildDaySchedule(config, new Date()), [config]);
  const format = makeTimeFormatter(config.display);

  const detectLocation = () => {
    if (!navigator.geolocation) {
      setLocating('This browser cannot report a location.');
      return;
    }
    setLocating('Locating…');
    navigator.geolocation.getCurrentPosition(
      (position) => {
        update((p) => ({
          ...p,
          location: {
            ...p.location,
            latitude: Number(position.coords.latitude.toFixed(5)),
            longitude: Number(position.coords.longitude.toFixed(5)),
            elevation: Math.max(0, Math.round(position.coords.altitude ?? p.location.elevation)),
          },
        }));
        setLocating('Location updated.');
      },
      (error) => setLocating(`Could not get a location: ${error.message}`),
    );
  };

  return (
    <>
      <h1>Location &amp; Calculation</h1>
      <p className="lede">
        Times are worked out on the device from the sun's position — no internet connection is
        needed. Set the masjid's coordinates accurately and pick the convention your community
        follows.
      </p>

      <Section title="Location">
        <div className="field-grid">
          <NumberField
            label="Latitude"
            value={config.location.latitude}
            step={0.0001}
            min={-90}
            max={90}
            onChange={(latitude) => update((p) => ({ ...p, location: { ...p.location, latitude } }))}
            note="Negative south of the equator."
          />
          <NumberField
            label="Longitude"
            value={config.location.longitude}
            step={0.0001}
            min={-180}
            max={180}
            onChange={(longitude) => update((p) => ({ ...p, location: { ...p.location, longitude } }))}
            note="Negative west of Greenwich."
          />
          <NumberField
            label="Elevation (m)"
            value={config.location.elevation}
            min={0}
            onChange={(elevation) => update((p) => ({ ...p, location: { ...p.location, elevation } }))}
            note="Lifts the horizon slightly for sunrise and sunset."
          />
          <Field
            label="Timezone"
            note="Leave on automatic unless the screen's clock is set to a different zone."
          >
            <select
              value={config.location.utcOffsetHours === null ? 'auto' : String(config.location.utcOffsetHours)}
              onChange={(event) => {
                const value = event.target.value;
                update((p) => ({
                  ...p,
                  location: {
                    ...p.location,
                    utcOffsetHours: value === 'auto' ? null : Number(value),
                  },
                }));
              }}
            >
              <option value="auto">Automatic — use this device</option>
              {Array.from({ length: 27 }, (_, i) => i - 12).map((offset) => (
                <option key={offset} value={offset}>
                  UTC{offset >= 0 ? '+' : ''}
                  {offset}
                </option>
              ))}
            </select>
          </Field>
        </div>
        <div className="btn-row" style={{ marginTop: 14 }}>
          <button className="btn" type="button" onClick={detectLocation}>
            Use this device's location
          </button>
          {locating ? <span className="note">{locating}</span> : null}
        </div>
      </Section>

      <Section title="Convention">
        <div className="field-grid">
          <SelectField
            label="Calculation method"
            value={calc.method}
            options={CALCULATION_METHODS.map((m) => ({ value: m.id as CalculationMethodId, label: m.name }))}
            onChange={(method) => patchCalc({ method })}
            note={CALCULATION_METHODS.find((m) => m.id === calc.method)?.description}
          />
          <SelectField
            label="Asr"
            value={calc.asrJuristic}
            options={ASR_OPTIONS}
            onChange={(asrJuristic) => patchCalc({ asrJuristic })}
          />
          <SelectField
            label="High latitude rule"
            value={calc.highLatitudeRule}
            options={HIGH_LAT_OPTIONS}
            onChange={(highLatitudeRule) => patchCalc({ highLatitudeRule })}
            note="Only needed far from the equator, where the sun may never reach the Fajr or Isha angle."
          />
          <SelectField
            label="Rounding"
            value={calc.rounding}
            options={ROUNDING_OPTIONS}
            onChange={(rounding) => patchCalc({ rounding })}
          />
        </div>

        {calc.method === 'Custom' ? (
          <div className="field-grid" style={{ marginTop: 16 }}>
            <NumberField
              label="Fajr angle (°)"
              value={calc.customFajrAngle}
              step={0.1}
              onChange={(customFajrAngle) => patchCalc({ customFajrAngle })}
            />
            <Field label="Isha">
              <select
                value={calc.customIshaParam.type}
                onChange={(event) =>
                  patchCalc({
                    customIshaParam:
                      event.target.value === 'angle'
                        ? { type: 'angle', value: 17 }
                        : { type: 'minutes', value: 90 },
                  })
                }
              >
                <option value="angle">By sun angle</option>
                <option value="minutes">Fixed minutes after Maghrib</option>
              </select>
            </Field>
            <NumberField
              label={calc.customIshaParam.type === 'angle' ? 'Isha angle (°)' : 'Minutes after Maghrib'}
              value={calc.customIshaParam.value}
              step={calc.customIshaParam.type === 'angle' ? 0.1 : 1}
              onChange={(value) =>
                patchCalc({ customIshaParam: { ...calc.customIshaParam, value } })
              }
            />
            <NumberField
              label="Dhuhr allowance after zawaal (min)"
              value={calc.dhuhrMinutes}
              min={0}
              max={15}
              onChange={(dhuhrMinutes) => patchCalc({ dhuhrMinutes })}
            />
          </div>
        ) : null}

        <div className="field-grid" style={{ marginTop: 16 }}>
          <NumberField
            label="Imsak before Fajr (min)"
            value={calc.imsakParam.value}
            min={0}
            max={60}
            onChange={(value) => patchCalc({ imsakParam: { type: 'minutes', value } })}
          />
          <NumberField
            label="Ishraaq after sunrise (min)"
            value={calc.ishraaqOffsetMinutes}
            min={0}
            max={60}
            onChange={(ishraaqOffsetMinutes) => patchCalc({ ishraaqOffsetMinutes })}
          />
          <NumberField
            label="Hijri date adjustment (days)"
            value={calc.hijriAdjustment}
            min={-3}
            max={3}
            onChange={(hijriAdjustment) => patchCalc({ hijriAdjustment })}
            note="Nudge the calculated Hijri date to match your sighting committee."
          />
        </div>

        <div className="btn-row" style={{ marginTop: 16 }}>
          <Switch
            label="Show both the Shafi‘i and Hanafi Asr"
            checked={calc.showBothAsr}
            onChange={(showBothAsr) => patchCalc({ showBothAsr })}
          />
          <Switch
            label="Hijri date rolls over at maghrib"
            checked={calc.hijriRollsAtMaghrib}
            onChange={(hijriRollsAtMaghrib) => patchCalc({ hijriRollsAtMaghrib })}
          />
        </div>
      </Section>

      <Section
        title="Per-prayer adjustment"
        hint="Minutes added to (or subtracted from) each calculated time, before your adhaan and jamaat rules are applied. Most masjids leave these at zero."
      >
        <div className="field-grid">
          {PRAYER_KEYS.map((key) => (
            <NumberField
              key={key}
              label={prayerLabel(key).name}
              value={calc.adjustments[key] ?? 0}
              min={-60}
              max={60}
              onChange={(value) =>
                patchCalc({ adjustments: { ...calc.adjustments, [key]: value } })
              }
            />
          ))}
        </div>
      </Section>

      <Section title="Today, as calculated" hint="A live check of the settings above against today's date.">
        <table className="preview-table">
          <thead>
            <tr>
              <th>Salaah</th>
              <th>Calculated</th>
              <th>Adhaan</th>
              <th>Jamaat</th>
            </tr>
          </thead>
          <tbody>
            {preview.prayers.map((prayer) => (
              <tr key={prayer.key}>
                <td>{prayer.name}</td>
                <td className="numeric">{format(prayer.calculated)}</td>
                <td className="numeric">{format(prayer.adhaan)}</td>
                <td className="numeric">{format(prayer.jamaat)}</td>
              </tr>
            ))}
            <tr>
              <td>Sunrise</td>
              <td className="numeric">{format(preview.solar.sunrise)}</td>
              <td colSpan={2} />
            </tr>
            <tr>
              <td>Sunset</td>
              <td className="numeric">{format(preview.solar.sunset)}</td>
              <td colSpan={2} />
            </tr>
          </tbody>
        </table>
      </Section>
    </>
  );
}

// --- salaah times -------------------------------------------------------------------

export function TimesSection({ config, update }: SectionProps) {
  const patchPrayer = (key: PrayerKey, changes: Partial<{ adhaan: AdhaanRule; jamaat: JamaatRule }>) =>
    update((p) => ({
      ...p,
      prayers: { ...p.prayers, [key]: { ...p.prayers[key], ...changes } },
    }));

  return (
    <>
      <h1>Adhaan &amp; Jamaat</h1>
      <p className="lede">
        For each salaah, decide whether the adhaan follows the calculated time or is called at a
        fixed hour, and how the jamaat relates to it.
      </p>

      {PRAYER_LABELS.map(({ key, name }) => {
        const schedule = config.prayers[key];
        return (
          <Section key={key} title={name}>
            <div className="field-grid">
              <Field label="Adhaan">
                <select
                  value={schedule.adhaan.mode}
                  onChange={(event) =>
                    patchPrayer(key, {
                      adhaan:
                        event.target.value === 'fixed'
                          ? { mode: 'fixed', time: '12:00' }
                          : { mode: 'calculated', offsetMinutes: 0 },
                    })
                  }
                >
                  <option value="calculated">Follow the calculated time</option>
                  <option value="fixed">Fixed time</option>
                </select>
              </Field>

              {schedule.adhaan.mode === 'calculated' ? (
                <NumberField
                  label="Minutes after the calculated time"
                  value={schedule.adhaan.offsetMinutes}
                  min={-30}
                  max={60}
                  onChange={(offsetMinutes) =>
                    patchPrayer(key, { adhaan: { mode: 'calculated', offsetMinutes } })
                  }
                />
              ) : (
                <TimeField
                  label="Adhaan at"
                  value={schedule.adhaan.time}
                  onChange={(time) => patchPrayer(key, { adhaan: { mode: 'fixed', time } })}
                />
              )}

              <Field label="Jamaat">
                <select
                  value={schedule.jamaat.mode}
                  onChange={(event) => {
                    const mode = event.target.value as JamaatRule['mode'];
                    patchPrayer(key, {
                      jamaat:
                        mode === 'fixed'
                          ? { mode: 'fixed', time: '12:20' }
                          : mode === 'rounded'
                            ? { mode: 'rounded', minutes: 10, step: 15 }
                            : { mode: 'offset', minutes: 15 },
                    });
                  }}
                >
                  <option value="offset">A set number of minutes after the adhaan</option>
                  <option value="fixed">Fixed time</option>
                  <option value="rounded">After the adhaan, rounded up to a step</option>
                </select>
              </Field>

              {schedule.jamaat.mode === 'offset' ? (
                <NumberField
                  label="Minutes after the adhaan"
                  value={schedule.jamaat.minutes}
                  min={0}
                  max={90}
                  onChange={(minutes) => patchPrayer(key, { jamaat: { mode: 'offset', minutes } })}
                />
              ) : null}

              {schedule.jamaat.mode === 'fixed' ? (
                <TimeField
                  label="Jamaat at"
                  value={schedule.jamaat.time}
                  onChange={(time) => patchPrayer(key, { jamaat: { mode: 'fixed', time } })}
                />
              ) : null}

              {schedule.jamaat.mode === 'rounded' ? (
                <>
                  <NumberField
                    label="Minutes after the adhaan"
                    value={schedule.jamaat.minutes}
                    min={0}
                    max={90}
                    onChange={(minutes) =>
                      patchPrayer(key, { jamaat: { mode: 'rounded', minutes, step: (schedule.jamaat as { step: number }).step } })
                    }
                  />
                  <NumberField
                    label="Round up to the next (min)"
                    value={schedule.jamaat.step}
                    min={1}
                    max={60}
                    onChange={(step) =>
                      patchPrayer(key, { jamaat: { mode: 'rounded', minutes: (schedule.jamaat as { minutes: number }).minutes, step } })
                    }
                    note="15 gives a jamaat on the quarter hour."
                  />
                </>
              ) : null}
            </div>
          </Section>
        );
      })}

      <JumuahEditor config={config} update={update} />
      <OverridesEditor config={config} update={update} />
    </>
  );
}

function JumuahEditor({ config, update }: SectionProps) {
  const patch = (changes: Partial<MasjidConfig['jumuah']>) =>
    update((p) => ({ ...p, jumuah: { ...p.jumuah, ...changes } }));

  return (
    <Section title="Jumu‘ah" hint="Replaces Dhuhr on the board every Friday.">
      <div className="btn-row" style={{ marginBottom: 16 }}>
        <Switch label="Jumu‘ah is held here" checked={config.jumuah.enabled} onChange={(enabled) => patch({ enabled })} />
      </div>

      <div className="field-grid">
        <TextField label="Label" value={config.jumuah.label} onChange={(label) => patch({ label })} />
        <TimeField label="Adhaan" value={config.jumuah.adhaanTime} onChange={(adhaanTime) => patch({ adhaanTime })} />
        <TimeField label="Khutbah &amp; salaah" value={config.jumuah.salaahTime} onChange={(salaahTime) => patch({ salaahTime })} />
      </div>

      <div style={{ marginTop: 16 }}>
        <TextAreaField
          label="Note shown under the Jumu‘ah slide"
          value={config.jumuah.note}
          onChange={(note) => patch({ note })}
          rows={2}
        />
      </div>

      <div className="btn-row" style={{ marginTop: 18, marginBottom: 12 }}>
        <Switch
          label="A second jamaat is held"
          checked={config.jumuah.second.enabled}
          onChange={(enabled) => patch({ second: { ...config.jumuah.second, enabled } })}
        />
      </div>

      {config.jumuah.second.enabled ? (
        <div className="field-grid">
          <TextField
            label="Label"
            value={config.jumuah.second.label}
            onChange={(label) => patch({ second: { ...config.jumuah.second, label } })}
          />
          <TimeField
            label="Adhaan"
            value={config.jumuah.second.adhaanTime}
            onChange={(adhaanTime) => patch({ second: { ...config.jumuah.second, adhaanTime } })}
          />
          <TimeField
            label="Salaah"
            value={config.jumuah.second.salaahTime}
            onChange={(salaahTime) => patch({ second: { ...config.jumuah.second, salaahTime } })}
          />
        </div>
      ) : null}
    </Section>
  );
}

function OverridesEditor({ config, update }: SectionProps) {
  const write = (overrides: ScheduleOverride[]) => update({ overrides });

  const patch = (id: string, changes: Partial<ScheduleOverride>) =>
    write(config.overrides.map((o) => (o.id === id ? { ...o, ...changes } : o)));

  return (
    <Section
      title="Weekday &amp; holiday overrides"
      hint="For schedules that differ on certain days — the Sunday and public-holiday Dhuhr, for instance. An override replaces the normal rule for the prayers you list."
    >
      <div className="btn-row" style={{ marginBottom: 16 }}>
        <button
          className="btn btn-primary"
          type="button"
          onClick={() =>
            write([
              ...config.overrides,
              {
                id: createId('ovr'),
                label: 'New override',
                weekdays: [],
                dates: [],
                enabled: true,
                prayers: {},
              },
            ])
          }
        >
          + Add override
        </button>
      </div>

      {config.overrides.map((override) => (
        <div className="item-card" key={override.id}>
          <div className="item-card-head">
            <span className="index">{override.label}</span>
            <div className="btn-row">
              <Switch
                label="Active"
                checked={override.enabled}
                onChange={(enabled) => patch(override.id, { enabled })}
              />
              <button
                className="btn btn-danger"
                type="button"
                onClick={() => write(config.overrides.filter((o) => o.id !== override.id))}
              >
                Delete
              </button>
            </div>
          </div>

          <div className="field-grid">
            <TextField
              label="Label"
              value={override.label}
              onChange={(label) => patch(override.id, { label })}
              note="Printed on the board beside the affected row."
            />
            <TextField
              label="Specific dates"
              value={override.dates.join(', ')}
              onChange={(value) =>
                patch(override.id, {
                  dates: value
                    .split(',')
                    .map((d) => d.trim())
                    .filter(Boolean),
                })
              }
              placeholder="2026-12-16, 2026-12-25"
              note="Comma-separated, YYYY-MM-DD. Use for public holidays."
            />
          </div>

          <div style={{ marginTop: 14 }}>
            <label style={{ fontSize: 12.5, fontWeight: 800, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#7ea497' }}>
              Days of the week
            </label>
            <div className="btn-row" style={{ marginTop: 8 }}>
              {WEEKDAY_NAMES.map((name, index) => (
                <Switch
                  key={name}
                  label={name.slice(0, 3)}
                  checked={override.weekdays.includes(index)}
                  onChange={(checked) =>
                    patch(override.id, {
                      weekdays: checked
                        ? [...override.weekdays, index].sort()
                        : override.weekdays.filter((d) => d !== index),
                    })
                  }
                />
              ))}
            </div>
          </div>

          <div style={{ marginTop: 18 }}>
            {PRAYER_LABELS.map(({ key, name }) => {
              const entry = override.prayers[key];
              const adhaanTime = entry?.adhaan?.mode === 'fixed' ? entry.adhaan.time : '';
              const jamaatTime = entry?.jamaat?.mode === 'fixed' ? entry.jamaat.time : '';
              return (
                <div key={key} className="field-grid" style={{ marginBottom: 10, alignItems: 'end' }}>
                  <Switch
                    label={`Override ${name}`}
                    checked={Boolean(entry)}
                    onChange={(checked) =>
                      patch(override.id, {
                        prayers: checked
                          ? {
                              ...override.prayers,
                              [key]: {
                                adhaan: { mode: 'fixed', time: '12:15' },
                                jamaat: { mode: 'fixed', time: '12:30' },
                              },
                            }
                          : Object.fromEntries(
                              Object.entries(override.prayers).filter(([k]) => k !== key),
                            ),
                      })
                    }
                  />
                  {entry ? (
                    <>
                      <TimeField
                        label="Adhaan"
                        value={adhaanTime}
                        onChange={(time) =>
                          patch(override.id, {
                            prayers: {
                              ...override.prayers,
                              [key]: { ...entry, adhaan: { mode: 'fixed', time } },
                            },
                          })
                        }
                      />
                      <TimeField
                        label="Jamaat"
                        value={jamaatTime}
                        onChange={(time) =>
                          patch(override.id, {
                            prayers: {
                              ...override.prayers,
                              [key]: { ...entry, jamaat: { mode: 'fixed', time } },
                            },
                          })
                        }
                      />
                    </>
                  ) : null}
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </Section>
  );
}

// --- slides ---------------------------------------------------------------------------

export function SlidesSection({ config, update }: SectionProps) {
  const today = new Date();
  const write = (slides: SlideConfig[]) => update({ slides });

  return (
    <>
      <h1>Slides</h1>
      <p className="lede">
        The order the board cycles through. A slide with nothing to show is skipped automatically, so
        you can leave them all switched on and the board only ever shows what you have content for.
      </p>

      <Section title="Rotation">
        {config.slides.map((slide, index) => (
          <div className="slide-row" key={slide.id}>
            <div className="order">
              <button
                type="button"
                disabled={index === 0}
                onClick={() => write(moveItem(config.slides, index, -1))}
              >
                ↑
              </button>
              <button
                type="button"
                disabled={index === config.slides.length - 1}
                onClick={() => write(moveItem(config.slides, index, 1))}
              >
                ↓
              </button>
            </div>

            <div>
              <div className="name">{slide.title?.trim() || SLIDE_LABELS[slide.type]}</div>
              <div className="detail">{describeSlide(slide.type, config, today)}</div>
            </div>

            <input
              type="text"
              value={slide.title ?? ''}
              placeholder="Custom heading"
              onChange={(event) =>
                write(
                  config.slides.map((s) =>
                    s.id === slide.id ? { ...s, title: event.target.value } : s,
                  ),
                )
              }
            />

            <input
              type="number"
              min={5}
              max={600}
              value={slide.durationSeconds}
              onChange={(event) => {
                const durationSeconds = Number(event.target.value);
                if (!Number.isFinite(durationSeconds)) return;
                write(
                  config.slides.map((s) => (s.id === slide.id ? { ...s, durationSeconds } : s)),
                );
              }}
            />

            <Switch
              label=""
              checked={slide.enabled}
              onChange={(enabled) =>
                write(config.slides.map((s) => (s.id === slide.id ? { ...s, enabled } : s)))
              }
            />
          </div>
        ))}
        <p className="hint" style={{ marginTop: 12, marginBottom: 0 }}>
          The number column is how long each slide holds, in seconds.
        </p>
      </Section>
    </>
  );
}

// --- display ---------------------------------------------------------------------------

const THEMES: Array<{ id: ThemeId; name: string; colours: [string, string, string] }> = [
  { id: 'emerald', name: 'Emerald', colours: ['#03100d', '#0a2b22', '#2dd4a7'] },
  { id: 'midnight', name: 'Midnight', colours: ['#050916', '#101c3d', '#7aa2ff'] },
  { id: 'gold', name: 'Gold', colours: ['#0f0b05', '#2a1e0e', '#e5b567'] },
  { id: 'slate', name: 'Slate', colours: ['#0a0d10', '#1c262e', '#67e8f9'] },
  { id: 'ramadan', name: 'Ramadan', colours: ['#0c0618', '#241243', '#c084fc'] },
];

export function DisplaySection({ config, update }: SectionProps) {
  const patch = (changes: Partial<MasjidConfig['display']>) =>
    update((p) => ({ ...p, display: { ...p.display, ...changes } }));

  return (
    <>
      <h1>Display</h1>
      <p className="lede">How the board looks and how quickly it moves.</p>

      <Section title="Theme">
        <div className="theme-swatches">
          {THEMES.map((theme) => (
            <button
              key={theme.id}
              type="button"
              className={`theme-swatch ${config.display.theme === theme.id ? 'is-active' : ''}`}
              onClick={() => patch({ theme: theme.id })}
            >
              <div className="preview">
                {theme.colours.map((colour) => (
                  <span key={colour} style={{ background: colour }} />
                ))}
              </div>
              <div className="caption">{theme.name}</div>
            </button>
          ))}
        </div>
      </Section>

      <Section title="Clock &amp; rotation">
        <div className="field-grid">
          <SelectField
            label="Clock"
            value={config.display.hour12 ? '12' : '24'}
            options={[
              { value: '12', label: '12-hour' },
              { value: '24', label: '24-hour' },
            ]}
            onChange={(value) => patch({ hour12: value === '12' })}
          />
          <SelectField
            label="Transition"
            value={config.display.transition}
            options={[
              { value: 'fade', label: 'Fade' },
              { value: 'slide', label: 'Slide' },
              { value: 'none', label: 'None' },
            ]}
            onChange={(transition) => patch({ transition })}
          />
          <NumberField
            label="Default slide length (s)"
            value={config.display.defaultSlideSeconds}
            min={5}
            max={600}
            onChange={(defaultSlideSeconds) => patch({ defaultSlideSeconds })}
          />
          <TextField
            label="Footer text"
            value={config.display.footerText}
            onChange={(footerText) => patch({ footerText })}
            note="Optional — a committee name or a web address."
          />
        </div>

        <div className="btn-row" style={{ marginTop: 16 }}>
          <Switch label="Show seconds" checked={config.display.showSeconds} onChange={(showSeconds) => patch({ showSeconds })} />
          <Switch label="Show AM/PM" checked={config.display.showMeridiem} onChange={(showMeridiem) => patch({ showMeridiem })} />
          <Switch label="Show Arabic" checked={config.display.showArabic} onChange={(showArabic) => patch({ showArabic })} />
        </div>
      </Section>

      <Section title="Notice ticker" hint="The line that scrolls along the bottom of every slide. One message per line.">
        <div className="btn-row" style={{ marginBottom: 14 }}>
          <Switch
            label="Show the ticker"
            checked={config.display.tickerEnabled}
            onChange={(tickerEnabled) => patch({ tickerEnabled })}
          />
        </div>
        <TextAreaField
          label="Messages"
          value={config.display.tickerMessages.join('\n')}
          onChange={(value) => patch({ tickerMessages: value.split('\n') })}
          rows={5}
        />
      </Section>

      <Section
        title="Overnight dimming"
        hint="Drops the screen's brightness through the night. Easier on the panel, and easier on anyone doing tahajjud."
      >
        <div className="btn-row" style={{ marginBottom: 14 }}>
          <Switch
            label="Dim overnight"
            checked={config.display.nightDimEnabled}
            onChange={(nightDimEnabled) => patch({ nightDimEnabled })}
          />
        </div>
        <div className="field-grid">
          <TimeField label="From" value={config.display.nightDimStart} onChange={(nightDimStart) => patch({ nightDimStart })} />
          <TimeField label="Until" value={config.display.nightDimEnd} onChange={(nightDimEnd) => patch({ nightDimEnd })} />
          <NumberField
            label="Brightness"
            value={config.display.nightDimOpacity}
            min={0.2}
            max={1}
            step={0.05}
            onChange={(nightDimOpacity) => patch({ nightDimOpacity })}
            note="1 is full brightness."
          />
        </div>
      </Section>
    </>
  );
}

// --- alerts -----------------------------------------------------------------------------

export function AlertsSection({ config, update }: SectionProps) {
  const patch = (changes: Partial<MasjidConfig['alerts']>) =>
    update((p) => ({ ...p, alerts: { ...p.alerts, ...changes } }));

  return (
    <>
      <h1>Salaah Alerts</h1>
      <p className="lede">
        Around each salaah the board stops rotating and takes over the screen: a countdown before the
        adhaan, the adhaan itself, the countdown to the iqamah, and finally a quiet screen while the
        jamaat is in progress.
      </p>

      <Section title="Behaviour">
        <div className="btn-row" style={{ marginBottom: 16 }}>
          <Switch label="Salaah alerts are on" checked={config.alerts.enabled} onChange={(enabled) => patch({ enabled })} />
          <Switch
            label="Show the countdown to the iqamah"
            checked={config.alerts.showIqamahCountdown}
            onChange={(showIqamahCountdown) => patch({ showIqamahCountdown })}
          />
          <Switch
            label="Blank the screen during salaah"
            checked={config.alerts.blackoutDuringSalaah}
            onChange={(blackoutDuringSalaah) => patch({ blackoutDuringSalaah })}
          />
        </div>

        <div className="field-grid">
          <NumberField
            label="Warning before adhaan (min)"
            value={config.alerts.preAdhaanMinutes}
            min={0}
            max={60}
            onChange={(preAdhaanMinutes) => patch({ preAdhaanMinutes })}
            note="Shown as a banner over the running slides."
          />
          <NumberField
            label="Adhaan screen holds for (min)"
            value={config.alerts.adhaanHoldMinutes}
            min={1}
            max={20}
            onChange={(adhaanHoldMinutes) => patch({ adhaanHoldMinutes })}
          />
          <TextField
            label="Phone reminder"
            value={config.alerts.phoneReminder}
            onChange={(phoneReminder) => patch({ phoneReminder })}
            note="Leave blank to hide it."
          />
        </div>
      </Section>

      <Section
        title="How long each salaah lasts"
        hint="The board stays on the quiet in-progress screen for this long after the iqamah, then returns to the slides."
      >
        <div className="field-grid">
          {PRAYER_KEYS.map((key) => (
            <NumberField
              key={key}
              label={prayerLabel(key).name}
              value={config.alerts.salaahInProgressMinutes[key]}
              min={1}
              max={90}
              onChange={(value) =>
                patch({
                  salaahInProgressMinutes: { ...config.alerts.salaahInProgressMinutes, [key]: value },
                })
              }
            />
          ))}
        </div>
      </Section>
    </>
  );
}

// --- backup --------------------------------------------------------------------------------

export function BackupSection({
  config,
  replace,
  reset,
}: {
  config: MasjidConfig;
  replace: (config: MasjidConfig) => void;
  reset: () => void;
}) {
  const [message, setMessage] = useState<{ kind: 'ok' | 'warning'; text: string } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const download = () => {
    const blob = new Blob([exportConfig(config)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `masjid-board-${new Date().toISOString().slice(0, 10)}.json`;
    link.click();
    URL.revokeObjectURL(url);
    setMessage({ kind: 'ok', text: 'Settings downloaded.' });
  };

  const load = (file: File) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = importConfig(String(reader.result));
      if (result.ok && result.config) {
        replace(result.config);
        setMessage({ kind: 'ok', text: 'Settings restored. The board has already updated.' });
      } else {
        setMessage({ kind: 'warning', text: result.error ?? 'That file could not be read.' });
      }
    };
    reader.readAsText(file);
  };

  return (
    <>
      <h1>Backup &amp; Restore</h1>
      <p className="lede">
        Everything — times, announcements, classes, theme — lives in this one file. Keep a copy
        somewhere safe: if the screen is ever replaced, restoring it is a single step.
      </p>

      {message ? <div className={`admin-banner is-${message.kind}`}>{message.text}</div> : null}

      <Section title="Settings file">
        <div className="btn-row">
          <button className="btn btn-primary" type="button" onClick={download}>
            Download settings
          </button>
          <input
            ref={fileRef}
            type="file"
            accept="application/json"
            style={{ display: 'none' }}
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) load(file);
              event.target.value = '';
            }}
          />
          <button className="btn" type="button" onClick={() => fileRef.current?.click()}>
            Restore from a file
          </button>
        </div>
      </Section>

      <Section
        title="Start again"
        hint="Clears everything on this screen and returns to the sample board. There is no undo."
      >
        <button
          className="btn btn-danger"
          type="button"
          onClick={() => {
            if (window.confirm('Reset every setting and all content back to the defaults?')) {
              reset();
              setMessage({ kind: 'ok', text: 'Everything has been reset.' });
            }
          }}
        >
          Reset everything
        </button>
      </Section>
    </>
  );
}

// --- passcode ------------------------------------------------------------------------------

export function PasscodeSection({ config, update }: SectionProps) {
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [hint, setHint] = useState(config.admin.hint);
  const [message, setMessage] = useState<{ kind: 'ok' | 'warning'; text: string } | null>(null);

  const save = async (event: React.FormEvent) => {
    event.preventDefault();
    const stored = config.admin.passcodeHash;

    if (stored && !(await checkPasscode(current, stored))) {
      setMessage({ kind: 'warning', text: 'The current passcode is not right.' });
      return;
    }
    if (!isValidPasscode(next)) {
      setMessage({ kind: 'warning', text: 'The new passcode must be at least four characters.' });
      return;
    }
    if (next !== confirm) {
      setMessage({ kind: 'warning', text: 'The two new passcodes do not match.' });
      return;
    }

    const passcodeHash = await hashPasscode(next);
    update((prev) => ({ ...prev, admin: { passcodeHash, hint: hint.trim() } }));
    setCurrent('');
    setNext('');
    setConfirm('');
    setMessage({ kind: 'ok', text: 'Passcode changed.' });
  };

  return (
    <>
      <h1>Passcode</h1>
      <p className="lede">
        The passcode that guards these settings. The board itself shows nothing about them — no
        button, no hint — so a passer-by has no way in.
      </p>

      {message ? <div className={`admin-banner is-${message.kind}`}>{message.text}</div> : null}

      <Section title="Change the passcode">
        <form onSubmit={save}>
          <div className="field-grid">
            {config.admin.passcodeHash ? (
              <Field label="Current passcode">
                <input
                  type="password"
                  value={current}
                  autoComplete="current-password"
                  onChange={(event) => {
                    setCurrent(event.target.value);
                    setMessage(null);
                  }}
                />
              </Field>
            ) : null}
            <Field label="New passcode">
              <input
                type="password"
                value={next}
                autoComplete="new-password"
                onChange={(event) => {
                  setNext(event.target.value);
                  setMessage(null);
                }}
              />
            </Field>
            <Field label="Type the new passcode again">
              <input
                type="password"
                value={confirm}
                autoComplete="new-password"
                onChange={(event) => {
                  setConfirm(event.target.value);
                  setMessage(null);
                }}
              />
            </Field>
            <TextField
              label="Reminder"
              value={hint}
              onChange={setHint}
              note="Shown on the lock screen. Never put the passcode itself here."
            />
          </div>
          <div className="btn-row" style={{ marginTop: 16 }}>
            <button className="btn btn-primary" type="submit">
              Save passcode
            </button>
          </div>
        </form>
      </Section>

      <Section
        title="Lock the settings"
        hint="The settings stay unlocked until this browser is closed. Lock them now if you are walking away from the screen."
      >
        <button
          className="btn"
          type="button"
          onClick={() => {
            forgetUnlock();
            window.location.reload();
          }}
        >
          Lock now
        </button>
      </Section>

      <Section title="If the passcode is lost">
        <p className="hint" style={{ marginBottom: 0 }}>
          There is no way to recover it. The board would have to be reset from the device itself —
          clear the browser's site data for this page, then set it up again from your backup file.
          Keep a current backup and you lose nothing but a few minutes.
        </p>
      </Section>
    </>
  );
}
