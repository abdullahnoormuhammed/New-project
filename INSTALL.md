# Setting the board up

From nothing to a screen on the wall that the committee can update from their
phones. Budget about an hour for the first one; a second masjid takes ten
minutes.

There are four parts:

1. **Put the site online** — one free account, one click.
2. **Create the shared settings** — one free database, one file of SQL.
3. **Connect the two** — three settings, then redeploy.
4. **Put it on the TV** — pick whichever hardware suits.

At the end you will have two links:

| Link | Who gets it | What it does |
| --- | --- | --- |
| `https://yourboard.vercel.app/?board=taqwa` | The TV | Shows the board. Cannot change anything. |
| `https://yourboard.vercel.app/#admin&k=…` | The committee | The private settings page. |

---

## Part 1 — Put the site online

The board is a plain website, so any static host works. Vercel is free and the
simplest, so these instructions use it.

1. Push this project to GitHub if it is not there already.
2. Go to **vercel.com**, sign in with GitHub.
3. **Add New → Project**, pick this repository, and press **Deploy**.

Vercel detects Vite on its own — framework Vite, build `npm run build`, output
`dist`. Nothing to change.

You will get an address like `https://masjid-board-xyz.vercel.app`. Open it. The
board should appear with the sample content. **Do not set anything up yet** —
finish Part 3 first, or the settings you enter will only live on your laptop.

> Netlify and Cloudflare Pages work identically: build command `npm run build`,
> publish directory `dist`.

---

## Part 2 — Create the shared settings

> **Already done for this project.** A free Supabase project called
> `masjid-board` exists, the schema below has been applied to it, and a board
> with the code `taqwa` has been created. Its two public values are in Part 3.
> The edit key was handed over separately — it is shown once and cannot be
> looked up again, so if it has been lost, rotate it using the statement at the
> bottom of `supabase/schema.sql`.
>
> The rest of this part is what to do for the **next** masjid, or to rebuild
> from scratch.

This is what lets a change made on a phone reach the TV. Supabase's free tier is
far more than a masjid board will ever use.

### 2a. Create the project

1. Go to **supabase.com**, sign in, **New project**.
2. Name it `masjid-board`. Choose a region near you — for South Africa,
   *eu-west-1 (Ireland)* or *eu-central-1 (Frankfurt)* are the closest.
3. Set a database password and keep it somewhere safe. You will not need it for
   this, but you will if you ever want to get in directly.
4. Wait for it to finish starting — a minute or two.

### 2b. Create the table

1. Open **SQL Editor** in the left sidebar, then **New query**.
2. Open `supabase/schema.sql` from this project, copy **all** of it, paste it in.
3. Press **Run**.

You should see *Success. No rows returned.* That has created one table and three
functions, and locked the table so the key that ships in the website cannot read
secrets or write anything.

### 2c. Create your board

In a new query, change the two lines marked below, then run it:

```sql
with new_key as (
  select encode(extensions.gen_random_bytes(24), 'hex') as k
)
insert into public.boards (slug, label, edit_token_hash, config)
select 'taqwa',                                  -- ← the board code, in links
       'Masjid Ut Taqwa, Sea Cow Lake',          -- ← a label, just for you
       encode(extensions.digest(k, 'sha256'), 'hex'),
       '{}'::jsonb
  from new_key
returning slug, (select k from new_key) as edit_key;
```

The board code must be lowercase letters, numbers and dashes — `taqwa`,
`masjid-annoor`, `sea-cow-lake`.

**Copy the `edit_key` it prints out and keep it safe.** It is shown once and
only ever stored as a digest, so it cannot be looked up again. If you lose it,
run the rotate statement at the bottom of `supabase/schema.sql` to issue a new
one.

### 2d. Collect the two public values

**Project Settings → API**:

- **Project URL** — like `https://abcdefgh.supabase.co`
- **anon / public key** — a long token starting `eyJ…`

Both of these are public by design. They end up inside the website where anyone
can read them, and on their own they grant nothing: the table denies them, and
the only way in is through the three functions, which need the edit key to
write.

---

## Part 3 — Connect them

Back in Vercel: **Settings → Environment Variables**. Add three.

For the project already created, they are exactly these:

| Name | Value |
| --- | --- |
| `VITE_SUPABASE_URL` | `https://ovzofrxhdxvmaqablnye.supabase.co` |
| `VITE_SUPABASE_ANON_KEY` | `sb_publishable_pKM8YvVmqF28BtZsnWTIOA_etQJLBCa` |
| `VITE_BOARD_SLUG` | `taqwa` |

Both Supabase values are public by design — they are compiled into the website
where anyone can read them, and they grant nothing on their own. The edit key is
**not** among them and must never be put in an environment variable, because
that would ship it to every screen.

For a different board, take the first two from Part 2d and use your own code for
the third.

Then **Deployments → ⋯ → Redeploy**. These are read when the site is built, so a
redeploy is required — changing them alone does nothing.

To check it worked, open your site and press **A**. You should reach a screen
titled **Editor Access**, which means the site knows it is sharing settings and
that this device is not allowed to change them. That is exactly right.

### Set the board up for the first time

Open the editor link, replacing the key with the one from 2c:

```
https://yourboard.vercel.app/#admin&k=PASTE-THE-EDIT-KEY-HERE
```

The key is taken out of the address bar straight away and remembered on that
device. You will be asked to choose a **passcode** — this is the second lock, and
everyone on the committee uses the same one.

Now work through the settings. At minimum:

- **Masjid** — name and suburb.
- **Location & Calculation** — press *Use this device's location* while standing
  at the masjid, or type the coordinates. Check the times at the bottom of that
  page against your current printed timetable.
- **Adhaan & Jamaat** — the masjid's actual times.
- **Announcements** — delete the samples, add your own.

