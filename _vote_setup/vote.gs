const SHEET_NAME = 'Votes';
const RESET_KEY  = 'adrien-zhuazhou-2026';
const CACHE_SEC  = 20;
const VERSION    = 4;                       // 每改一次 +1；GET 回應會帶住佢，一眼知換到未
const CHOICES    = ['calculator','pen','ingot','tennis','lipstick'];

function sheet_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sh = ss.getSheetByName(SHEET_NAME);
  if (!sh) sh = ss.insertSheet(SHEET_NAME);
  if (sh.getLastRow() === 0) sh.appendRow(['Timestamp','Choice','Device','Name']);
  return sh;
}
function clean_(s, n) {
  return String(s == null ? '' : s)
    .replace(/[\r\n\t]+/g, ' ')
    .replace(/[\u0000-\u001f\u007f]/g, '')
    .replace(/\s+/g, ' ')
    .trim().slice(0, n);
}
function bust_() { CacheService.getScriptCache().remove('payload'); }
function out_(o) {
  return ContentService.createTextOutput(JSON.stringify(o))
    .setMimeType(ContentService.MimeType.JSON);
}

function payload_() {
  const c = CacheService.getScriptCache(), hit = c.get('payload');
  if (hit) return JSON.parse(hit);
  const sh = sheet_(), o = {}, voters = [];
  CHOICES.forEach(function (k) { o[k] = 0; });
  const last = sh.getLastRow();
  if (last > 1) sh.getRange(2, 1, last - 1, 4).getValues().forEach(function (r) {
    const ch = clean_(r[1], 20);
    if (o[ch] !== undefined) { o[ch]++; voters.push({ n: clean_(r[3], 20) || '無名', c: ch }); }
  });
  const total = CHOICES.reduce(function (s, k) { return s + o[k]; }, 0);
  const out = { ok: true, counts: o, total: total, voters: voters };
  c.put('payload', JSON.stringify(out), CACHE_SEC);
  return out;
}

function record_(p) {
  const choice = clean_(p.choice, 20), dev = clean_(p.d, 40), nm = clean_(p.n, 20);
  if (CHOICES.indexOf(choice) < 0) return { ok: false, error: 'bad choice' };
  if (!nm) return { ok: false, error: 'no name' };
  const lock = LockService.getScriptLock();
  try { lock.waitLock(4000); } catch (e) {}
  try {
    const sh = sheet_(), last = sh.getLastRow();
    if (dev && last > 1) {
      const devs = sh.getRange(2, 3, last - 1, 1).getValues();
      for (let i = 0; i < devs.length; i++) {
        if (String(devs[i][0]) === dev) {
          sh.getRange(i + 2, 1).setValue(new Date().toISOString());
          sh.getRange(i + 2, 2).setValue(choice);
          sh.getRange(i + 2, 4).setValue(nm);
          bust_();
          const a = payload_();
          return { ok: true, updated: true, counts: a.counts, total: a.total, voters: a.voters };
        }
      }
    }
    sh.appendRow([new Date().toISOString(), choice, dev, nm]);
    bust_();
    const b = payload_();
    return { ok: true, counts: b.counts, total: b.total, voters: b.voters };
  } finally { try { lock.releaseLock(); } catch (e) {} }
}

/* ---------- wedding RSVP: the same deployment also receives the form ---------- */
function rsvpSheet_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sh = ss.getSheetByName('RSVP');
  if (!sh) sh = ss.insertSheet('RSVP');
  if (sh.getLastRow() === 0) {
    sh.appendRow(['Timestamp','Local','Name','Email','Attendance','Guests','Dietary','Note','Source','Key']);
  }
  return sh;
}

/* 畀客人個網頁查「我嗰行入到未」——POST 係 opaque（no-cors 讀唔到回應），
   所以要用 GET + JSONP 補一槍先算真正確認。 */
function rsvpCheck_(k) {
  const key = clean_(k, 24);
  if (!key) return { ok: false, found: false };
  const sh = rsvpSheet_(), last = sh.getLastRow();
  if (last < 2) return { ok: true, found: false };
  const keys = sh.getRange(2, 10, last - 1, 1).getValues();
  for (let i = 0; i < keys.length; i++) {
    if (String(keys[i][0]) === key) return { ok: true, found: true, row: i + 2 };
  }
  return { ok: true, found: false };
}

function doPost(e) {
  try {
    const d = JSON.parse((e && e.postData && e.postData.contents) || '{}');
    const who = clean_(d.name, 60) || clean_(d.email, 80);
    if (!who) return out_({ success: false, error: 'empty' });   // 空 body 唔好寫垃圾行
    const lock = LockService.getScriptLock();
    try { lock.waitLock(4000); } catch (err) {}
    try {
      const sh = rsvpSheet_(), k = clean_(d.key, 24), last = sh.getLastRow();
      if (k && last > 1) {
        const keys = sh.getRange(2, 10, last - 1, 1).getValues();
        for (let i = 0; i < keys.length; i++) {
          if (String(keys[i][0]) === k) return out_({ success: true, dup: true, row: i + 2 });
        }
      }
      sh.appendRow([
        new Date().toISOString(),
        Utilities.formatDate(new Date(), 'GMT+8', 'yyyy-MM-dd HH:mm'),
        clean_(d.name, 60), clean_(d.email, 80), clean_(d.attendance, 30),
        clean_(d.guests, 4), clean_(d.diet, 200), clean_(d.note, 500),
        clean_(d.source, 30) || 'wedding-site', k
      ]);
      return out_({ success: true, row: sh.getLastRow() });
    } finally { try { lock.releaseLock(); } catch (err) {} }
  } catch (err) {
    return out_({ success: false, error: String(err) });
  }
}

function doGet(e) {
  const p = (e && e.parameter) || {};
  let out;
  try {
    if (p.action === 'vote') out = record_(p);
    else if (p.action === 'rsvpcheck') out = rsvpCheck_(p.key);
    else if (p.action === 'reset' && p.key === RESET_KEY) {
      const sh = sheet_();
      if (sh.getLastRow() > 1) sh.deleteRows(2, sh.getLastRow() - 1);
      bust_();
      out = { ok: true, reset: true, counts: payload_().counts, total: 0, voters: [] };
    } else out = payload_();
  } catch (err) { out = { ok: false, error: String(err) }; }
  if (out && typeof out === 'object') out.v = VERSION;   // 版本印記：一眼睇到換到未
  const cb = p.cb;
  return ContentService
    .createTextOutput(cb ? cb + '(' + JSON.stringify(out) + ')' : JSON.stringify(out))
    .setMimeType(cb ? ContentService.MimeType.JAVASCRIPT : ContentService.MimeType.JSON);
}
