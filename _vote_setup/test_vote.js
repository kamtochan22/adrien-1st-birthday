// Build a single node file = stubs + vote.gs + assertions, then run it.
const fs = require('fs');
const gs = fs.readFileSync(__dirname + '/vote.gs', 'utf8');

const stubs = `
function makeSheet() {
  const rows = [];
  return {
    rows,
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
}
const sheets = {};
const ss = {
  getSheetByName: (n) => sheets[n] || null,
  insertSheet: (n) => (sheets[n] = makeSheet()),
};
const votes = makeSheet();
votes.rows.push(['Timestamp','Choice','Device','Note']);
sheets['Votes'] = votes;
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
Utilities = { formatDate: (d, tz, fmt) => '2026-10-16 01:30' };
`;

const tests = `
const call = (p) => JSON.parse(doGet({ parameter: p }).getContent());
const post = (o) => JSON.parse(doPost({ postData: { contents: JSON.stringify(o) } }).getContent());
let pass = 0, fail = 0;
const t = (n, c, x='') => { c ? pass++ : fail++; console.log((c?'  PASS ':'  FAIL ') + n + (x ? '  ' + x : '')); };

// ---------------- zhuazhou vote (unchanged behaviour) ----------------
const js = doGet({ parameter: { cb: 'x' } }).getContent();
t('jsonp shape', js.startsWith('x(') && js.endsWith(')'));
t('version marker present', JSON.parse(doGet({parameter:{}}).getContent()).v === 3);
t('vote without a name is refused', call({ action:'vote', choice:'tennis', d:'devA' }).ok === false);
let r = call({ action:'vote', choice:'tennis', d:'devA', n:'Dicky' });
t('vote with a name appends', votes.rows.length === 2 && r.ok && r.total === 1);
const OPTS = ['calculator','pen','ingot','tennis','lipstick'];
for (let i = 0; i < 60; i++) call({ action:'vote', choice: OPTS[i % 5], d: 'phone'+i, n: 'Guest ' + i });
r = call({ action:'counts' });
t('60 phones -> 61 votes', r.total === 61, 'total='+r.total);
t('reset with key wipes', call({ action:'reset', key:'adrien-zhuazhou-2026' }).total === 0);

// ---------------- wedding RSVP via POST ----------------
t('RSVP sheet is created on first POST', !sheets['RSVP']);
let p = post({ name:'Stephanie Lau', email:'s@example.com', attendance:'joyfully-accepts',
               guests:'2', diet:'no nuts', note:'So happy!', source:'wedding-site', key:'k1' });
const rsvp = sheets['RSVP'];
t('RSVP sheet now exists', !!rsvp);
t('headers written', rsvp.rows[0][0] === 'Timestamp' && rsvp.rows[0][9] === 'Key', JSON.stringify(rsvp.rows[0]));
t('row appended', rsvp.rows.length === 2 && p.success === true && p.row === 2, JSON.stringify(p));
t('fields land in the right columns',
  rsvp.rows[1][2] === 'Stephanie Lau' && rsvp.rows[1][3] === 's@example.com' &&
  rsvp.rows[1][4] === 'joyfully-accepts' && rsvp.rows[1][5] === '2' &&
  rsvp.rows[1][6] === 'no nuts' && rsvp.rows[1][7] === 'So happy!', JSON.stringify(rsvp.rows[1]));
t('local HKT timestamp filled', rsvp.rows[1][1] === '2026-10-16 01:30', rsvp.rows[1][1]);

// the client retries 3x with the SAME key -> must not duplicate
p = post({ name:'Stephanie Lau', email:'s@example.com', attendance:'joyfully-accepts', key:'k1' });
p = post({ name:'Stephanie Lau', email:'s@example.com', attendance:'joyfully-accepts', key:'k1' });
t('retry with same key does not duplicate', rsvp.rows.length === 2 && p.dup === true, 'rows='+rsvp.rows.length);

// a different guest
p = post({ name:'Uncle Ben', email:'b@example.com', attendance:'regretfully-declines', key:'k2' });
t('second RSVP appends', rsvp.rows.length === 3 && p.row === 3);

// no key at all -> still records (never lose a reply)
p = post({ name:'No Key', email:'n@example.com', attendance:'joyfully-accepts' });
t('missing key still records', rsvp.rows.length === 4 && p.success === true);

// sanitising + caps
post({ name:'  Ba\\u0007d\\nName  ', email:'x@y.com', attendance:'joyfully-accepts',
       note:'line1\\nline2', diet:'z'.repeat(400), key:'k3' });
const lastRow = rsvp.rows[rsvp.rows.length-1];
t('name cleaned', lastRow[2] === 'Bad Name', JSON.stringify(lastRow[2]));
t('note newlines become spaces', lastRow[7] === 'line1 line2', JSON.stringify(lastRow[7]));
t('diet capped at 200', lastRow[6].length === 200, 'len='+lastRow[6].length);

// junk body must not create a row
p = post({});
t('empty POST object is ignored', p.success === false && rsvp.rows.length === 5, JSON.stringify(p));

// lock unavailable -> still records
lockHeld = true;
p = post({ name:'Locky', email:'l@x.com', attendance:'joyfully-accepts', key:'k9' });
lockHeld = false;
t('RSVP records even if lock busy', p.success === true);

// reset must NOT touch RSVP
call({ action:'reset', key:'adrien-zhuazhou-2026' });
t('vote reset leaves RSVP alone', sheets['RSVP'].rows.length === 6, 'rsvp rows='+sheets['RSVP'].rows.length);

console.log('\\n' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
`;

fs.writeFileSync('/tmp/adrien_vote_run.js', stubs + '\n' + gs + '\n' + tests);
console.log('built /tmp/adrien_vote_run.js');
