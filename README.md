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

- `?action=vote&choice=<id>&d=<deviceId>` — record (one row per device; re-voting overwrites)
- `?action=counts&cb=<fn>` — JSONP counts, cached 20 s in `CacheService`
- `?action=reset&key=adrien-zhuazhou-2026` — wipe votes

Polling is **25 s, only while `#zhuazhou` is on screen and the tab is visible** — Apps
Script has a daily *script runtime* quota and 60 phones hammering it would blow through.

`_vote_setup/vote.gs` + `_vote_setup/SETUP.md` — deploy walkthrough.
Until the `/exec` URL is pasted into `VOTE_API`, the page shows 投票即將開放 and taps do nothing.

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
