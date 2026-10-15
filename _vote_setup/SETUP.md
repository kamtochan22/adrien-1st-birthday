# 抓周投票 — 開通步驟（Google Apps Script + Sheet）

GitHub Pages 只係靜態網頁，冇伺服器幫你記票。所以票數擺喺 Google Sheet，
用 Apps Script 做一個「網址」畀網頁讀寫。全程免費，唔使信用卡。

做完之後，網站個投票就會即刻有數。

---

## 1. 開一個 Sheet

1. 開 <https://sheets.new>
2. 左上角改個名：`Adrien 抓周投票`
3. 唔使打任何字 —— 欄位標題由程式自己加

> ⚠️ 唔好改 tab 名。要係 `Sheet1`，程式會自動開一個叫 `Votes` 嘅 tab。

## 2. 貼程式碼

1. 上面選單 `Extensions`（擴充功能）→ `Apps Script`
2. 會開一個新 tab，入面有個 `Code.gs`，內容係 `function myFunction() {}`
3. **全選（⌘A）→ 刪除**
4. 貼上 `vote.gs` 嘅全部內容（同一個資料夾）
5. 撳 💾 儲存（或 ⌘S）

> ⚠️ 唔好改 `RESET_KEY`，記住佢：`adrien-zhuazhou-2026`

## 3. 部署成 Web App

1. 右上角藍色 `Deploy`（部署）→ `New deployment`（新增部署）
2. 左邊齒輪 ⚙️ → 揀 `Web app`（網頁應用程式）
3. 填：
   - **Description**：`zhuazhou vote`
   - **Execute as**：`Me`（我）
   - **Who has access**：`Anyone`（任何人）
4. 撳 `Deploy`
5. 會彈出授權視窗 → `Authorize access` → 揀你嘅 Google 帳號
6. 見到「Google hasn't verified this app」→ 撳 `Advanced`（進階）→
   `Go to ... (unsafe)` → `Allow`
7. 抄低嗰個 **Web app URL**（結尾係 `/exec`）

> ⚠️ 呢一步最易中招：`Who has access` 一定要揀 **Anyone**。
> 揀錯 `Only myself`，賓客部電話就讀唔到票數。
> ⚠️ 認證完之後，如果個 URL 開出嚟係「Sorry, unable to open the file」，
> 就係要**重新部署一次**：`Deploy` → `Manage deployments` → ✏️ → `Version: New version` → `Deploy`。

## 4. 貼返落網站

把個 `/exec` URL 貼落 `index.html` 呢一行：

```js
const VOTE_API = 'https://script.google.com/macros/s/AKfy..... /exec';
```

（原本寫住 `PASTE_APPS_SCRIPT_WEB_APP_URL_HERE`）

改完 push 上去 GitHub，等 1–2 分鐘 Pages rebuild 就好。

## 5. 自己試一次

1. 開網站，落到「抓周投票」
2. 填個名，撳「網球」
3. 去 Sheet 睇下 `Votes` tab 有冇多一行（D 欄應該有你個名）
4. 開另一個瀏覽器（或無痕）再投，票數應該加
5. 網頁下面應該出「邊個估邊樣」名單

> ⚠️ 順手改一改：Sheet 入面 D1 原本寫 `Note`，改成 `Name` 好睇啲
> （唔改都運作正常，只係標題字眼）

## 驗收 checklist

- [ ] Sheet `Votes` tab 有 `Timestamp / Choice / Device / Name` 四個標題
- [ ] 冇填名就撳 → 投票唔成立，輸入框紅框 + 提示
- [ ] 填咗名撳 → Sheet 多一行，有選擇 + 有名字
- [ ] 同一部機再撳，係**覆蓋**舊票，唔係加一行
- [ ] 網站票數條 bar 有數，total 加咗
- [ ] 下面「邊個估邊樣」出到名，跟選項分組
- [ ] 手機 Safari 開都投到（iOS 一定要試）

## 出事點救

| 症狀 | 原因 / 解決 |
|---|---|
| 網站寫「投票即將開放」 | `VOTE_API` 未貼，或唔係以 `http` 開頭 |
| bar 永遠 0 | Apps Script `Who has access` 唔係 `Anyone` |
| Console 見 `SyntaxError` 喺 `?cb=` | 部署版本舊；重新 deploy 一個 New version |
| 想清空票數重來 | 瀏覽器開 `<URL>?action=reset&key=adrien-zhuazhou-2026` |
| 票數 load 得好慢 | 正常。快取 20 秒，網頁每 40 秒讀一次（慳 Apps Script 每日額度） |
| 票數比實際人數多 | 唔應該發生（LockService 擋咗重覆寫入）。開 Sheet 睇下係唔係同名 device 有兩行 |

## 本機測試（唔使上 Google）

`vote.gs` 嘅邏輯可以喺 node 度跑，用假嘅 SpreadsheetApp / CacheService /
LockService / ContentService。14 條 assertion：一部機一票、重覆送 3 次唔會
三重計、60 部電話 = 60 票、壞 choice 唔收、reset 要 key、攞唔到鎖都照寫。

```bash
node _vote_setup/test_vote.js && node /tmp/adrien_vote_run.js
```