Everything saves as you type and goes to the screens within a second or two.

---

## Part 4 — Put it on the TV

Whichever route you take, the address to open is:

```
https://yourboard.vercel.app/?board=taqwa
```

Then make it full screen. **Never open the editor link on the TV** — if you do,
that TV can change the board. (If it happens: **Screens → Sign this device out**.)

### Option A — the TV's own browser

Cheapest: nothing to buy. Open the browser on the TV, go to the address, add it
to favourites, full screen.

Honest warnings: many smart TV browsers forget the page when the TV is switched
off, so somebody has to reopen it; some dim or sleep regardless of settings; and
older ones are slow. Try it — if it holds overnight, you are done. If it does not,
use Option B.

### Option B — a Raspberry Pi (the reliable one)

Around R800–R1200 once off, and it simply works. A Pi 4 or Pi 5, a power supply,
a microSD card and an HDMI cable.

1. Flash **Raspberry Pi OS (64-bit, Desktop)** with the Raspberry Pi Imager. In
   the Imager's settings, set the wifi and turn on SSH before writing.
2. Boot it, connect to the network, then:

   ```bash
   sudo apt update && sudo apt install -y chromium-browser unclutter
   ```

3. Create the startup script:

   ```bash
   mkdir -p ~/.config/autostart
   cat > ~/.config/autostart/masjid-board.desktop <<'EOF'
   [Desktop Entry]
   Type=Application
   Name=Masjid Board
   Exec=chromium-browser --kiosk --noerrdialogs --disable-infobars --incognito --check-for-update-interval=31536000 --disable-features=TranslateUI --app=https://yourboard.vercel.app/?board=taqwa
   X-GNOME-Autostart-enabled=true
   EOF
   ```

   Put your own address in that `--app=` line.

4. Stop the screen blanking:

   ```bash
   cat > ~/.config/autostart/no-blank.desktop <<'EOF'
   [Desktop Entry]
   Type=Application
   Name=No Blanking
   Exec=sh -c "xset s off; xset -dpms; xset s noblank; unclutter -idle 0 &"
   EOF
   ```

5. Reboot. It comes up straight into the board, full screen, no cursor, and
   recovers by itself after a power cut.

### Option C — a mini PC, old laptop or Android box

Install Chrome and launch it in kiosk mode:

```
chrome.exe --kiosk --disable-infobars "https://yourboard.vercel.app/?board=taqwa"
```

On Windows, put a shortcut with those switches into the Startup folder
(`Win+R` → `shell:startup`) and set the machine to log in automatically. Turn off
sleep and screen blanking in Power settings. On an Android TV box, *Fully Kiosk
Browser* does the same job.

### Whichever you choose

- **Set the clock correctly.** The times are worked out from the device's own
  clock — if that is wrong, everything is wrong. Set the timezone and turn on
  automatic time.
- **Turn off screen savers and sleep.**
- Leave it running a full day and check Fajr and Isha against your printed
  timetable before you trust it.

---

## Part 5 — Hand it to the committee

Give them:

1. **The editor link**, including the key. Copy it from **Screens → Copy editor
   link**. Tell them to bookmark it — the key is inside the link, so there is
   nothing to type.
2. **The passcode.**

Tell them plainly: *anyone with both of these can change what the whole masjid
sees.* Do not put it in a big WhatsApp group.

What they can do from a phone:

- Add and remove **announcements** — with dates, so a notice retires itself.
- Post a **janazah notice**, which vanishes after the date you set.
- Change **salaah times**, Jumu'ah, and the Sunday/public-holiday schedule.
- Add **programmes** and the **madrasah timetable**.
- Change the ayah and hadith, the theme, and the scrolling notices.

A change reaches the screens within about twenty seconds.

---

## Day to day

**Nothing on the board points at the settings.** No button, no hint. The way in
is the editor link, or pressing **A** on a keyboard plugged into the screen — and
both then need the passcode.

**The board does not need the internet to keep working.** It caches the settings
and works out prayer times from the sun's position on the device itself. If the
line goes down, the screen carries on indefinitely with correct times; it just
will not see new announcements until the connection returns.

**Take a backup.** **Backup & Restore → Download settings** saves everything to
one file. Do it after the initial setup and after big changes.

---

## When something is wrong

**The times are out by an hour or two.** The device's clock or timezone is wrong.
Fix it on the device, not in the settings.

**The times are out by a few minutes.** That is the calculation convention.
**Location & Calculation → Calculation method**, and check the coordinates.
For small differences, use the per-prayer adjustment on the same page.

**The Hijri date is a day or two out.** Normal — the arithmetical calendar runs
slightly off local moon sighting. **Location & Calculation → Hijri date
adjustment** shifts it by whole days. Set it to match your sighting committee.

**A change on the phone has not reached the TV.** Check **Screens → Status** on
the phone. If it says the changes are saved but not sent, that phone is offline;
they go up on their own when it reconnects. If the phone says all screens are up
to date but the TV still shows the old thing, the TV is offline — check its wifi,
then reload the page on it.

**The editor link stopped working.** Someone has rotated the edit key. Get the
current link.

**The passcode is lost.** It cannot be recovered. On the TV, clear the browser's
site data for the page, then open the editor link again and set a new one. Your
content is safe — it lives in the database, not on the TV.

**The editor link has spread too far.** Rotate the key using the statement at the
bottom of `supabase/schema.sql`. Every old link stops working at once. Change the
passcode too, on the **Passcode** page.

---

## Running without any of this

The hosting and the database are optional. Leave the three environment variables
unset and the board runs entirely on its own device — no accounts, no internet,
nothing to pay for. Settings are then edited at the screen itself and are not
shared with anything else. Everything on the board works exactly the same; only
the remote editing goes away.
