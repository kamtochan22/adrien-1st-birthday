# Welcome to Adrien 1st Birthday Party

One-page day-of site for Adrien (陳綽霆) 1st birthday — 17 Oct 2026, Club Lusitano 27/F.
Static site on **GitHub Pages**: <https://kamtochan22.github.io/adrien-1st-birthday/>

## The five pages

| # | id | what |
|---|---|---|
| 1 | `.hero` | Full-bleed photo (3 rotating), `Welcome to Adrien 1st Birthday Party` in Huninn |
| 2 | `#rundown` | 今日流程 — the 6 guest-facing rows off the A4 rundown card (RUNDOWN header, brick red `#A83A2C`, Quicksand + 中文 gloss) |
| 3 | `#film` | Growth film, one tap to play. `video/growth.mp4` |
| 4 | `#zhuazhou` | 抓周投票 — 5 choices, live counts |
| 5 | `#message` | `We have a message to you` → tap → envelope opens → the wedding invitation card |
| 5b | `#wedding` | after the letter opens, scrolling continues into the **whole wedding invitation site**, embedded |

### Page 5b — the invitation itself
`#wedding` is `display:none` until `body.letter-open` (set at the end of the envelope
timeline), so the ordering can't be short-circuited. It then lazy-loads

    https://kamtochan22.github.io/stephanie-richard-wedding/?skipenvelope=1

in a `100svh` iframe. `skipenvelope=1` is a backwards-compatible param added to the
wedding site so it drops its **own** intro envelope (`html.skip-envelope` hides
`#opener` and skips the scroll lock) — otherwise the guest opens one envelope and
finds a second one waiting below. Default behaviour there is unchanged.
GitHub Pages sends no `X-Frame-Options`/CSP, so framing is allowed — verified.
A 「喺新視窗打開完整邀請」 link is the fallback; the spinner also gives up after 9 s.

### Page 2 keeps to the guest-facing facts only
Time / what happens. **Not** on the page: headcount, seating, who's responsible,
special meals, or anyone who isn't coming — that lives in
`~/Documents/Adrien週歲Party/05_Rundown/Rundown-17Oct.md`.

### Page 3 — the film
Source `~/remotion-poc/src/Growth.tsx` (`body_720.mp4`, 107 s, 9:16).
Web copy: CRF 28, `+faststart`, 96 kbps AAC → **11.4 MB** (was 54 MB).
Cover frame = t=88 s, letterbox bands auto-detected and cropped out (`video/poster.jpg`).

### Page 4 — the vote backend
GitHub Pages is static, so it can't count votes. Uses **Google Apps Script + Google
Sheet** over GET + JSONP (no CORS, works on every phone):

- `?action=vote&choice=<id>&d=<deviceId>&n=<name>` — record (one row per device;
  re-voting overwrites both choice and name). Name is **required** by the server.
- `?action=counts&cb=<fn>` — JSONP `{counts, total, voters:[{n,c}]}`, cached 20 s
- `?action=reset&key=adrien-zhuazhou-2026` — wipe votes

Sheet columns: `Timestamp | Choice | Device | Name`. Names are shown publicly on
the page under 「邊個估邊樣」, grouped by choice — guests see who guessed what.
Names are escaped before insertion into the DOM.

Polling is **40 s, only while `#zhuazhou` is on screen and the tab is visible**,
capped at 30 auto-refreshes per page load and stopped entirely after 16:00 on party
day — Apps Script has a daily *script runtime* quota and 60 phones hammering it
would blow through it. A manual 「更新票數」 button takes over once polling stops.

`_vote_setup/vote.gs` + `_vote_setup/SETUP.md` + `_vote_setup/test_vote.js`
(23 assertions against stubbed Google services: `node test_vote.js && node /tmp/adrien_vote_run.js`).

### Page 5 — ported from the wedding site
`~/Projects/stephanie-richard-wedding/index.html` envelope opener, lifted into the
`#message` section and scoped (`body.opening` → `#message.opening`, assets under
`wedding/`). `layoutEnvelope()` still maps `--flap` / `--pk-*` / `--seal-*` from the
699×1252 artwork, so creases and the wax seal stay aligned at any viewport.

## Local preview

```bash
cd ~/Projects/adrien-1st-birthday && python3 -m http.server 8899
# → http://127.0.0.1:8899/
```

## Pitfalls hit while building

- **Headless Chrome `--window-size` doesn't set the layout viewport** (you get 500×757,
  and the screenshot crops it) — text looks broken when it isn't. Screenshot through a
  **same-origin `<iframe>` of the exact size** instead; the iframe gets the real viewport.
- `text-wrap:balance` on a phrase wider than its box **overflows instead of wrapping**.
  For a long single line use `text-wrap:normal` + a size that actually fits.
- Inline `<span>`s with no whitespace between them run together —
  `Guests arrive賓客到場`. Needs `display:block` (or a real space).
- `--virtual-time-budget` fast-forwards `setTimeout` but **not CSS transitions**, so
  `getComputedStyle` mid-sequence returns the transition's *start* value. Judge
  animations from the screenshot, not from a timing probe.
- The envelope's `--k/--tx/--ty` are set by `openLetter()`. Adding `.expand` by hand in a
  test skips that and the card never scales — dispatch a real `click()` instead.
