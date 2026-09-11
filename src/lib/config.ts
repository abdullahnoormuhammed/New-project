/**
 * The board's entire content and behaviour lives in one config object.
 * It is edited from the admin panel, persisted to localStorage, and can be
 * exported/imported as JSON so a committee can hand a file between screens.
 */

import type {
  AngleOrMinutes,
  AsrJuristic,
  CalculationMethodId,
  HighLatitudeRule,
  PrayerAdjustments,
  PrayerKey,
} from './prayer-times.ts';
import type { Rounding } from './time.ts';

export const CONFIG_VERSION = 1;

// --- schedule ------------------------------------------------------------------

export type AdhaanRule =
  /** Follow the calculated time, optionally nudged. */
  | { mode: 'calculated'; offsetMinutes: number }
  /** A fixed wall-clock time, "HH:MM" 24-hour. */
  | { mode: 'fixed'; time: string };

export type JamaatRule =
  /** A fixed wall-clock time, "HH:MM" 24-hour. */
  | { mode: 'fixed'; time: string }
  /** N minutes after the adhaan. */
  | { mode: 'offset'; minutes: number }
  /**
   * A fixed time that steps in whole increments as the season moves — the
   * "nearest 15 minutes after adhaan" pattern many masjids use for Asr/Isha.
   */
  | { mode: 'rounded'; minutes: number; step: number };

export interface PrayerSchedule {
  adhaan: AdhaanRule;
  jamaat: JamaatRule;
}

export interface ScheduleOverride {
  id: string;
  label: string;
  /** 0 = Sunday. Empty means "any weekday". */
  weekdays: number[];
  /** ISO "YYYY-MM-DD" dates this override also applies to (public holidays). */
  dates: string[];
  enabled: boolean;
  prayers: Partial<Record<PrayerKey, Partial<PrayerSchedule>>>;
}

export interface JumuahConfig {
  enabled: boolean;
  /** Label shown on the board, e.g. "Jumu'ah" or "Jumu'ah — 1st Jamaat". */
  label: string;
  adhaanTime: string;
  salaahTime: string;
  /** An optional second congregation for busy masjids. */
  second: { enabled: boolean; label: string; adhaanTime: string; salaahTime: string };
  /** Shown under the Jumu'ah panel, e.g. the khateeb's name. */
  note: string;
}

export interface CalculationConfig {
  method: CalculationMethodId;
  /** Used when method is 'Custom'. */
  customFajrAngle: number;
  customIshaParam: AngleOrMinutes;
  customMaghribParam: AngleOrMinutes;
  imsakParam: AngleOrMinutes;
  dhuhrMinutes: number;
  asrJuristic: AsrJuristic;
  /** Show both the Shafi'i and Hanafi Asr rows, as most South African boards do. */
  showBothAsr: boolean;
  highLatitudeRule: HighLatitudeRule;
  adjustments: PrayerAdjustments;
  rounding: Rounding;
  ishraaqOffsetMinutes: number;
  /** Whole-day nudge applied to the tabular Hijri date. */
  hijriAdjustment: number;
  /** Roll the Hijri date over at maghrib, as the Islamic day actually does. */
  hijriRollsAtMaghrib: boolean;
}

export interface LocationConfig {
  latitude: number;
  longitude: number;
  elevation: number;
  /** null means "use the device's own timezone". */
  utcOffsetHours: number | null;
}

// --- content -------------------------------------------------------------------

export type Priority = 'normal' | 'important' | 'urgent';

export interface Announcement {
  id: string;
  title: string;
  body: string;
  priority: Priority;
  /** ISO dates; null means no bound. */
  startDate: string | null;
  endDate: string | null;
  enabled: boolean;
}

export interface MasjidEvent {
  id: string;
  title: string;
  /** ISO date. */
  date: string;
  /** "HH:MM" or free text like "After Isha". */
  time: string;
  speaker: string;
  location: string;
  enabled: boolean;
}

export interface JanazahNotice {
  id: string;
  name: string;
  age: string;
  /** Free text: "After Dhuhr Salaah". */
  salaahTime: string;
  salaahVenue: string;
  burialVenue: string;
  /** ISO date the notice should stop showing. */
  expiresOn: string | null;
  enabled: boolean;
}

export interface Appeal {
  id: string;
  title: string;
  description: string;
  /** Currency symbol or code shown before the amounts. */
  currency: string;
  target: number;
  raised: number;
  /** Banking details, EFT reference, or a short call to action. */
  details: string;
  enabled: boolean;
}

