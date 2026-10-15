// Build a single node file = stubs + vote.gs + assertions, then run it.
const fs = require('fs');
const gs = fs.readFileSync(__dirname + '/vote.gs', 'utf8');

const stubs = `
const rows = [['Timestamp','Choice','Device','Note']];
const sheet = {
  getLastRow: () => rows.length,
  appendRow: (r) => rows.push(r.slice()),
  deleteRows: (start, n) => { rows.splice(start - 1, n); },
  getRange: (row, col, nRows, nCols) => ({
    getValues: () => rows.slice(row-1, row-1+nRows).map(r => r.slice(col-1, col-1+nCols)),
    getValue: () => (rows[row-1] || [])[col-1],
    setValue: (v) => { rows[row-1][col-1] = v; },
  }),
  setFontWeight: () => {},
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

// --- names
t('vote without a name is refused', call({ action:'vote', choice:'tennis', d:'devA' }).ok === false);
t('blank name is refused', call({ action:'vote', choice:'tennis', d:'devA', n:'   ' }).ok === false);

let r = call({ action:'vote', choice:'tennis', d:'devA', n:'Dicky' });
t('vote with a name appends', rows.length === 2 && r.ok && r.total === 1, JSON.stringify(r));
t('name lands in column D', rows[1][3] === 'Dicky', 'D=' + rows[1][3]);
t('voters returned', JSON.stringify(r.voters) === JSON.stringify([{n:'Dicky', c:'tennis'}]), JSON.stringify(r.voters));

r = call({ action:'vote', choice:'pen', d:'devA', n:'Dicky Chan' });
t('same device overwrites', rows.length === 2 && r.updated === true && r.total === 1);
t('name updated too', rows[1][3] === 'Dicky Chan' && rows[1][1] === 'pen');
t('voters after overwrite', r.voters.length === 1 && r.voters[0].c === 'pen', JSON.stringify(r.voters));

// the 3x client retry must not multiply
call({ action:'vote', choice:'tennis', d:'devA', n:'Dicky Chan' });
call({ action:'vote', choice:'tennis', d:'devA', n:'Dicky Chan' });
r = call({ action:'vote', choice:'tennis', d:'devA', n:'Dicky Chan' });
t('3x retry stays 1', r.total === 1 && rows.length === 2 && r.voters.length === 1);

// 60 phones, named
const OPTS = ['calculator','pen','ingot','tennis','lipstick'];
const NAMES = ['姑媽 May','Uncle Ben','Adrien 表姐','陳師傅','Alice','Bobby','Carmen','大舅父','德叔','Elaine'];
for (let i = 0; i < 60; i++) call({ action:'vote', choice: OPTS[i % 5], d: 'phone'+i, n: NAMES[i % 10] + ' ' + i });
r = call({ action:'counts' });
t('60 phones -> 61 votes', r.total === 61, 'total='+r.total);
t('61 voters listed', r.voters.length === 61, 'voters='+r.voters.length);
t('counts add up', Object.values(r.counts).reduce((a,b)=>a+b,0) === 61, JSON.stringify(r.counts));
t('every voter has a name + choice', r.voters.every(v => v.n && v.c));
t('no unnamed placeholder when names given', !r.voters.some(v => v.n === '無名'));

// sanitising
r = call({ action:'vote', choice:'pen', d:'devX', n:'  Ba\\u0007d\\nName  ' });
t('control chars + newlines stripped', rows[rows.length-1][3] === 'Bad Name', 'D=' + JSON.stringify(rows[rows.length-1][3]));
r = call({ action:'vote', choice:'pen', d:'devY', n:'x'.repeat(50) });
t('name capped at 20', rows[rows.length-1][3].length === 20, 'len=' + rows[rows.length-1][3].length);
r = call({ action:'vote', choice:'pen', d:'devZ' });
t('missing name refused, no row', r.ok === false && rows[rows.length-1][3] === 'x'.repeat(20));

// bad choice
r = call({ action:'vote', choice:'banana', d:'devQ', n:'Q' });
t('bad choice rejected', r.ok === false);

// reset
const before = rows.length;
t('reset without key refused', call({ action:'reset', key:'nope' }).reset === undefined && rows.length === before);
r = call({ action:'reset', key:'adrien-zhuazhou-2026' });
t('reset with key wipes', rows.length === 1 && r.total === 0 && r.voters.length === 0, 'rows='+rows.length);

// lock unavailable -> still records
lockHeld = true;
r = call({ action:'vote', choice:'pen', d:'devLock', n:'Locky' });
lockHeld = false;
t('records even if lock busy', r.ok === true && rows.length === 2 && r.voters[0].n === 'Locky');

console.log('\\n' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
`;

fs.writeFileSync('/tmp/adrien_vote_run.js', stubs + '\n' + gs + '\n' + tests);
console.log('built /tmp/adrien_vote_run.js');
