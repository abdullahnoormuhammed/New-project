# Masjid Board

A digital salaah-time and announcement display for masjids. It runs full-screen on
any TV with a browser — a smart TV, a Raspberry Pi, an old laptop, a Fire Stick —
and cycles through the timetable, announcements, programmes, janazah notices and
more, taking over the screen around each salaah.

The committee updates it from their phones through a private link, and every
screen follows within seconds.

The prayer times themselves are worked out **offline** — from the sun's actual
position, computed on the device, as are the Hijri date and the moon phase. Once
loaded, the board keeps running correctly with the internet unplugged,
indefinitely; it simply stops seeing new announcements until it is back.

---

## Running it

```bash
npm install
npm run dev        # development, on http://localhost:5173
npm run build      # production build into dist/
npm run preview    # serve the production build
npm test           # the test suite
```

To put it on a wall, follow **[INSTALL.md](INSTALL.md)**. It is a plain static
site, so any host will serve it; the shared settings that let the committee edit
from a phone are optional, and the board works without them.

## Managing the board

The settings are private. **Nothing on the board points at them** — no button, no
hint. They are reached in one of two ways, and both then need a passcode:

- **The editor link**, which the committee opens on their phones. It carries the
  edit key, so there is nothing for them to type.
- **Pressing A** on a keyboard plugged into the screen.

Every change saves as you type and reaches every screen within about twenty
seconds. There is no save button to forget.

See **[INSTALL.md](INSTALL.md)** to set this up — hosting, the shared settings
database, and the TV itself.

The panel covers:

| Section | What it controls |
| --- | --- |
| **Masjid** | Name, suburb, city, phone, website, logo |
| **Location & Calculation** | Coordinates, calculation method, Asr madhhab, high-latitude rule, per-prayer adjustments, Hijri offset — with a live preview of today's times |
| **Adhaan & Jamaat** | Per-salaah rules, Jumu'ah, and weekday/public-holiday overrides |
| **Slides** | Which slides show, in what order, for how long |
| **Content** | Announcements, programmes, janazah notices, ayah & hadith, madrasah timetable |
| **Display** | Theme, 12/24-hour clock, transitions, notice ticker, overnight dimming |
| **Salaah Alerts** | The takeover behaviour around each prayer |
| **Screens** | Sync status, the board code, and the links to hand out |
| **Passcode** | The lock on these settings |
| **Backup & Restore** | Download or restore the whole configuration as one JSON file |

Keep a copy of the backup file. If the screen is ever replaced, restoring it is a
single step.

## The slides

The deck is built from whatever the masjid actually has content for. **A slide with
nothing to show is skipped** — no empty "Janazah Notices" screen — and long lists
are paginated automatically across several slides.

- **Salaah Timetable** — the main board: adhaan and jamaat columns with the current
  prayer highlighted and the next one flagged, the day's solar times alongside, the
  moon phase, and a strip for Jumu'ah and any holiday schedule.
- **Next Salaah** — a full-screen countdown to the next jamaat.
- **Announcements** — up to three notices a screen, with normal/important/urgent
  markers and optional start and end dates so they retire themselves.
- **Ayah & Hadith** — Arabic set right-to-left in a naskh face, with the translation
  and reference.
- **Programmes** — upcoming events, soonest first; past dates drop off on their own.
- **Janazah Notices** — name, salaah time and venue, burial, with an expiry date.
- **Madrasah & Ta'leem** — the standing class timetable.
- **Jumu'ah** — adhaan and khutbah times, with an optional second jamaat.
- **Islamic Calendar** — a countdown to Ramadan, the Eids, Ashura and the rest.
- **Qibla & Masjid Info** — qibla bearing on a compass, distance to the Kaaba, and
  the settings the times were calculated with.

## Who can change what

| | Reads the board | Changes the board |
| --- | --- | --- |
| Anyone who opens the address | yes | no |
| A device holding the **edit key** and the **passcode** | yes | yes |

The edit key is checked **in the database**, not in the browser, so a device
without it cannot write no matter what it does locally. It is stored only as a
digest, and it can be rotated at any time — old links stop working immediately.

The TV is deliberately given only the plain address, so the screen on the wall
cannot change what it shows.