export interface Quote {
  id: string;
  /** Arabic text, rendered right-to-left in a serif face. */
  arabic: string;
  translation: string;
  /** "Sahih al-Bukhari 6018" or "Surah Al-Baqarah 2:153". */
  reference: string;
  kind: 'ayah' | 'hadith' | 'dua';
  enabled: boolean;
}

export interface ClassEntry {
  id: string;
  title: string;
  /** "Daily", "Every Saturday", "Mon — Thu". */
  schedule: string;
  time: string;
  teacher: string;
  enabled: boolean;
}

// --- slides --------------------------------------------------------------------

export type SlideType =
  | 'prayerBoard'
  | 'nextSalaah'
  | 'announcements'
  | 'quote'
  | 'events'
  | 'janazah'
  | 'appeal'
  | 'classes'
  | 'jumuah'
  | 'occasions'
  | 'qibla';

export interface SlideConfig {
  id: string;
  type: SlideType;
  enabled: boolean;
  durationSeconds: number;
  /** Overrides the slide's built-in heading when set. */
  title?: string;
}

export const SLIDE_LABELS: Record<SlideType, string> = {
  prayerBoard: 'Salaah Timetable',
  nextSalaah: 'Next Salaah Countdown',
  announcements: 'Announcements',
  quote: 'Ayah & Hadith',
  events: 'Upcoming Programmes',
  janazah: 'Janazah Notices',
  appeal: 'Appeals & Fundraising',
  classes: 'Madrasah & Ta’leem',
  jumuah: "Jumu'ah Details",
  occasions: 'Islamic Calendar',
  qibla: 'Qibla & Masjid Info',
};

// --- display & alerts ----------------------------------------------------------

export type ThemeId = 'emerald' | 'midnight' | 'gold' | 'slate' | 'ramadan';

export interface DisplayConfig {
  theme: ThemeId;
  hour12: boolean;
  showMeridiem: boolean;
  showSeconds: boolean;
  /** Seconds a slide holds when the slide itself does not override it. */
  defaultSlideSeconds: number;
  transition: 'fade' | 'slide' | 'none';
  /** The scrolling strip along the bottom. */
  tickerEnabled: boolean;
  tickerMessages: string[];
  footerText: string;
  /** Dim the whole board overnight to save the panel. */
  nightDimEnabled: boolean;
  nightDimStart: string;
  nightDimEnd: string;
  nightDimOpacity: number;
  showArabic: boolean;
}

export interface AlertsConfig {
  enabled: boolean;
  /** Minutes before adhaan that the pre-adhaan banner appears. */
  preAdhaanMinutes: number;
  /** How long the full-screen adhaan takeover holds, in minutes. */
  adhaanHoldMinutes: number;
  /** Show a live countdown between adhaan and jamaat. */
  showIqamahCountdown: boolean;
  /** Blackout screen once jamaat starts, in minutes, per prayer. */
  salaahInProgressMinutes: Record<PrayerKey, number>;
  /** The "switch off your phone" reminder shown during the takeover. */
  phoneReminder: string;
  /** Optionally blank the screen entirely during salaah. */
  blackoutDuringSalaah: boolean;
}

// --- root ----------------------------------------------------------------------

export interface MasjidIdentity {
  name: string;
  suburb: string;
  city: string;
  /** A data URL so the logo travels inside the exported config. */
  logoDataUrl: string | null;
  website: string;
  phone: string;
}

export interface MasjidConfig {
  version: number;
  masjid: MasjidIdentity;
  location: LocationConfig;
  calculation: CalculationConfig;
  prayers: Record<PrayerKey, PrayerSchedule>;
  overrides: ScheduleOverride[];
  jumuah: JumuahConfig;
  display: DisplayConfig;
  alerts: AlertsConfig;
  slides: SlideConfig[];
  announcements: Announcement[];
  events: MasjidEvent[];
  janazah: JanazahNotice[];
  appeals: Appeal[];
  quotes: Quote[];
  classes: ClassEntry[];
}

// --- defaults ------------------------------------------------------------------

export function createId(prefix = 'id'): string {
  return `${prefix}_${Math.random().toString(36).slice(2, 9)}`;
}

