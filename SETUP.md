# Washington Jungto Center — website pages

Five pages, sharing **one** Google Sheet as their backend.

| File | What it is |
|---|---|
| `index.html` | **Home page** — what the center is, "thinking about coming?" (with the call-ahead number), the Sunday service, ways to take part, and how to visit. Set this as the site's front page. |
| `sharing-room.html` | Reviews page — retreat participants read reviews and post their own. |
| `events.html` | Events calendar — list view + month view, filter by type, "Add to calendar", "Subscribe". |
| `gallery.html` | Photo gallery — a grid of pictures with a tap-to-enlarge view. Shows photos staff upload from the Admin page; falls back to placeholder illustrations until then (see §F). |
| `admin.html` | **Staff page** — add / change / remove events, and **upload gallery photos** from a phone or computer. No spreadsheet needed. Linked in the menu as "Admin"; inert until staff enter the passcode. |
| `Code.gs` | One Google Apps Script serving all the dynamic pages from one Google Sheet (tabs **Reviews**, **Events**) plus a Google Drive folder for gallery photos, and the calendar subscription feed. |

Every page works **on its own** with built-in sample content — good for trying them out. Connect the Sheet (Part B) to make it live: shared reviews, staff-managed events.

Cost: **$0**. A Google account is the only requirement. Nobody logs in to read or post.

---

## A. Get the pages online (5 minutes)

