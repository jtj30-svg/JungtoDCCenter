/**
 * Washington Jungto Center — website backend
 * -------------------------------------------------------------------
 * One Google Apps Script + one Google Sheet serves BOTH pages:
 *
 *   • sharing-room.html  → reviews   (tab "Reviews")
 *   • events.html        → calendar  (tab "Events")
 *
 * No login for visitors. No server bill. Setup steps are in SETUP.md.
 *
 * Endpoints (the pages call these for you):
 *   GET  ?resource=reviews                     → { reviews:[...], moderated:bool }
 *   GET  ?resource=events                      → { events:[...] }   (published, upcoming)
 *   GET  ?resource=events&format=ics           → iCalendar feed (for "Subscribe")
 *   POST { ...review }                         → add a review
 *   POST { op:"helpful", id, delta }           → adjust a review's helpful count
 *   POST { resource:"events", op:"list",   key:KEY }               → { events:[...] } all, incl. drafts (admin.html)
 *   POST { resource:"events", op:"save",   key:KEY, event:{...} }   → add / update an event (admin.html)
 *   POST { resource:"events", op:"delete", key:KEY, id:"..." }      → remove an event (admin.html)
 *   GET  ?resource=photos                                          → { photos:[...] }  gallery.html
 *   POST { resource:"photos", op:"list",   key:KEY }               → { photos:[...] }  admin.html
 *   POST { resource:"photos", op:"upload", key:KEY, name, dataUrl }→ save a photo to Drive (admin.html)
 *   POST { resource:"photos", op:"delete", key:KEY, id:"..." }     → remove a photo (admin.html)
 *
 * Photos are stored in a Google Drive folder ("WJC Gallery Photos"), created
 * automatically. After adding this code you must Run ▸ setup once and approve
 * the new Google Drive permission, then redeploy.
 */

// ─── Settings ──────────────────────────────────────────────────────
var MODERATE       = false;     // false = reviews appear on the site immediately
                                // true  = new reviews stay hidden until "approved" is set to TRUE
var ADMIN_KEY      = 'change-this-key';   // <<< CHANGE THIS. Whoever has it can edit events on admin.html.
var REVIEWS_SHEET  = 'Reviews';
var EVENTS_SHEET   = 'Events';
var TZID           = 'America/New_York';

var REVIEW_HEADERS = ['id','date','name','anonymous','program','rating','text','helpful','approved'];
var EVENT_HEADERS  = ['id','date','endDate','start','end','title','category','location','description','registerUrl','published','needsVolunteers','volunteerHelp','volunteerCount','volunteerUrl'];
var GALLERY_FOLDER = 'WJC Gallery Photos';   // Drive folder that holds uploaded gallery photos


// ─── Router ────────────────────────────────────────────────────────
function doGet(e) {
  var p = (e && e.parameter) || {};
  if (p.resource === 'events') {
    var events = getEvents(false);
    if (p.format === 'ics') {
      return ContentService.createTextOutput(buildICS(events))
        .setMimeType(ContentService.MimeType.ICAL);
    }
    return json({ events: events });
  }
  if (p.resource === 'photos') {
    return json({ photos: getPhotos() });
  }
  return json({ reviews: getReviews(), moderated: MODERATE });
}

