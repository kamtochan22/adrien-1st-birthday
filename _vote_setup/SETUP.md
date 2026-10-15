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
2. 撳「網球」
3. 去 Sheet 睇下 `Votes` tab 有冇多一行
4. 開另一個瀏覽器（或無痕）再投，票數應該加

## 驗收 checklist

- [ ] Sheet `Votes` tab 有 `Timestamp / Choice / Device / Note` 四個標題
- [ ] 撳一個選項 → Sheet 多一行
- [ ] 同一部機再撳，係**覆蓋**舊票，唔係加一行
- [ ] 網站票數條 bar 有數，total 加咗
- [ ] 手機 Safari 開都投到（iOS 一定要試）

## 出事點救

| 症狀 | 原因 / 解決 |
|---|---|
| 網站寫「投票即將開放」 | `VOTE_API` 未貼，或唔係以 `http` 開頭 |
| bar 永遠 0 | Apps Script `Who has access` 唔係 `Anyone` |
| Console 見 `SyntaxError` 喺 `?cb=` | 部署版本舊；重新 deploy 一個 New version |
| 想清空票數重來 | 瀏覽器開 `<URL>?action=reset&key=adrien-zhuazhou-2026` |
| 票數 load 得好慢 | 正常。快取 20 秒，網頁每 25 秒讀一次（慳 Apps Script 每日額度） |
