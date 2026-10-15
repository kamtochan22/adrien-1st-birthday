const SHEET_NAME = 'Votes';
const RESET_KEY  = 'adrien-zhuazhou-2026';
const CACHE_SEC  = 20;
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
    .replace(/[\r\n\t]+/g, ' ')                 // 換行／Tab 當空格
    .replace(/[\u0000-\u001f\u007f]/g, '')      // 其他控制字元直接掉走
    .replace(/\s+/g, ' ')
    .trim().slice(0, n);
}
function bust_() { CacheService.getScriptCache().remove('payload'); }

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

function doGet(e) {
  const p = (e && e.parameter) || {};
  let out;
  try {
    if (p.action === 'vote') out = record_(p);
    else if (p.action === 'reset' && p.key === RESET_KEY) {
      const sh = sheet_();
      if (sh.getLastRow() > 1) sh.deleteRows(2, sh.getLastRow() - 1);
      bust_();
      out = { ok: true, reset: true, counts: payload_().counts, total: 0, voters: [] };
    } else out = payload_();
  } catch (err) { out = { ok: false, error: String(err) }; }
  const cb = p.cb;
  return ContentService
    .createTextOutput(cb ? cb + '(' + JSON.stringify(out) + ')' : JSON.stringify(out))
    .setMimeType(cb ? ContentService.MimeType.JAVASCRIPT : ContentService.MimeType.JSON);
}