function doPost(e) {
  var body;
  try { body = JSON.parse(e.postData.contents); }
  catch (err) { return json({ ok: false, error: 'bad_json' }); }

  // ── photos (admin.html) — Drive only, no sheet lock needed ──
  if (body.resource === 'photos') {
    if (body.key !== ADMIN_KEY) return json({ ok: false, error: 'unauthorized' });
    if (body.op === 'list')   return json({ ok: true, photos: getPhotos() });
    if (body.op === 'delete') return json(deletePhoto(String(body.id || '')));
    if (body.op === 'upload') return json(uploadPhoto(body));
    return json({ ok: false, error: 'bad_op' });
  }

  var lock = LockService.getScriptLock();
  lock.waitLock(15000);
  try {
    // ── events editing (admin.html) ──
    if (body.resource === 'events') {
      if (body.key !== ADMIN_KEY) return json({ ok: false, error: 'unauthorized' });
      if (body.op === 'list')   return json({ ok: true, events: getEvents(true) });
      if (body.op === 'delete') return json(deleteEvent(String(body.id || '')));
      return json(saveEvent(body.event || {}));
    }

    var sheet = getSheet(REVIEWS_SHEET, REVIEW_HEADERS);

    if (body.op === 'helpful' && body.id) {
      bumpHelpful(sheet, String(body.id), Number(body.delta) || 0);
      return json({ ok: true });
    }

    var name   = String(body.name || '').trim().slice(0, 60);
    var text   = String(body.text || '').trim().slice(0, 2000);
    var rating = Math.max(1, Math.min(5, parseInt(body.rating, 10) || 0));
    if (!text || !rating) return json({ ok: false, error: 'missing_fields' });

    sheet.appendRow([
      String(body.id || 'r' + Date.now()),
      body.date || todayStr(),
      name,
      body.anon === true || !name,
      String(body.program || 'Another program').slice(0, 80),
      rating, text, 0,
      MODERATE ? false : true
    ]);
    return json({ ok: true, moderated: MODERATE });
  } finally {
    lock.releaseLock();
  }
}


// ─── Reviews ───────────────────────────────────────────────────────
function getReviews() {
  var rows = getSheet(REVIEWS_SHEET, REVIEW_HEADERS).getDataRange().getValues();
  rows.shift();
  return rows
    .filter(function (r) {
      if (!r[0]) return false;
      return !MODERATE || r[8] === true || String(r[8]).toUpperCase() === 'TRUE';
    })
    .map(function (r) {
      var anon = r[3] === true || String(r[3]).toUpperCase() === 'TRUE' || !r[2];
      return {
        id: String(r[0]), date: dateStr(r[1]),
        name: anon ? '' : String(r[2] || ''), anon: anon,
        program: String(r[4] || 'Another program'),
        rating: Number(r[5]) || 5, text: String(r[6] || ''),
        helpful: Number(r[7]) || 0
      };
    });
}

function bumpHelpful(sheet, id, delta) {
  var last = sheet.getLastRow();
  if (last < 2) return;
  var ids = sheet.getRange(2, 1, last - 1, 1).getValues();
  for (var i = 0; i < ids.length; i++) {
    if (String(ids[i][0]) === id) {
      var cell = sheet.getRange(i + 2, 8);
      cell.setValue(Math.max(0, (Number(cell.getValue()) || 0) + delta));
      return;
    }
  }
}


// ─── Events ────────────────────────────────────────────────────────
function getEvents(includeAll) {
  var rows = getSheet(EVENTS_SHEET, EVENT_HEADERS).getDataRange().getValues();
  rows.shift();
  var cutoff = new Date(); cutoff.setDate(cutoff.getDate() - 1); cutoff.setHours(0, 0, 0, 0);

  return rows
    .filter(function (r) {
      if (!r[0] || !r[1]) return false;
      if (includeAll) return true;
      if (!isPublished(r[10])) return false;
      var end = parseYMD(dateStr(r[2]) || dateStr(r[1]));
      return end >= cutoff;
    })
    .map(function (r) {
      var o = {
        id: String(r[0]),
        date: dateStr(r[1]),
        endDate: dateStr(r[2]),
        start: timeStr(r[3]),
        end: timeStr(r[4]),
        title: String(r[5] || 'Untitled event'),
        category: String(r[6] || 'Community'),
        location: String(r[7] || ''),
        description: String(r[8] || ''),
        registerUrl: String(r[9] || '')
      };
      var needsVol = isTrue(r[11]);
      if (includeAll) {
        o.published = isPublished(r[10]);
        o.needsVolunteers = needsVol;
        o.volunteerHelp = String(r[12] || '');
        o.volunteerCount = String(r[13] || '');
        o.volunteerUrl = String(r[14] || '');
      } else if (needsVol) {
        o.needsVolunteers = true;
        o.volunteerHelp = String(r[12] || '');
        o.volunteerCount = String(r[13] || '');
        o.volunteerUrl = String(r[14] || '');
      }
      return o;
    })
    .sort(function (a, b) { return (a.date + a.start).localeCompare(b.date + b.start); });
}

