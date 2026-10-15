/**
 * Adrien 一歲生日 — 抓周投票 backend
 * Google Apps Script + Google Sheet，用 GET + JSONP，唔使 CORS。
 *
 * 設定（詳見 _vote_setup/SETUP.md）：
 *  1. 開一個新 Google Sheet（sheets.new）
 *  2. Extensions → Apps Script → 清空編輯器 → 貼上呢個檔案
 *  3. Deploy → New deployment → Web app
 *       Execute as: Me       Who has access: Anyone
 *  4. 授權 → 抄個 /exec URL → 貼落 index.html 嘅 VOTE_API
 */

const SHEET_NAME = 'Votes';
const RESET_KEY  = 'adrien-zhuazhou-2026';   // 只你知；?action=reset&key=... 可清空票數
const CACHE_SEC  = 20;                        // 票數快取，減少讀 Sheet
const CHOICES    = ['calculator', 'pen', 'ingot', 'tennis', 'lipstick'];

function sheet_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sh = ss.getSheetByName(SHEET_NAME);
  if (!sh) sh = ss.insertSheet(SHEET_NAME);
  if (sh.getLastRow() === 0) {
    sh.appendRow(['Timestamp', 'Choice', 'Device', 'Note']);
    sh.getRange('A1:D1').setFontWeight('bold');
  }
  return sh;
}

function counts_() {
  const cache = CacheService.getScriptCache();
  const hit = cache.get('counts');
  if (hit) return JSON.parse(hit);

  const sh = sheet_();
  const c = {};
  CHOICES.forEach(function (k) { c[k] = 0; });
  const last = sh.getLastRow();
  if (last > 1) {
    sh.getRange(2, 2, last - 1, 1).getValues().forEach(function (r) {
      const v = String(r[0]).trim();
      if (c[v] !== undefined) c[v]++;
    });
  }
  let total = 0;
  CHOICES.forEach(function (k) { total += c[k]; });
  const out = { ok: true, counts: c, total: total, at: new Date().toISOString() };
  cache.put('counts', JSON.stringify(out), CACHE_SEC);
  return out;
}

function record_(p) {
  const choice = String(p.choice || '').trim();
  if (CHOICES.indexOf(choice) < 0) return { ok: false, error: 'bad choice' };
  const dev = String(p.d || '').slice(0, 40);

  // 60 部電話同一秒撳：Apps Script 會並行跑幾個 execution，兩個同時掃 device 欄
  // 會各自以為「未投過」而寫兩行。鎖一鎖寫入，避免同一部機被計兩票。
  // 攞唔到鎖都照寫 —— 少一票好過冇一票。
  const lock = LockService.getScriptLock();
  try { lock.waitLock(4000); } catch (e) {}

  try {
    const sh = sheet_();
    const last = sh.getLastRow();

    // one vote per device: same device id votes again → overwrite its old row
    if (dev && last > 1) {
      const devs = sh.getRange(2, 3, last - 1, 1).getValues();
      for (let i = 0; i < devs.length; i++) {
        if (String(devs[i][0]) === dev) {
          sh.getRange(i + 2, 1).setValue(new Date().toISOString());
          sh.getRange(i + 2, 2).setValue(choice);
          CacheService.getScriptCache().remove('counts');
          return { ok: true, updated: true, counts: counts_().counts, total: counts_().total };
        }
      }
    }

    sh.appendRow([new Date().toISOString(), choice, dev, '']);
    CacheService.getScriptCache().remove('counts');
    const c = counts_();
    return { ok: true, counts: c.counts, total: c.total };
  } finally {
    try { lock.releaseLock(); } catch (e) {}
  }
}

function reset_() {
  const sh = sheet_();
  if (sh.getLastRow() > 1) sh.deleteRows(2, sh.getLastRow() - 1);
  CacheService.getScriptCache().remove('counts');
  return { ok: true, reset: true, counts: counts_().counts, total: 0 };
}

function doGet(e) {
  const p = (e && e.parameter) || {};
  let out;
  try {
    if (p.action === 'vote') out = record_(p);
    else if (p.action === 'reset' && p.key === RESET_KEY) out = reset_();
    else out = counts_();
  } catch (err) {
    out = { ok: false, error: String(err) };
  }
  const cb = p.cb;
  const body = cb ? cb + '(' + JSON.stringify(out) + ')' : JSON.stringify(out);
  return ContentService
    .createTextOutput(body)
    .setMimeType(cb ? ContentService.MimeType.JAVASCRIPT : ContentService.MimeType.JSON);
}

/** 方便你喺 Apps Script 一撳就睇票數（唔影響網站） */
function showCounts() {
  const c = counts_();
  Logger.log(JSON.stringify(c, null, 2));
}
