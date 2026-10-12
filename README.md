# Ping 旅行手帳

兩人共編、手機優先的旅行行程 PWA：總覽（航班、住宿、當週天氣）、景點卡片（貼 Google Maps 連結自動解析）、卡片 memo（筆記 / Threads / IG）、卡片之間的交通時間（可切換交通工具、一鍵開 Google Maps）。

規劃書：[`docs/PLAN.md`](docs/PLAN.md)

```
shared/   前後端共用：Google Maps 網址解析、連結分類、交通時間估算（有單元測試）
worker/   Cloudflare Worker：短網址展開、Places API、Routes API、Threads/IG oEmbed、OG 預覽
web/      Vite + React PWA
```

## 本機開發

```bash
npm install
npm run dev          # http://localhost:5173（不設任何金鑰也能跑：單機模式 + 估算交通時間）
npm test             # shared + worker 單元測試
npm run typecheck
```

不設定任何服務時的行為：

| 沒設定 | 會怎樣 |
| --- | --- |
| Firebase | 單機模式，資料只存在該瀏覽器；不能共編 |
| Worker（`VITE_API_BASE`） | 完整 Google Maps 網址可解析名稱與座標；`maps.app.goo.gl` 短網址只能用分享文字裡的名稱；交通時間為「估」 |
| 瀏覽器 Maps 金鑰 | 地圖分頁改為清單 + 「在 Google Maps 開啟當日路線」 |

## 上線設定（約 30 分鐘）

### 1. Google Cloud（Maps）

1. 建立專案、綁定帳單，啟用 **Places API (New)**、**Routes API**、**Maps JavaScript API**。
2. 建兩把金鑰：
   - **伺服器金鑰**：API 限制 = Places API (New) + Routes API。只放在 Worker。
   - **瀏覽器金鑰**：API 限制 = Maps JavaScript API；應用程式限制 = HTTP referrer（你的網域、`localhost:5173`）。
3. 在「預算與快訊」設每月預算警示，並在各 API 的配額頁設每日上限。
4. （選用）建立 Map ID（向量地圖）填到 `VITE_GOOGLE_MAPS_MAP_ID`。

### 2. Firebase（共編與登入）

1. 在同一個 GCP 專案加入 Firebase，建立 **Web App**，取得 config。
2. Authentication → 啟用 **Google** 登入；授權網域加上你的網站網域。
3. Firestore → 建立資料庫（建議 `asia-northeast1`），部署規則：`npx firebase-tools deploy --only firestore:rules`。

### 3. Cloudflare Worker（API）

```bash
cd worker
npx wrangler login
npx wrangler secret put GOOGLE_MAPS_SERVER_KEY
# wrangler.toml：ALLOWED_ORIGINS 填網站網址；FIREBASE_PROJECT_ID 填 Firebase 專案 ID（只允許已登入者呼叫）
npx wrangler deploy
```

本機測 Worker：複製 `worker/.dev.vars.example` 成 `.dev.vars`，`npm run dev:worker`。

### 4. 網站（Cloudflare Pages）

- Build command：`npm install && npm run build`；Output：`web/dist`
- 環境變數：照 `web/.env.example` 填（`VITE_API_BASE` = Worker 網址）。
- 手機用 Chrome / Safari 打開 →「加到主畫面」。Android 安裝後可以在 Google Maps 按「分享」→ Ping，直接進收集箱。

### 5. 邀請旅伴

設定 → 共同編輯 →「分享邀請連結」。對方開連結、用 Google 登入就會加入。

## 已知限制

- **日本的大眾運輸路線**：Google Routes API 在日本可能不回傳 transit 結果。此時路段顯示「估」（直線距離推估），點路段可直接開 Google Maps 查真正的電車路線。
- **Threads / IG 預覽**：使用 Meta 2026/6 開放的免 token oEmbed，只支援公開貼文；被限流時可在 Worker 設 `META_ACCESS_TOKEN`。
- **星星人色號**：POP MART 沒有公開官方色號，`web/src/theme/tokens.ts` 是依角色特徵訂的固定色票；設定頁可「從照片取色」用自己的公仔照片校正。
