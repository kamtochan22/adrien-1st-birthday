const SHEET_NAME = 'Votes';
const RESET_KEY  = 'adrien-zhuazhou-2026';
const CACHE_SEC  = 20;
const CHOICES    = ['calculator','pen','ingot','tennis','lipstick'];

function sheet_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sh = ss.getSheetByName(SHEET_NAME);
  if (!sh) sh = ss.insertSheet(SHEET_NAME);
  if (sh.getLastRow() === 0) sh.appendRow(['Timestamp','Choice','Device','Note']);
  return sh;
}
function counts_() {
  const c = CacheService.getScriptCache(), hit = c.get('counts');
  if (hit) return JSON.parse(hit);
  const sh = sheet_(), o = {}; CHOICES.forEach(function (k) { o[k] = 0; });
  const last = sh.getLastRow();
  if (last > 1) sh.getRange(2, 2, last - 1, 1).getValues().forEach(function (r) {
    const v = String(r[0]).trim(); if (o[v] !== undefined) o[v]++;
  });
  const total = CHOICES.reduce(function (s, k) { return s + o[k]; }, 0);
  const out = { ok: true, counts: o, total: total };
  c.put('counts', JSON.stringify(out), CACHE_SEC);
  return out;
}
function record_(p) {
  const choice = String(p.choice || '').trim(), dev = String(p.d || '').slice(0, 40);
  if (CHOICES.indexOf(choice) < 0) return { ok: false, error: 'bad choice' };
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
          CacheService.getScriptCache().remove('counts');
          const a = counts_();
          return { ok: true, updated: true, counts: a.counts, total: a.total };
        }
      }
    }
    sh.appendRow([new Date().toISOString(), choice, dev, '']);
    CacheService.getScriptCache().remove('counts');
    const b = counts_();
    return { ok: true, counts: b.counts, total: b.total };
  } finally { try { lock.releaseLock(); } catch (e) {} }
}
function doGet(e) {
  const p = (e && e.parameter) || {};
  let out;
  try {
    if (p.action === 'vote') out = record_(p);
    else if (p.action === 'reset' && p.key === RESET_KEY) {
      const sh = sheet_();
      if (sh.getLastRow() > 1) sh.deleteRows(2, sh.getLastRow() - 1);
      CacheService.getScriptCache().remove('counts');
      out = { ok: true, reset: true, counts: counts_().counts, total: 0 };
    } else out = counts_();
  } catch (err) { out = { ok: false, error: String(err) }; }
  const cb = p.cb;
  return ContentService
    .createTextOutput(cb ? cb + '(' + JSON.stringify(out) + ')' : JSON.stringify(out))
    .setMimeType(cb ? ContentService.MimeType.JAVASCRIPT : ContentService.MimeType.JSON);
}
