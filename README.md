# Ping 旅行手帳

兩人共編、手機優先的旅行行程 PWA：總覽（航班、住宿、當週天氣）、景點卡片（貼 Google Maps 連結自動解析）、卡片 memo（筆記 / Threads / IG）、卡片之間的交通時間（可切換交通工具、一鍵開 Google Maps）。

規劃書：[`docs/PLAN.md`](docs/PLAN.md)

```
shared/      前後端共用：Google Maps 網址解析、連結分類、交通時間估算（有單元測試）
functions/   Firebase Cloud Function `api`：短網址展開、Places API、Routes API、Threads/IG oEmbed、OG 預覽
web/         Vite + React PWA（部署到 Firebase Hosting，/api/** 轉給 Cloud Function）
```

全部跑在**同一個 Google Cloud 專案**上，費用從你的 Google Cloud 額度扣（帳單帳戶「Google AI Pro API Project」）。

## 本機開發

```bash
npm install
npm run dev          # http://localhost:5173（不設任何金鑰也能跑：單機模式 + 估算交通時間）
npm test             # shared + functions 單元測試
npm run typecheck
```

| 沒設定 | 會怎樣 |
| --- | --- |
| Firebase（`web/.env.local`） | 單機模式，資料只存在該瀏覽器；不能共編；不呼叫 API |
| Maps 伺服器金鑰 | 完整 Google Maps 網址可解析名稱與座標；`maps.app.goo.gl` 短網址只能用分享文字裡的名稱；交通時間為「估」 |
| Maps 瀏覽器金鑰 | 地圖分頁改為清單 + 「在 Google Maps 開啟當日路線」 |

接 API 一起開發：`npm run build:functions && npx firebase-tools emulators:start --only functions`，另開一個終端機 `npm run dev`（Vite 會把 `/api` 轉到模擬器，模擬器裡不檢查登入）。

## 上線（全部在 Google Cloud，約 30 分鐘）

### 1. 建立 Firebase 專案並綁定你的額度

1. 到 [Firebase console](https://console.firebase.google.com) 建立專案（或選既有的 Google Cloud 專案）。
2. 左下「Spark」→ 升級為 **Blaze**，帳單帳戶選 **Google AI Pro API Project**（就是有每月額度的那個）。Cloud Functions 與 Secret Manager 需要 Blaze。
3. **先設預算警示**：Google Cloud console → 帳單 → 預算與快訊 → 例如每月 US$10，50% / 90% / 100% 寄信。

### 2. 開啟服務

在 Google Cloud console（同一個專案）→ API 和服務 → 啟用：

- Places API (New)、Routes API、Maps JavaScript API

Firebase console：

- Authentication → 登入方式 → 啟用 **Google**；授權網域會自動有 `<專案>.web.app`。
- Firestore Database → 建立資料庫，位置選 `asia-east1`（台灣）。
- 專案設定 → 一般 → 新增 **網頁應用程式**，把 config 填進 `web/.env.production.local`（格式見 `web/.env.example`）。

### 3. 兩把 Maps 金鑰

Google Cloud console → API 和服務 → 憑證：

| 金鑰 | API 限制 | 應用程式限制 | 放哪裡 |
| --- | --- | --- | --- |
| 伺服器金鑰 | Places API (New)、Routes API | 無（只存在 Secret Manager） | `npx firebase-tools functions:secrets:set GOOGLE_MAPS_SERVER_KEY` |
| 瀏覽器金鑰 | Maps JavaScript API | 網站：`https://<專案>.web.app/*`、`http://localhost:5173/*` | `web/.env.production.local` 的 `VITE_GOOGLE_MAPS_BROWSER_KEY` |

另外建議在「配額」頁把 Places / Routes 每日上限調低（例如每天 500 次），雙重保險。

### 4. 部署

```bash
npx firebase-tools login
npx firebase-tools use --add          # 選你的專案
npx firebase-tools deploy             # 會自動 build 網站與 function，並部署 Firestore 規則
```

網址是 `https://<專案>.web.app`。手機用 Chrome / Safari 打開 →「加到主畫面」。Android 安裝後可以在 Google Maps 按「分享」→ Ping，直接進收集箱。

### 5. 邀請旅伴

設定 → 共同編輯 →「分享邀請連結」。對方開連結、用 Google 登入就會加入。

## 費用估計（兩人、一趟一週的行程）

| 服務 | 用量 | 估計 |
| --- | --- | --- |
| Places / Routes / Maps JavaScript | 每月幾百次 | Google Maps Platform 每個 SKU 每月有免費用量，兩人自用通常在免費範圍內 |
| Cloud Functions、Firestore、Hosting | 很少 | 在免費額度內 |
| Secret Manager、Artifact Registry（function 映像檔） | 1 個密鑰、1 個映像檔 | 每月約 US$0.1–0.5 |

結果應該是每月 US$1 以下，從額度扣。注意：額度是否涵蓋 **Google Maps Platform** 請在「帳單 → 報表」看第一週的實際扣款確認；就算不涵蓋，自用量也多半落在 Maps 的每月免費用量裡。

## 已知限制

- **日本的大眾運輸路線**：Google Routes API 在日本可能不回傳 transit 結果。此時路段顯示「估」（直線距離推估），點路段可直接開 Google Maps 查真正的電車路線。
- **Threads / IG 預覽**：使用 Meta 2026/6 開放的免 token oEmbed，只支援公開貼文；被限流時可在 function 設環境變數 `META_ACCESS_TOKEN`。
- **星星人色號**：POP MART 沒有公開官方色號，`web/src/theme/tokens.ts` 是依角色特徵訂的固定色票；設定頁可「從照片取色」用自己的公仔照片校正。