function isPublished(v) {
  var s = String(v).toUpperCase();
  return !(v === false || s === 'FALSE' || s === 'NO' || s === '0');
}

/** true only for an explicit yes — blank / FALSE / 0 are all false. */
function isTrue(v) {
  var s = String(v).trim().toUpperCase();
  return v === true || s === 'TRUE' || s === 'YES' || s === 'Y' || s === '1';
}

/** Add (no id / unknown id) or update an event row. Returns { ok, event }. */
function saveEvent(ev) {
  var sheet = getSheet(EVENTS_SHEET, EVENT_HEADERS);
  var id = String(ev.id || '').trim() || ('e' + Date.now());
  var row = [
    id,
    String(ev.date || '').slice(0, 10),
    String(ev.endDate || '').slice(0, 10),
    String(ev.start || '').slice(0, 5),
    String(ev.end || '').slice(0, 5),
    String(ev.title || '').slice(0, 200),
    String(ev.category || 'Community').slice(0, 60),
    String(ev.location || '').slice(0, 200),
    String(ev.description || '').slice(0, 4000),
    String(ev.registerUrl || '').slice(0, 500),
    ev.published === false ? false : true,
    ev.needsVolunteers === true ? true : false,
    String(ev.volunteerHelp || '').slice(0, 500),
    String(ev.volunteerCount || '').slice(0, 10),
    String(ev.volunteerUrl || '').slice(0, 500)
  ];
  if (!row[1] || !row[5]) return { ok: false, error: 'missing_fields' };

  var r = findRow(sheet, id);
  if (r > 0) sheet.getRange(r, 1, 1, row.length).setValues([row]);
  else sheet.appendRow(row);

  ev.id = id;
  return { ok: true, event: ev };
}

function deleteEvent(id) {
  if (!id) return { ok: false, error: 'missing_id' };
  var sheet = getSheet(EVENTS_SHEET, EVENT_HEADERS);
  var r = findRow(sheet, id);
  if (r > 0) sheet.deleteRow(r);
  return { ok: true };
}

function findRow(sheet, id) {
  var last = sheet.getLastRow();
  if (last < 2) return -1;
  var ids = sheet.getRange(2, 1, last - 1, 1).getValues();
  for (var i = 0; i < ids.length; i++) if (String(ids[i][0]) === id) return i + 2;
  return -1;
}