export const DEFAULT_CONFIG: MasjidConfig = {
  version: CONFIG_VERSION,
  masjid: {
    name: 'Masjid Ut Taqwa',
    suburb: 'Sea Cow Lake',
    city: 'Durban',
    logoDataUrl: null,
    website: '',
    phone: '',
  },
  location: {
    latitude: -29.7833,
    longitude: 31.0167,
    elevation: 20,
    utcOffsetHours: null,
  },
  calculation: {
    method: 'SouthAfrica',
    customFajrAngle: 18,
    customIshaParam: { type: 'angle', value: 17 },
    customMaghribParam: { type: 'minutes', value: 0 },
    imsakParam: { type: 'minutes', value: 10 },
    dhuhrMinutes: 2,
    asrJuristic: 'hanafi',
    showBothAsr: true,
    highLatitudeRule: 'none',
    adjustments: {},
    rounding: 'nearest',
    ishraaqOffsetMinutes: 12,
    // The tabular calendar runs behind local moon sighting in southern Africa by
    // a day or two. Two matches the boards around Durban; every masjid should
    // set this to whatever their own sighting committee announces.
    hijriAdjustment: 2,
    hijriRollsAtMaghrib: true,
  },
  prayers: {
    fajr: { adhaan: { mode: 'calculated', offsetMinutes: 0 }, jamaat: { mode: 'offset', minutes: 20 } },
    dhuhr: { adhaan: { mode: 'fixed', time: '12:45' }, jamaat: { mode: 'fixed', time: '13:00' } },
    asr: { adhaan: { mode: 'calculated', offsetMinutes: 0 }, jamaat: { mode: 'offset', minutes: 15 } },
    maghrib: { adhaan: { mode: 'calculated', offsetMinutes: 3 }, jamaat: { mode: 'offset', minutes: 3 } },
    isha: { adhaan: { mode: 'fixed', time: '19:00' }, jamaat: { mode: 'fixed', time: '19:10' } },
  },
  overrides: [
    {
      id: 'ovr_sundays',
      label: 'Sundays & Public Holidays',
      weekdays: [0],
      dates: [],
      enabled: true,
      prayers: {
        dhuhr: {
          adhaan: { mode: 'fixed', time: '12:15' },
          jamaat: { mode: 'fixed', time: '12:30' },
        },
      },
    },
  ],
  jumuah: {
    enabled: true,
    label: "Jumu'ah",
    adhaanTime: '12:10',
    salaahTime: '12:40',
    second: { enabled: false, label: "Jumu'ah — 2nd Jamaat", adhaanTime: '13:30', salaahTime: '13:45' },
    note: 'Please be seated before the adhaan. Sunnah salaah is to be completed beforehand.',
  },
  display: {
    theme: 'emerald',
    hour12: true,
    showMeridiem: false,
    showSeconds: true,
    defaultSlideSeconds: 20,
    transition: 'fade',
    tickerEnabled: true,
    tickerMessages: [
      'Please switch your mobile phones to silent before entering the musallah.',
      'Straighten the saffs and fill the gaps — the Prophet ﷺ commanded it.',
      'Madrasah registration for the new term is now open at the office.',
    ],
    footerText: '',
    nightDimEnabled: true,
    nightDimStart: '22:00',
    nightDimEnd: '04:00',
    nightDimOpacity: 0.55,
    showArabic: true,
  },
  alerts: {
    enabled: true,
    preAdhaanMinutes: 10,
    adhaanHoldMinutes: 4,
    showIqamahCountdown: true,
    salaahInProgressMinutes: { fajr: 15, dhuhr: 12, asr: 12, maghrib: 12, isha: 15 },
    phoneReminder: 'Please switch off your mobile phone',
    blackoutDuringSalaah: false,
  },
  slides: [
    { id: 'sl_board', type: 'prayerBoard', enabled: true, durationSeconds: 30 },
    { id: 'sl_next', type: 'nextSalaah', enabled: true, durationSeconds: 15 },
    { id: 'sl_ann', type: 'announcements', enabled: true, durationSeconds: 22 },
    { id: 'sl_quote', type: 'quote', enabled: true, durationSeconds: 20 },
    { id: 'sl_events', type: 'events', enabled: true, durationSeconds: 20 },
    { id: 'sl_janazah', type: 'janazah', enabled: true, durationSeconds: 22 },
    { id: 'sl_appeal', type: 'appeal', enabled: true, durationSeconds: 18 },
    { id: 'sl_classes', type: 'classes', enabled: true, durationSeconds: 18 },
    { id: 'sl_jumuah', type: 'jumuah', enabled: true, durationSeconds: 15 },
    { id: 'sl_occasions', type: 'occasions', enabled: true, durationSeconds: 16 },
    { id: 'sl_qibla', type: 'qibla', enabled: true, durationSeconds: 14 },
  ],
  announcements: [
    {
      id: 'ann_1',
      title: 'Taleem after Maghrib',
      body: 'Daily taleem from Fazaail-e-Aamaal takes place immediately after Maghrib salaah in the main musallah. All musallees are requested to remain seated and participate.',
      priority: 'normal',
      startDate: null,
      endDate: null,
      enabled: true,
    },
    {
      id: 'ann_2',
      title: 'Masjid Carpet Cleaning',
      body: 'The masjid carpets will be professionally cleaned this coming Saturday after Fajr. Salaah will be performed in the upper hall for that day only.',
      priority: 'important',
      startDate: null,
      endDate: null,
      enabled: true,
    },
    {
      id: 'ann_3',
      title: 'Weekly Bayaan',
      body: 'Moulana Ismail Kadodia will deliver the weekly bayaan every Thursday night after Isha salaah. All are welcome to attend.',
      priority: 'normal',
      startDate: null,
      endDate: null,
      enabled: true,
    },
  ],
  events: [
    {
      id: 'ev_1',
      title: 'Monthly Ijtima',
      date: '',
      time: 'After Maghrib',
      speaker: 'Moulana Yusuf Patel',
      location: 'Main Musallah',
      enabled: true,
    },
    {
      id: 'ev_2',
      title: "Seerah Programme for the Youth",
      date: '',
      time: '19:30',
      speaker: 'Mufti Zubair Bhayat',
      location: 'Madrasah Hall',
      enabled: true,
    },
  ],
  janazah: [],
  appeals: [
    {
      id: 'ap_1',
      title: 'Masjid Extension Fund',
      description:
        'Alhamdulillah, work on the new wudhu facilities and the extended saff area has begun. Your contribution is a sadaqah jaariyah that continues to earn reward long after you have given it.',
      currency: 'R',
      target: 850000,
      raised: 512400,
      details: 'EFT: Masjid Ut Taqwa · Acc 1234567890 · Ref: EXTENSION',
      enabled: true,
    },
  ],
  quotes: [
    {
      id: 'q_1',
      arabic: 'إِنَّ الصَّلَاةَ كَانَتْ عَلَى الْمُؤْمِنِينَ كِتَابًا مَوْقُوتًا',
      translation:
        'Indeed, salaah has been prescribed upon the believers at specified times.',
      reference: "Surah An-Nisa 4:103",
      kind: 'ayah',
      enabled: true,
    },
    {
      id: 'q_2',
      arabic: 'صَلَاةُ الْجَمَاعَةِ تَفْضُلُ صَلَاةَ الْفَذِّ بِسَبْعٍ وَعِشْرِينَ دَرَجَةً',
      translation:
        'Salaah in congregation is twenty-seven times superior to the salaah performed alone.',
      reference: 'Sahih al-Bukhari 645',
      kind: 'hadith',
      enabled: true,
    },
    {
      id: 'q_3',
      arabic: 'مَنْ بَنَى لِلَّهِ مَسْجِدًا بَنَى اللَّهُ لَهُ مِثْلَهُ فِي الْجَنَّةِ',
      translation:
        'Whoever builds a masjid for the sake of Allah, Allah will build for him something like it in Jannah.',
      reference: 'Sahih Muslim 533',
      kind: 'hadith',
      enabled: true,
    },
  ],
  classes: [
    {
      id: 'cl_1',
      title: "Maktab — Boys & Girls",
      schedule: 'Monday — Thursday',
      time: '14:30 — 16:30',
      teacher: 'Apa Fatima & Moulana Ahmed',
      enabled: true,
    },
    {
      id: 'cl_2',
      title: 'Adult Tajweed Class',
      schedule: 'Every Saturday',
      time: 'After Fajr',
      teacher: 'Qari Suleman',
      enabled: true,
    },
    {
      id: 'cl_3',
      title: 'Hifz Programme',
      schedule: 'Monday — Friday',
      time: '07:30 — 12:00',
      teacher: 'Hafiz Muaadh',
      enabled: true,
    },
  ],
};

/** Deep clone helper used when resetting or duplicating config. */
export function cloneConfig<T>(value: T): T {
  return typeof structuredClone === 'function'
    ? structuredClone(value)
    : (JSON.parse(JSON.stringify(value)) as T);
}