The passcode is a second, local lock so that a forwarded link is not enough on
its own. It guards against someone picking up the remote; it is not a defence
against developer tools on the device itself, where the settings live in the
browser regardless.

## Around each salaah

When a prayer approaches the board stops rotating and works through four states:

1. **Approaching** — a countdown banner appears over the running slides.
2. **Adhaan** — full-screen takeover, with the "switch off your phone" reminder.
3. **Awaiting jamaat** — a large countdown to the iqamah.
4. **In progress** — a deliberately quiet screen while the jamaat is performed,
   optionally blanked entirely.

Each stage's length is configurable, per prayer for the last one.

## How the times are worked out

The engine (`src/lib/prayer-times.ts`) computes the sun's declination and equation
of time, then solves the hour angle for each depression angle — the standard
approach. Thirteen calculation conventions ship with it (Muslim World League, ISNA,
Umm al-Qura, Karachi, Egypt, Jamiatul Ulama South Africa and others), plus custom
angles.

On top of the calculated times sit the masjid's own rules. An **adhaan** either
follows the calculated time (optionally nudged by a few minutes) or is called at a
fixed hour. A **jamaat** is either a set number of minutes after the adhaan, a fixed
time, or "after the adhaan, rounded up to the next quarter hour" — the pattern many
masjids use so the jamaat lands on a tidy time as the season moves.

**Overrides** replace those rules on given weekdays or specific dates, which is how
the Sunday-and-public-holiday Dhuhr works. Jumu'ah replaces Dhuhr on Fridays.

Accuracy is checked against NOAA's solar calculator in the test suite: sunrise,
solar noon and sunset for Durban all agree to within a minute.

### The Hijri date

The tabular (arithmetical) Islamic calendar is used, which can run a day or two
either side of local moon sighting. **Set the Hijri adjustment in the admin panel
to whatever your sighting committee announces** — it shifts the date by whole days.
The date rolls over at maghrib, as the Islamic day actually does.

Notable days (Ramadan, the Eids, Ashura, Arafah) are derived the same way and are
labelled *subject to moon sighting* on the board, because they are.

## Built for a screen on a wall

- Everything is laid out on a fixed 1920×1080 canvas that is scaled to fit whatever
  it is plugged into, so a layout checked on a laptop looks identical on a 55" TV.
- The screen wake lock is held, and re-acquired whenever the browser drops it.
- The page reloads itself at 3am so the date rolls over cleanly on a board that has
  been running for months.
- The display can dim overnight to spare the panel.
- The clock ticks aligned to the wall clock rather than on a plain interval, so the
  seconds do not drift and stutter over weeks of uptime.
- Settings are cached on the device and read from that cache first, so the screen
  is never blank and never waits on the network.
- Five themes: Emerald, Midnight, Gold, Slate and Ramadan.

## Project layout

```
src/
  lib/            the engine — no React in here
    prayer-times.ts   solar geometry and the calculation methods
    hijri.ts          tabular Islamic calendar and notable days
    moon.ts           moon phase
    schedule.ts       config + a date → the day's actual timetable
    prayer-state.ts   the salaah takeover state machine
    slide-plan.ts     builds the deck, drops empty slides, paginates lists
    config.ts         the configuration model and its defaults
    storage.ts        local persistence, merging and validation
    remote.ts         shared settings: polling, pushing, the edit key
    passcode.ts       the lock on the settings
  components/     the board chrome: header, footer, takeovers
  slides/         one component per slide type
  admin/          the management panel and the locks in front of it
  styles/         design tokens and layout
supabase/
  schema.sql      the shared-settings table and its three functions
tests/            58 tests over the engine
```

## Testing

```bash
npm test
```

The suite covers the solar maths against NOAA reference values, the ordering and
sanity of every prayer through the year, high-latitude fallbacks, the Hijri calendar
(round-tripped across sixty years and checked against the Unix epoch), the moon
cycle, the schedule rules and overrides, the alert state machine, deck planning and
pagination, and the config merge/validation path.

## A note on the sample content

The board ships configured for Masjid Ut Taqwa, Sea Cow Lake, Durban, with sample
announcements and classes so there is something to look at on first run. Replace
it from the settings — or **Backup & Restore → Reset everything** to start from
scratch.