function buildICS(events) {
  var L = [
    'BEGIN:VCALENDAR', 'VERSION:2.0',
    'PRODID:-//Washington Jungto Center//Events//EN',
    'CALSCALE:GREGORIAN', 'METHOD:PUBLISH',
    'X-WR-CALNAME:Washington Jungto Center',
    'REFRESH-INTERVAL;VALUE=DURATION:PT6H',
    'BEGIN:VTIMEZONE', 'TZID:' + TZID,
    'BEGIN:DAYLIGHT', 'TZOFFSETFROM:-0500', 'TZOFFSETTO:-0400', 'TZNAME:EDT',
    'DTSTART:19700308T020000', 'RRULE:FREQ=YEARLY;BYMONTH=3;BYDAY=2SU', 'END:DAYLIGHT',
    'BEGIN:STANDARD', 'TZOFFSETFROM:-0400', 'TZOFFSETTO:-0500', 'TZNAME:EST',
    'DTSTART:19701101T020000', 'RRULE:FREQ=YEARLY;BYMONTH=11;BYDAY=1SU', 'END:STANDARD',
    'END:VTIMEZONE'
  ];
  var stamp = Utilities.formatDate(new Date(), 'UTC', "yyyyMMdd'T'HHmmss'Z'");
  events.forEach(function (e) {
    var startD = e.date.replace(/-/g, '');
    var endD   = (e.endDate || e.date).replace(/-/g, '');
    L.push('BEGIN:VEVENT');
    L.push('UID:' + e.id + '@wajungto.org');
    L.push('DTSTAMP:' + stamp);
    if (e.start) {
      L.push('DTSTART;TZID=' + TZID + ':' + startD + 'T' + e.start.replace(':', '') + '00');
      L.push('DTEND;TZID='   + TZID + ':' + endD   + 'T' + (e.end || e.start).replace(':', '') + '00');
    } else {
      L.push('DTSTART;VALUE=DATE:' + startD);
    }
    L.push('SUMMARY:' + icsEsc(e.title));
    if (e.location) L.push('LOCATION:' + icsEsc(e.location));
    var d = e.description + (e.registerUrl && e.registerUrl !== '#' ? '\\n\\nRegister: ' + e.registerUrl : '');
    if (d) L.push('DESCRIPTION:' + icsEsc(d));
    L.push('END:VEVENT');
  });
  L.push('END:VCALENDAR');
  return L.map(icsFold).join('\r\n');
}

function icsEsc(s) {
  return String(s).replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n');
}
function icsFold(line) {
  if (line.length <= 74) return line;
  var out = [], s = line;
  while (s.length > 74) { out.push(s.slice(0, 74)); s = ' ' + s.slice(74); }
  out.push(s);
  return out.join('\r\n');
}


// ─── Photos (Google Drive) ─────────────────────────────────────────
function galleryFolder() {
  var props = PropertiesService.getScriptProperties();
  var id = props.getProperty('GALLERY_FOLDER_ID');
  if (id) { try { return DriveApp.getFolderById(id); } catch (e) {} }
  var it = DriveApp.getFoldersByName(GALLERY_FOLDER);
  var folder = it.hasNext() ? it.next() : DriveApp.createFolder(GALLERY_FOLDER);
  props.setProperty('GALLERY_FOLDER_ID', folder.getId());
  return folder;
}

function photoUrl(fileId) {
  return 'https://drive.google.com/thumbnail?id=' + fileId + '&sz=w1600';
}

function stripExt(n) { return String(n).replace(/\.[A-Za-z0-9]+$/, ''); }

// Cached ~30s so repeat Gallery loads are instant. Any upload / delete clears
// the cache immediately (see bustPhotoCache), so new photos never wait.
function getPhotos() {
  var cache = CacheService.getScriptCache();
  var hit = cache.get('photos');
  if (hit) { try { return JSON.parse(hit); } catch (e) {} }
  var list = computePhotos();
  try { cache.put('photos', JSON.stringify(list), 30); } catch (e) {}  // silently skips if the list is over the cache size limit
  return list;
}

function bustPhotoCache() {
  try { CacheService.getScriptCache().remove('photos'); } catch (e) {}
}

function computePhotos() {
  var files = galleryFolder().getFiles();
  var list = [];
  while (files.hasNext()) {
    var f = files.next();
    if (f.isTrashed()) continue;
    if (String(f.getMimeType()).indexOf('image/') !== 0) continue;
    list.push({
      id: f.getId(),
      url: photoUrl(f.getId()),
      caption: stripExt(f.getName()),
      date: Utilities.formatDate(f.getDateCreated(), TZID, 'yyyy-MM-dd HH:mm:ss')
    });
  }
  list.sort(function (a, b) { return b.date.localeCompare(a.date) || b.id.localeCompare(a.id); });
  return list.map(function (p) { return { id: p.id, url: p.url, caption: p.caption, date: p.date.slice(0, 10) }; });
}