1. **Fill in the street address** — open `index.html` and search for `[Street address]` (it's in two spots: the "Visit us" section and the footer). Replace both with the real address, e.g. `4300 Blahblah Rd, Beltsville, MD 20705`. That also makes the "Get directions" button and the map placeholder accurate.
2. Open `index.html` in a browser to check it looks right.
3. Put the folder on a free host:
   - **Netlify Drop** — <https://app.netlify.com/drop>, drag the folder in.
   - **Cloudflare Pages** or **GitHub Pages** — also free.
   - Or upload the files to your existing website.
4. `index.html` is the front page. The header menu ("Events / Sharing Room / Gallery / Admin") and the logo (which links home) tie the pages together — you can also add them to your main site's menu.
   - The **Admin** link is intentionally visible, but the page is inert until someone types the passcode, so it's safe to leave in the menu. To hide it, delete the `<a href="admin.html">Admin</a>` line from the `<nav>` in the other files; staff can still reach it by typing the URL.
   - **Keep all files in the same folder** — the menu links between pages with plain relative links. The logo links to `/` (your site root); change that `href="/"` in each file if your root is elsewhere.

At this stage: the home page and calendar show built-in sample content; reviews save in each visitor's own browser. Do Part B to make it all live.

---

## B. Connect the Google Sheet (15–20 minutes, once)

### 1. Make the sheet
- <https://sheets.new> → name it **WJC Website**

### 2. Add the script
- **Extensions → Apps Script**
- Delete the placeholder code, paste all of `Code.gs`
- **Set your admin passcode:** near the top, change
  `var ADMIN_KEY = 'change-this-key';`
  to a phrase only staff will know (e.g. `'lotus-front-desk-2026'`). This is what unlocks `admin.html`.
- Click **Save**
- In the toolbar, choose the `setup` function and click **Run** once. Approve the permission prompt (it's your own script). This creates the **Reviews** and **Events** tabs with the right column headers and one sample event.

### 3. Deploy as a Web App
- **Deploy → New deployment**
- Gear icon → **Web app**
- **Execute as:** `Me`
- **Who has access:** `Anyone`   ← this is what lets the public read and post without an account
- **Deploy** → authorize → copy the **Web app URL** (ends in `/exec`)

### 4. Paste the URL into the pages
In **`index.html`**, **`sharing-room.html`**, **`events.html`**, **`admin.html`**, and **`gallery.html`**, near the top of the `<script>` block, find the line starting:
```js
var CONFIG = { endpoint: "" ...
```
and put your URL between the quotes (same URL in every file):
```js
var CONFIG = { endpoint: "https://script.google.com/macros/s/AKfy…/exec" ...
```
Re-upload the files.

Done. Reviews go to the **Reviews** tab; the calendar reads the **Events** tab; the **Subscribe** button works; and `admin.html` can edit events once staff enter the passcode.

---

## C. Managing events

### The easy way — `admin.html`

Open the **Admin** link in the menu (or go to `yoursite.org/admin.html` and bookmark it).

1. Enter the **admin passcode** you set in step B2. It's remembered on that device until you click "lock".
2. You'll see every event in a list — upcoming and past, drafts marked.
3. Click one to edit it, or **+ New event**. Fill in the form, **Save**. It's live immediately.
4. Untick **"Show on the public page"** to keep an event as a hidden draft.
5. **Delete** removes it for good.

**Asking for volunteers.** In the event form, tick **"이 행사에 봉사자 모집 / Recruit volunteers for this event"**. Two fields appear:
- **필요한 도움 / What help is needed** — free text (e.g. "설치, 다과 준비, 뒷정리"). Shown on the event card exactly as written.
- **봉사 신청 링크 / Volunteer sign-up link** — a Google Form, an email link, whatever. The card's **"돕고 싶어요 / I can help"** button opens this; leave it blank and the button falls back to `hello@wajungto.org`.
- (optional) **필요 인원 / How many** — a number shown next to the heading.

On the public events page, that one event's card gets a warm "봉사자를 찾고 있어요" panel between its description and the buttons. Untick the box to remove it.

The passcode is a shared staff phrase, not a personal login — treat it like a door key, don't post it publicly, and change it any time by editing `ADMIN_KEY` in the script and redeploying (Part E).

### The direct way — the "Events" tab

You can also edit events straight in the Google Sheet. One row per event:

| column | example | notes |
|---|---|---|
| `id` | `e12` | any short unique text (the admin page fills this in for you) |
| `date` | `2026-09-19` | start date, `YYYY-MM-DD` |
| `endDate` | `2026-09-21` | only for multi-day events; leave blank otherwise |
| `start` | `19:00` | 24-hour time; blank = all-day |
| `end` | `21:00` | |
| `title` | `Dharma Talk with Ven. Pomnyun Sunim` | |
| `category` | `Ven. Pomnyun Sunim` | see the list below — controls the colour |
| `location` | `Main Hall + livestream` | |
| `description` | one or two sentences | |
| `registerUrl` | `https://…` | optional; adds a "Register" button. Leave blank for none |
| `published` | `TRUE` | set to `FALSE` to hide a draft. Blank counts as shown |
| `needsVolunteers` | `TRUE` | `TRUE` shows the "volunteers needed" panel on this event's card. Blank / `FALSE` = off |
| `volunteerHelp` | `설치, 다과 준비, 뒷정리` | what help you need — shown on the card as written |
| `volunteerCount` | `3` | optional — number shown next to the heading |
| `volunteerUrl` | `https://forms.gle/…` | where the "I can help" button goes; blank falls back to `hello@wajungto.org` |

Events automatically drop off the **public** page the day after they finish (they stay in the sheet and in `admin.html` under "Past").

*(The Events tab now has 15 columns. If you set the script up before this feature, the extra columns are added automatically the first time the script runs after you paste the new `Code.gs` — existing events just leave them blank.)*

**Categories with colours:** `Sunday Practice`, `Meditation Course`, `Ven. Pomnyun Sunim`, `Retreat`, `Volunteer`, `Youth & Family`, `Ceremony & Prayer`, `Community`. Any other word works too — it just shows in grey.

---

## D. Reviews (the "Reviews" tab)

Reviews **appear on the page immediately** — no approval step. Every submission is still capped in length and sanitised before it's stored.

- **Remove a review:** delete its row in the **Reviews** tab (or set its `approved` cell to `FALSE`). It disappears from the page within a few seconds.
- **The `helpful` column** updates on its own as visitors tap "Yes".
- **Want an approval step back?** In `Code.gs` set `var MODERATE = true;` and redeploy (Part E). New reviews then arrive as `approved = FALSE` and stay hidden until a volunteer changes that cell to `TRUE`.

---

## E. Changing the script later

After editing `Code.gs`:
- **Deploy → Manage deployments** → pencil (edit) → **Version: New version** → **Deploy**

The URL stays the same — no need to touch the HTML again.

---

## F. Gallery photos — uploading from the Admin page

Staff add photos from a phone or computer on the **Admin** page — no file editing.

### First-time switch-on (once)

Because photos are stored in Google Drive, the script needs one extra permission:

1. Paste the latest `Code.gs` into **Extensions → Apps Script** (keep your `ADMIN_KEY` line — set it back to your real passcode if pasting the whole file).
2. **Save**, then in the toolbar pick **`setup`** and click **Run**. Google will now ask for **Google Drive** access — click **Allow**. This creates a Drive folder called **"WJC Gallery Photos"**.
3. Redeploy: **Deploy → Manage deployments → ✏️ edit → Version: New version → Deploy**.

### Day-to-day

1. Open **Admin**, enter the passcode.
2. Scroll to **Gallery photos** → **+ Add photos** → pick images (the camera roll opens on a phone).
3. Each photo is shrunk in the browser, uploaded, and appears on the public Gallery within a few seconds.
4. To remove one, hover it and click the **×**. (That trashes the file in the "WJC Gallery Photos" Drive folder — you can also delete straight from Drive.)

The caption under each photo is the file's name without the extension — rename the file before uploading if you want a nicer caption. Photos show newest first.

### If you'd rather hard-code the photos instead

`gallery.html` still ships with three placeholder illustrations. Until any photo is uploaded, those show. To replace them by hand instead of using the Admin page: put image files (e.g. `lotus.jpg`) next to `gallery.html`, then in the block marked **`TO USE YOUR OWN PHOTOS`** change each `src="data:image/svg+xml;base64,…"` to the filename and update the `alt` / `<figcaption>`.

---

## Notes

- **Korean / English.** Every page opens in **Korean**; a `[ 한국어 | EN ]` toggle in the header switches it, and a visitor's choice is remembered on their device. Interface text lives in the HTML as pairs of attributes — `data-ko="한국어"` and `data-en="English"` — with the Korean shown by default. To reword something, edit whichever attribute (and the visible copy between the tags, which should match `data-ko`). Content that comes from the Google Sheet (event titles/descriptions, reviews, photo captions) stays in whatever language it was typed in — the toggle doesn't translate it. There is no dark mode.
- **Editing page text** (intro copy, the address, phone number `240-786-7528`, email `hello@wajungto.org`, the program list on the reviews form): all in plain text near the top of the `<body>` in each HTML file. The home page (`index.html`) holds the address, phone, hours, and the "thinking about coming?" copy. On the reviews page the program list appears twice (form + filter) — keep them matching.
- **The phone number** appears in `index.html` as both display text (`240-786-7528`) and a `tel:+12407867528` link — update both if it changes.
- **The logo** is embedded in each of the five HTML files as a `data:image/png;base64,…` string inside `<span class="brand-logo">`. To change it, swap that string in every file (or replace the `<img>` with your own `<img src="logo.png">` and drop `logo.png` in the folder). The small text beside it ("워싱턴미주정토회관 / Beltsville, MD") is in `<span class="brand-sub">`.
- **Sample content:** the 4 example reviews live in the `SEED` array in `sharing-room.html`; the example events live in the `SEED` array in `events.html`. Delete them once real content flows in (sample reviews always show above Sheet reviews; once `endpoint` is set and the Events tab has rows, the sample events are ignored).
- **"Subscribe" feed:** the events page builds a `webcal://…` link from your endpoint. People add it once in Google/Apple/Outlook and always see the current schedule. It refreshes a few times a day on their side.
- **CORS error in the browser console?** Re-check Part B step 3: deployment type **Web app**, execute as **Me**, access **Anyone**. Redeploy as a new version.
