// Build a single node file = stubs + vote.gs + assertions, then run it.
const fs = require('fs');
const gs = fs.readFileSync('./vote.gs', 'utf8');

const stubs = `
const rows = [['Timestamp','Choice','Device','Note']];
const sheet = {
  getLastRow: () => rows.length,
  appendRow: (r) => rows.push(r.slice()),
  getRange: (row, col, nRows, nCols) => ({
    getValues: () => rows.slice(row-1, row-1+nRows).map(r => r.slice(col-1, col-1+nCols)),
    setValue: (v) => { rows[row-1][col-1] = v; },
  }),
  setFontWeight: () => {},
  deleteRows: (start, n) => { rows.splice(start - 1, n); },
};
const ss = { getSheetByName: (n) => (n === 'Votes' ? sheet : null), insertSheet: () => sheet };
SpreadsheetApp = { getActiveSpreadsheet: () => ss };
const cacheStore = {};
CacheService = { getScriptCache: () => ({
  get: (k) => cacheStore[k] || null, put: (k,v) => { cacheStore[k]=v; }, remove: (k) => { delete cacheStore[k]; } }) };
let lockHeld = false;
LockService = { getScriptLock: () => ({
  waitLock: () => { if (lockHeld) throw new Error('busy'); lockHeld = true; },
  releaseLock: () => { lockHeld = false; } }) };
ContentService = { MimeType: { JSON:'json', JAVASCRIPT:'js' },
  createTextOutput: (s) => ({ _s:s, setMimeType(){return this;}, getContent(){return this._s;} }) };
`;

const tests = `
const call = (p) => JSON.parse(doGet({ parameter: p }).getContent());
let pass = 0, fail = 0;
const t = (n, c, x='') => { c ? pass++ : fail++; console.log((c?'  PASS ':'  FAIL ') + n + (x ? '  ' + x : '')); };

const js = doGet({ parameter: { cb: 'x' } }).getContent();
t('jsonp shape', js.startsWith('x(') && js.endsWith(')'));
t('jsonp inner is json', (() => { try { JSON.parse(js.slice(2,-1)); return true; } catch { return false; } })());

let r = call({ action:'vote', choice:'tennis', d:'devA' });
t('new vote appends', rows.length === 2 && r.ok && r.total === 1, JSON.stringify(r));

r = call({ action:'vote', choice:'pen', d:'devA' });
t('same device overwrites', rows.length === 2 && r.updated === true && r.total === 1, JSON.stringify(r));
t('choice updated', rows[1][1] === 'pen');

call({ action:'vote', choice:'tennis', d:'devA' });
call({ action:'vote', choice:'tennis', d:'devA' });
r = call({ action:'vote', choice:'tennis', d:'devA' });
t('3x client retry stays 1 vote', r.total === 1 && rows.length === 2, 'total='+r.total+' rows='+rows.length);

const OPTS = ['calculator','pen','ingot','tennis','lipstick'];
for (let i = 0; i < 60; i++) call({ action:'vote', choice: OPTS[i % 5], d: 'phone'+i });
r = call({ action:'counts' });
// devA is still in the sheet -> 60 fresh phones + devA = 61
t('60 phones -> 61 votes', r.total === 61, 'total='+r.total);
t('counts add up', Object.values(r.counts).reduce((a,b)=>a+b,0) === 61, JSON.stringify(r.counts));
t('rows = header + 61 voters', rows.length === 62, 'rows='+rows.length);

r = call({ action:'vote', choice:'banana', d:'devZ' });
t('bad choice rejected', r.ok === false && rows.length === 62);

r = call({ action:'reset', key:'wrong' });
t('reset without key refused', rows.length === 62);
r = call({ action:'reset', key:'adrien-zhuazhou-2026' });
t('reset with key wipes', rows.length === 1 && r.total === 0, 'rows='+rows.length);

// concurrent-ish: lock unavailable -> must still record, not throw
lockHeld = true;
r = call({ action:'vote', choice:'pen', d:'devLocked' });
lockHeld = false;
t('records even if lock busy', r.ok === true && rows.length === 2, JSON.stringify(r));

// double-tap the SAME device from a cold cache (worst case for the dedupe scan)
call({ action:'vote', choice:'ingot', d:'devLocked' });
r = call({ action:'counts' });
t('re-vote from a new choice still 1 row', rows.length === 2 && r.total === 1, 'rows='+rows.length+' total='+r.total);

console.log('\\n' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
`;

fs.writeFileSync('/tmp/adrien_vote_run.js', stubs + '\n' + gs + '\n' + tests);
console.log('built /tmp/adrien_vote_run.js');