function uploadPhoto(body) {
  var m = String(body.dataUrl || '').match(/^data:(image\/[A-Za-z0-9.+-]+);base64,([\s\S]*)$/);
  if (!m) return { ok: false, error: 'bad_image' };
  var mime = m[1];
  var bytes = Utilities.base64Decode(m[2]);
  if (bytes.length > 12 * 1024 * 1024) return { ok: false, error: 'too_large' };
  var ext = mime.split('/')[1].toLowerCase().replace('jpeg', 'jpg').replace(/[^a-z0-9]/g, '') || 'jpg';
  var base = String(body.name || 'photo').trim().replace(/[\/\\:*?"<>|]+/g, ' ').replace(/\s+/g, ' ').slice(0, 80) || 'photo';
  var file = galleryFolder().createFile(Utilities.newBlob(bytes, mime, base + '.' + ext));
  try { file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW); } catch (e) {}
  bustPhotoCache();
  return { ok: true, photo: { id: file.getId(), url: photoUrl(file.getId()), caption: base, date: todayStr() } };
}

function deletePhoto(id) {
  if (!id) return { ok: false, error: 'missing_id' };
  try { DriveApp.getFileById(id).setTrashed(true); }
  catch (e) { return { ok: false, error: 'not_found' }; }
  bustPhotoCache();
  return { ok: true };
}


// ─── Shared helpers ────────────────────────────────────────────────
function getSheet(name, headers) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(name);
  if (!sheet) {
    sheet = ss.insertSheet(name);
    sheet.appendRow(headers);
    sheet.setFrozenRows(1);
  } else if (headers) {
    // add any columns introduced in a later version (e.g. the volunteer fields)
    var have = sheet.getLastColumn();
    if (have < headers.length) {
      sheet.getRange(1, have + 1, 1, headers.length - have).setValues([headers.slice(have)]);
    }
  }
  return sheet;
}

function dateStr(v) {
  if (v instanceof Date) {
    return v.getFullYear() + '-' + ('0' + (v.getMonth() + 1)).slice(-2) + '-' + ('0' + v.getDate()).slice(-2);
  }
  return String(v || '').slice(0, 10);
}
function timeStr(v) {
  if (v instanceof Date) {
    return ('0' + v.getHours()).slice(-2) + ':' + ('0' + v.getMinutes()).slice(-2);
  }
  var s = String(v || '').trim();
  return s ? (s.length === 4 ? '0' + s : s).slice(0, 5) : '';
}
function parseYMD(s) {
  var p = String(s).slice(0, 10).split('-');
  return new Date(+p[0], (+p[1]) - 1, +p[2] || 1);
}
function todayStr() {
  var d = new Date();
  return d.getFullYear() + '-' + ('0' + (d.getMonth() + 1)).slice(-2) + '-' + ('0' + d.getDate()).slice(-2);
}
function json(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}


// ─── One-time helper: create both tabs with headers + sample rows ───
// Run this once from the Apps Script editor (Run ▸ setup) to lay out the sheet.
function setup() {
  var ev = getSheet(EVENTS_SHEET, EVENT_HEADERS);
  if (ev.getLastRow() < 2) {
    ev.appendRow(['e1', '2026-09-19', '', '19:00', '21:00',
      'Dharma Talk with Ven. Pomnyun Sunim', 'Ven. Pomnyun Sunim',
      'Main Hall + livestream',
      'A rare in-person visit. Talk followed by a live Q&A. Seating is limited — please register.',
      'https://example.org/register', true]);
  }
  getSheet(REVIEWS_SHEET, REVIEW_HEADERS);
  var folder = galleryFolder();   // creates the Drive folder + triggers the Drive permission prompt
  SpreadsheetApp.getActiveSpreadsheet().toast('Reviews / Events tabs ready. Photo folder: ' + folder.getName());
}
