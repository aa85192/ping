# Ping — 旅行行程 Web App 技術規劃書

> 版本 v0.1 · 2026-10-12 · 角色：技術總監
> 範圍：只做交接文件中「已知」的資料與使用者明確提出的功能；未決事項與未訂項目不納入 MVP。
> 本文件只做規劃，尚未開始寫程式。

---

## 決策紀錄（2026-10-12 使用者確認）

- **兩人共編進 MVP**：資料層改為 Firebase（Google 登入 + Firestore 離線快取 + 即時同步），未設定 Firebase 時自動退回單機模式（localStorage）。卡片用 fractional order，兩人同時排序不會互相覆蓋整份清單。
- **手機為主**、**分頁放在手機畫面最底部**（GitHub mobile 樣式：icon + 文字 + 計數徽章，目前分頁以星光黃膠囊標示）。
- **星星人色號**：POP MART 未公開官方色號，採用 `web/src/theme/tokens.ts` 的固定色票（白天 / 夜空兩組，文字組合皆 ≥ WCAG AA 4.5:1），設定頁可從公仔照片取色覆寫。

| 色名 | 白天 | 夜空 | 用途 |
| --- | --- | --- | --- |
| 星光黃 | `#FFD23F` | `#FFD84D` | 主色、目前分頁、主按鈕 |
| 星光黃・深 | `#F2B600` | `#FFC61A` | 按下、描邊 |
| 臉頰粉 | `#FF7A8A` | `#FF8C9B` | 強調、提醒（文字用 `#B8304A` / `#FFAAB6`） |
| 夢境藍 | `#7EB8F0` | `#8FC3FF` | 天氣、大眾運輸（文字用 `#2D6AA8` / `#A9CFFF`） |
| 薄荷綠 | `#6FCFAE` | `#74D6B4` | 已付款、步行（文字用 `#1D7556` / `#93E3C4`） |
| 星星眼（文字） | `#33283A` | `#F6F1E7` | 主要文字 |
| 背景 | `#FFF9EC` 奶油星光 | `#141832` 夜空藍 | 頁面底色 |

## 0. TL;DR

| 項目 | 決定 |
| --- | --- |
| 形式 | 響應式 **PWA**（手機旅途中用、電腦規劃時用；可加到主畫面、離線可讀） |
| 前端 | Vite + React + TypeScript、Zustand（狀態）、dnd-kit（拖曳）、`@vis.gl/react-google-maps` |
| 後端 | **Cloudflare Worker** 當薄 API 代理：解析 Google Maps 短網址、呼叫 Places / Routes、藏 API key、快取 |
| 資料 | MVP：**本機優先**（IndexedDB / Dexie）＋ JSON 匯出匯入；v1.1 再加兩人同步 |
| 地圖服務 | Google Maps Platform：Places API (New)、Routes API、Maps JavaScript API、Maps URLs（深連結，免費） |
| 天氣 | Open-Meteo（免金鑰；16 天預報，超出範圍用「往年同日平均」補） |
| 風格 | 「星星人」靈感：暖黃星光 × 臉頰粉 × 夢境天空藍；淺色 = 白天、深色 = 夜空 |
| 分頁 | GitHub repo 導覽列樣式（icon + 文字 + 計數徽章 + 底線標示目前分頁） |
| 時程 | **出發日 10/24，剩 12 天** → MVP（M0–M4）目標 10/20 前可用，留 3 天緩衝 |

---

## 1. 目標與範圍

### 1.1 MVP 必做（使用者明確要求）

1. **Dashboard 分頁**
   - 航班：去程 MM32、回程 AK171（時間、航廈、行李規定），可編輯。
   - 住宿：名稱、入住/退房、地址；按鈕連到 **Google Map**、**Agoda**、**Airbnb**（使用者提供網址）。
   - **旅遊當週天氣**：10/24–10/31 每日一格，依當天所在城市（大阪／京都／舞濱）。
2. **景點卡片**
   - 貼上 Google Maps 網址 → 自動解析成卡片（名稱、地址、座標、照片、評分、營業時間）。
   - 卡片可加 **memo**：文字筆記、**Threads 連結**、**IG 連結**（可預覽嵌入）。
   - 一鍵在 Google Maps 開啟。
3. **卡片之間的交通時間**
   - 相鄰卡片之間顯示預估時間與距離，可切換交通工具（步行／大眾運輸／開車／單車）。
   - 點擊路段 → 在 Google Maps 開啟該路線導航。
4. **可編輯、可客製化**（見 §7）。
5. **風格簡約**、配色參考泡泡瑪特星星人；分頁參考 GitHub。

### 1.2 非 MVP（列入 Backlog，見 §10）

記帳分帳、待辦期限提醒、未決事項投票、打包清單、票券夾、兩人同步等。

### 1.3 已知種子資料（從交接文件匯入）

- Trip：2 人、10/24–10/31、主幣 TWD、當地 JPY、匯率 ¥1 = NT$0.2（可調）。
- Booking：去程機票、回程機票、住宿（Apartment Hotel 11 Shinimamiya 1）、海之京都一日遊。
- 每日城市：10/24–27、10/30–31 大阪；10/27 京都；10/28 舞濱；10/29 舞濱→大阪（用於天氣與地圖預設中心）。

> 個資（姓名、訂單編號、卡號等）不進 repo。種子資料以 `seed.json` 本機匯入，`.gitignore` 排除。

---

## 2. 系統架構

```
┌─────────────────────────────── 瀏覽器 / PWA ───────────────────────────────┐
│ React UI ── Zustand store ── Dexie (IndexedDB)  ← 所有資料的唯一真實來源      │
│     │                         ▲                                            │
│     │ fetch /api/*            │ 快取：place、leg、weather                   │
│     ▼                         │                                            │
│ Service Worker（Workbox）：殼層與已載入資料離線可用                          │
└────────────┬───────────────────────────────────────────────────────────────┘
             │ HTTPS
┌────────────▼──────────────── Cloudflare Worker（/api） ─────────────────────┐
│ POST /api/resolve-place   短網址展開 → 解析 → Places API (New)               │
│ POST /api/route           Routes API computeRoutes（含 fallback）            │
│ GET  /api/weather         Open-Meteo 代理 + KV 快取（可選，前端也能直連）    │
│ GET  /api/link-preview    抓 Agoda/Airbnb/一般網址 OG 標籤（盡力而為）        │
│ GET  /api/oembed          Threads / IG oEmbed（Meta 2026/6 起免 token）      │
│ 保護：Cloudflare Access 或共用密語；server key 只在 Worker 環境變數          │
└────────────────────────────────────────────────────────────────────────────┘
```

**為什麼需要 Worker？**

- `maps.app.goo.gl` 短網址要跟隨 302 轉址才能拿到完整網址，瀏覽器受 CORS 限制做不到。
- Places / Routes 的 server key 不能曝露在前端。
- 統一快取，省 API 費用。

**為什麼本機優先？** 兩人旅行、資料量小；日本地鐵與山區網路不穩，離線可讀比即時同步更重要。同步列在 v1.1（候選：Supabase Realtime 或 Firestore，屆時再評估）。

### 2.1 Repo 結構

```
ping/
├─ docs/PLAN.md
├─ web/                     # Vite + React PWA
│  ├─ src/
│  │  ├─ app/               # 路由、Tab 版面
│  │  ├─ features/
│  │  │  ├─ dashboard/      # 航班、住宿、天氣、倒數 widget
│  │  │  ├─ itinerary/      # 天數欄、卡片、路段
│  │  │  ├─ map/
│  │  │  ├─ card-detail/    # memo、連結、嵌入
│  │  │  └─ settings/       # 主題、widget、分頁客製
│  │  ├─ db/                # Dexie schema、migration、匯出匯入
│  │  ├─ lib/               # 時區、幣別、link 分類
│  │  └─ theme/             # design tokens
├─ worker/                  # Cloudflare Worker
│  └─ src/{resolve,route,weather,oembed,preview}.ts
├─ shared/                  # 前後端共用型別 + 純函式（URL parser）
│  └─ maps-url/             # 有完整單元測試
└─ e2e/                     # Playwright
```

---

## 3. 資料模型（TypeScript 草案）

延續交接文件的建議，每筆資料帶 `status` 與可選 `source`，因為很多數字是估計值。

```ts
type Status = 'paid' | 'confirmed' | 'booked' | 'todo' | 'estimated' | 'unverified';

interface Trip {
  id: string; name: string;
  startDate: string; endDate: string;        // 'YYYY-MM-DD'（JST）
  travelers: number;
  homeCurrency: 'TWD'; localCurrency: 'JPY'; fxRate: number;  // 0.2
  timezone: 'Asia/Tokyo';
  days: Day[];
}

interface Day {
  date: string;
  city: { name: string; lat: number; lng: number };  // 天氣與地圖中心用
  cardIds: string[];                                  // 排序即行程順序
  defaultMode?: TravelMode;
}

interface Booking {
  id: string; kind: 'flight' | 'lodging' | 'tour' | 'rail';
  title: string; status: Status;
  start: string; end?: string;                        // ISO 含時區 offset
  flight?: { no: string; from: string; to: string; terminalNote?: string; baggage?: string };
  lodging?: { address?: string; placeId?: string; checkIn?: string; checkOut?: string };
  links: LinkRef[];                                   // Agoda / Airbnb / Google Map / 官網
  amount?: Money; note?: string;
}

interface PlaceCard {
  id: string;
  sourceUrl: string;                                  // 使用者貼的原始網址
  placeId?: string;
  name: string; address?: string;
  location?: { lat: number; lng: number };
  googleMapsUri?: string;
  photoRef?: string; rating?: number;
  openingHours?: WeeklyHours;
  tags: string[];                                     // 自訂：美食 / 購物 / 景點…
  color?: string;
  plannedStart?: string; stayMinutes?: number;        // 預估停留
  memos: Memo[];
  resolveState: 'pending' | 'resolved' | 'partial' | 'failed';
}

type Memo =
  | { id: string; type: 'note'; text: string; updatedAt: string }       // Markdown
  | { id: string; type: 'link'; url: string; kind: LinkKind; title?: string; embedHtml?: string };

type LinkKind = 'threads' | 'instagram' | 'youtube' | 'tiktok' | 'google-maps' | 'agoda' | 'airbnb' | 'web';
type TravelMode = 'WALK' | 'TRANSIT' | 'DRIVE' | 'BICYCLE';

interface Leg {                                       // 快取用，key = from|to|mode|出發小時
  fromCardId: string; toCardId: string; mode: TravelMode;
  durationSec?: number; distanceM?: number;
  summary?: string;                                   // e.g. 'JR 環狀線 → 御堂筋線'
  source: 'routes-api' | 'estimate' | 'manual';
  fetchedAt: string;
}

interface Settings { theme: ThemeTokens; tabs: TabConfig[]; widgets: WidgetConfig[]; cardFields: CardFieldConfig; }
```

---

## 4. 核心功能設計

### 4.1 Google Maps 網址 → 景點卡片

**使用者流程**：在行程頁任一處 `Ctrl/Cmd+V`（或點「＋ 貼上 Google Maps 連結」）→ 立刻出現骨架卡片 → 1–2 秒內補齊資料。也支援「從收集箱拖到某一天」。

**要支援的網址格式**（全部寫成單元測試 fixture）：

| 格式 | 例子 | 解析方式 |
| --- | --- | --- |
| App 分享短網址 | `https://maps.app.goo.gl/AbCd…` | Worker 跟隨轉址（最多 5 次）取得完整網址再解析 |
| 舊短網址 | `goo.gl/maps/…`、`share.google/…` | 同上 |
| 地點頁 | `google.com/maps/place/伏見稻荷大社/@34.96,135.77,17z/data=…!3d34.967!4d135.772…` | 取名稱、`!3d!4d`（比 `@` 地圖中心準）、`!1s0x…:0x…`（ftid） |
| 查詢 | `?q=…`、`?query=…&query_place_id=…` | 有 place_id 直接用 |
| CID | `?cid=123…` | 以 cid 查 |

**解析管線**（Worker）：

1. 展開短網址 → 規範化 URL。
2. 純函式 parser（`shared/maps-url`）抽出 `{ name, lat, lng, placeId?, ftid?, cid? }`。
3. 有 `placeId` → 直接 Place Details。
   否則 → **Places API (New) Text Search**：`textQuery = name`，`locationBias` = 座標半徑 200 m，取名稱相似度 + 距離最高者。
   備選：Google 的 Maps Tools Resolution API（實驗性，可把網址直接轉 Place ID）—— M0 試用，可用就當主路徑。
4. Place Details 用 **field mask** 只取需要欄位（displayName、formattedAddress、location、regularOpeningHours、rating、photos[0]、googleMapsUri），控制費用。
5. 結果以 placeId 快取（Worker KV + 前端 IndexedDB）。
6. 失敗 → 卡片標「部分解析」，保留名稱與座標，提供「手動搜尋地點」（Places Autocomplete）。

**加值**：依卡片所在日期比對營業時間，若當天公休或安排時段不在營業時間內 → 卡片上顯示小警示。

### 4.2 卡片 Memo

- **筆記**：Markdown（粗體、清單、勾選框），自動儲存。
- **連結**：貼上即自動分類（threads.com / threads.net、instagram.com、youtube、tiktok、一般網址），顯示平台圖示 chip。
- **嵌入預覽**：Meta 於 2026/6 宣布 oEmbed 可**免 access token** 呼叫（Facebook、Threads、Instagram），由 Worker 呼叫 oEmbed 取得 `html` 後在抽屜中懶載入。只支援公開貼文；失敗時退回連結 chip。M0 實測。
- 卡片正面只顯示 memo 數量徽章；點開側邊抽屜（手機為底部抽屜）看完整內容。

### 4.3 卡片之間的交通時間

- 每兩張相鄰卡片之間有一個「路段膠囊」：`🚶 12 分 · 0.9 km`，點擊切換交通工具，長按/右鍵「在 Google Maps 開啟」。
- 交通工具預設值層級：全域 → 當天 → 單一路段可覆寫。
- 呼叫 **Routes API `computeRoutes`**；`TRANSIT` 需要 `departureTime` → 用前一張卡片的 `plannedStart + stayMinutes`，沒有就用當天 09:00 JST。
- 重新排序時只重算受影響的路段；結果快取（key 含出發小時）。
- **深連結（免費、免 key）**：
  `https://www.google.com/maps/dir/?api=1&origin=…&origin_place_id=…&destination=…&destination_place_id=…&travelmode=transit`
- **每日時間預算條**：當天「停留 + 移動」總時數 vs 可用時數，超過時變色提醒。

> ⚠️ **最大技術風險：日本的大眾運輸路線 API 覆蓋**
> Google 地圖 App 在日本能查電車，但 API 端是否一樣有資料無法確定 —— 2026 年有開發者回報日本的 Directions API transit 回傳 `ZERO_RESULTS`（步行、開車正常）。
> **對策**：M0 第一天就用真實金鑰測 `KIX → 新今宮`、`新今宮 → 伏見稻荷`。
> 若無資料：大眾運輸路段改顯示「估計值」（依直線距離 × 係數 + 轉乘緩衝，明確標示 *估*），並把「在 Google Maps 開啟大眾運輸路線」做成主要動作；步行/開車照常用 API。

### 4.4 Dashboard

GitHub 風格的卡片式 widget 格線（桌機 2–3 欄、手機 1 欄），widget 可拖曳排序、隱藏：

| Widget | 內容 |
| --- | --- |
| 倒數 | 「距離出發 12 天」；旅途中變成「Day 3 / 8」 |
| 航班 | 去程、回程各一張「登機證」樣式卡：航班號、起降時間（當地）、飛行時間、航廈提示（Peach 在 KIX T2）、行李額度；狀態徽章 |
| 住宿 | 名稱、入住 16:00 / 退房、最近車站；按鈕：Google Map · Agoda · Airbnb（有填才顯示） |
| 天氣 | 10/24–31 橫向 8 格：圖示、高低溫、降雨機率；每格標當天城市 |
| 今日行程 | 旅途中顯示今天的卡片與下一段交通（出發前隱藏） |

**天氣策略**：Open-Meteo 每日預報最多 16 天 → 今天（10/12）能看到 10/27，10/28–31 顯示「往年同日平均」（Open-Meteo 歷史資料，近 5 年平均）並標灰；進入預報範圍後自動切換。每 3 小時更新、離線時顯示最後一次資料與時間。

**住宿連結**：Agoda / Airbnb 沒有公開 API，只存網址；Worker 嘗試抓 OG 標題/縮圖，被擋就只顯示平台圖示按鈕。

### 4.5 地圖分頁

- Google Maps JS：當天卡片以編號標記、路段畫 polyline、住宿以 🏠 標記。
- 上方日期切換；「全部」模式以每日顏色區分。
- 點標記 → 開卡片抽屜。

---

## 5. 資訊架構與分頁

GitHub repo 導覽列樣式：在頁首下方、`icon + 文字 + 計數徽章`，目前分頁以底線標示；手機上可橫向滑動、捲動時吸頂。

| # | 分頁 | MVP | 計數徽章 |
| --- | --- | --- | --- |
| 1 | Dashboard | ✅ | — |
| 2 | 行程 Itinerary | ✅ | 卡片數 |
| 3 | 地圖 Map | ✅ | — |
| 4 | 收集箱 Inbox（未排入哪天的卡片） | ✅（也可併入行程頁左欄） | 未排數 |
| 5 | 設定 Settings | ✅ | — |
| — | 預訂 / 待辦 / 費用 | Backlog | — |

**行程頁版面**

- 桌機：左側收集箱 + 右側每日欄（橫向捲動，類 Kanban），卡片可跨日拖曳。
- 手機：上方日期膠囊切換，單欄垂直時間軸；卡片之間夾著路段膠囊。

---

## 6. 視覺設計系統

### 6.1 配色靈感

星星人（POP MART TWINKLE TWINKLE）的辨識特徵是**暖黃色主調、紅撲撲的臉頰、星星眼**，周邊多用柔和粉彩，第三代「好夢氣象局」以天氣為題 —— 剛好對應本 App 的天氣 widget。
只取「色彩氛圍」，**不使用任何官方角色圖、商標**（著作權），圖示用自繪幾何星星。

### 6.2 Design Tokens（初稿，實作時用對比檢查工具微調到 WCAG AA）

| Token | 淺色「白天」 | 深色「夜空」 | 用途 |
| --- | --- | --- | --- |
| `--bg` | `#FFF9EE` 奶油白 | `#161A33` 夜空藍 | 頁面底色 |
| `--surface` | `#FFFFFF` | `#20254A` | 卡片 |
| `--ink` | `#2E2A3D` | `#F4F1FF` | 主要文字 |
| `--muted` | `#857E96` | `#A6A3C4` | 次要文字 |
| `--border` | `#EFE5CF` | `#2E3460` | 邊框 |
| `--star`（主色） | `#FFC93C` 星光黃 | `#FFD866` | 目前分頁底線、主按鈕、星標 |
| `--cheek`（強調） | `#FF8FA3` 臉頰粉 | `#FF9CB0` | 徽章、提醒、memo |
| `--sky`（輔助） | `#9EC5F2` 夢境藍 | `#7FA8E8` | 天氣、交通膠囊、連結 |
| `--mint`（狀態 OK） | `#7FD1B9` | `#6CC3AA` | 已付款 / 已確認 |

- 主按鈕：`--star` 底 + `--ink` 字（黃底白字對比不足，不用）。
- 交通工具色：步行 `--mint`、大眾運輸 `--sky`、開車 `--muted`、單車 `--cheek`，搭配 icon，不只靠顏色辨識。
- 字型：標題用圓體 **Zen Maru Gothic**（中日文都圓潤），內文 **Noto Sans TC**；數字用 tabular-nums。
- 形狀：圓角 16px（卡片）／999px（膠囊）；陰影極淡；大量留白；icon 用 Lucide（線條、圓端）。
- 動態：卡片新增時小星星閃一下（尊重 `prefers-reduced-motion`）。

---

## 7. 客製化（「可編輯可客製化」的具體範圍）

| 類別 | 可調整項目 |
| --- | --- |
| 全部資料 | 航班、住宿、卡片欄位皆可就地編輯（inline edit），Undo 一步 |
| 主題 | 白天/夜空/跟隨系統；主色、強調色可從色票或自訂 hex 改；圓角大小 |
| 分頁 | 顯示/隱藏、排序 |
| Dashboard | widget 顯示/隱藏、拖曳排序 |
| 卡片 | 正面要顯示哪些欄位（照片、評分、營業時間、停留時間、memo 數） |
| 標籤 | 自訂標籤名稱與顏色（美食、購物、寺社…） |
| 交通 | 預設交通工具（全域 / 每日 / 每段） |
| 旅程 | 匯率、人數、每日城市 |
| 資料 | JSON 匯出/匯入（備份、換手機、分享給旅伴） |

---

## 8. 第三方服務、費用與安全

| 服務 | 用途 | 費用 / 限制 |
| --- | --- | --- |
| Places API (New) | 網址解析、地點詳情 | 2025/3 起每個 SKU 有每月免費額度；兩人自用遠低於上限。用 field mask 控制等級 |
| Routes API | 路段時間 | 同上；快取 + 只在需要時算 |
| Maps JavaScript API | 地圖分頁 | 每次載入計次，免費額度內 |
| Maps URLs | 開啟 Google Maps | 免費、免 key |
| Open-Meteo | 天氣 | 免費、免 key（非商用） |
| Meta oEmbed | Threads / IG 預覽 | 2026/6 起免 token，可能有速率限制 |
| Cloudflare Pages + Workers + KV | 前端 + API | 免費方案足夠 |

**需要使用者準備**：Google Cloud 專案 + 綁信用卡（Maps Platform 必要）、Cloudflare 帳號。

**安全**

- 兩把 key：瀏覽器 key（限 HTTP referrer + 只開 Maps JS）、伺服器 key（只在 Worker secret，限 Places/Routes）。
- GCP 設**預算警示**與每日配額上限，防止 key 外洩被刷。
- 站台加 Cloudflare Access（Email 一次性密碼）或共用密語，避免行程被陌生人看到。
- 個資與種子資料不進 git。

---

## 9. 里程碑與時程（以 10/24 出發倒推）

| 里程碑 | 內容 | 預估 | 目標日 |
| --- | --- | --- | --- |
| **M0 技術驗證** | ① Routes TRANSIT 在日本是否有資料 ② 10 條真實 Maps 連結解析成功率 ③ Threads/IG oEmbed 免 token 實測 ④ Resolution API 可用性 | 0.5–1 天 | 10/13 |
| **M1 骨架** | Vite PWA、design tokens、GitHub 式分頁、Dexie schema、種子資料匯入、Worker 骨架與部署 | 1.5 天 | 10/15 |
| **M2 Dashboard** | 倒數、航班、住宿（連結按鈕）、天氣（預報 + 往年平均） | 1 天 | 10/16 |
| **M3 卡片** | 貼網址解析、收集箱、每日欄、拖曳排序、卡片抽屜、memo（筆記 + 連結 + 嵌入） | 2 天 | 10/18 |
| **M4 路段** | Routes 計算、交通工具切換、深連結、時間預算條、地圖分頁 | 1.5 天 | 10/20 |
| **M5 打磨** | 離線、匯出匯入、客製化設定頁、手機實機測試、深色模式 | 1.5 天 | 10/22 |
| 緩衝 | bug、實際把行程輸入進去 | 1 天 | 10/23 |
| v1.1（旅途後或並行） | 兩人同步、Backlog 功能 | — | — |

**品質把關**

- `shared/maps-url` parser：Vitest 單元測試，fixture 收錄各種真實網址格式（含中文、日文地名、URL 編碼）。
- Worker：對 Google API 做 mock 的整合測試。
- Playwright e2e：「貼網址 → 出現卡片 → 切換交通工具 → 出現時間」煙霧測試；手機視窗尺寸截圖。
- Lighthouse PWA / 無障礙分數 ≥ 90。

---

## 10. 功能 Backlog（網路蒐集，供你挑選）

> 說明：Threads 需要登入才能瀏覽，搜尋引擎抓不到貼文內容，因此我無法直接引用 Threads 討論串。以下改從 2026 年台灣旅遊 App 比較文章（Funliday、LINE 旅遊、去趣、Pathly 等）與日本自由行攻略中常被提到的需求整理，並對應到你這趟行程的實際資料。

| 優先 | 功能 | 為什麼值得做（對這趟旅程） | 工作量 |
| --- | --- | --- | --- |
| ⭐⭐⭐ | **期限提醒** | 10/17 扣款、10/21 23:30 新幹線早特截止、10/23 一日遊免費取消 —— 錯過有實際損失；Dashboard widget + 瀏覽器通知 | S |
| ⭐⭐⭐ | **營業時間/公休衝突警示** | 已在 §4.1 設計，MVP 內順手做 | S |
| ⭐⭐⭐ | **票券夾** | 存 USJ、迪士尼、新幹線、一日遊憑證截圖/QR，離線可開 | S |
| ⭐⭐ | **記帳 + 分帳** | 多篇文章最常提的功能；JPY/TWD 雙幣、兩人分攤；可沿用交接文件的費用表當預算 | M |
| ⭐⭐ | **打包清單** | Funliday 2025 新功能；依季節/地區預設；含行動電源規定、回程 AK171 行李重量提醒 | S |
| ⭐⭐ | **兩人共同編輯** | 幾乎所有熱門 App 都有；本規劃的 v1.1 | M–L |
| ⭐⭐ | **未決事項投票** | 迪士尼 Land/Sea、舞濱住宿、Express Pass；兩人各自投票 | S |
| ⭐⭐ | **免稅提醒卡** | 日本 11/1 改事後退稅、本次 10/31 前仍適用現行制度、單店 ¥5,000 門檻、比價準則 | S |
| ⭐ | **匯率換算小工具** | 輸入日圓即時換台幣（可設定匯率或抓即時匯率） | S |
| ⭐ | **人潮/活動標記** | 把 USJ 年票除外日、萬聖節活動標在日曆上 | S |
| ⭐ | **從 Threads/IG 收藏快速建卡** | 貼 Threads 貼文網址 → 讀 oEmbed 文字，提示「要不要建成景點卡？」（需人工確認地點） | M |
| ⭐ | **行程分享唯讀連結 / 匯出 PDF** | 給家人看 | M |

---

## 11. 需要你決定的事

1. **使用人數**：只有你一人編輯，還是兩人都要同時編輯？（影響 v1.1 是否提前到 MVP）
2. **主要裝置**：旅途中手機為主、規劃時電腦為主 —— 這個假設對嗎？
3. **帳號**：你願意建立 Google Cloud 專案（需綁卡，有免費額度）和 Cloudflare 帳號嗎？
4. **分頁位置**：「底下分頁參考 GitHub」我理解為**頁首下方**的 GitHub 導覽列樣式；若你想要的是**手機畫面最底部**的 tab bar，請告訴我。
5. **Backlog**：§10 想把哪幾項放進 MVP？（建議至少「期限提醒」，因為 10/21 有實際截止）

---

## 參考資料

- POP MART 星星人以暖黃色為主調、紅臉頰與星星眼為辨識特徵：[Marie Claire 台灣](https://www.marieclaire.com.tw/lifestyle/news/90853/twinkle-twinkle-popmart)、[beauty321](https://www.beauty321.com/amp/post/69105)
- 2026 台灣旅遊 App 功能比較：[gofunit](https://gofunit.com/travel-app/)、[Funliday 打包清單](https://www.funliday.com/posts/funliday-travel-checklist/)、[Funliday 日本旅遊注意事項](https://www.funliday.com/posts/japan-travel-tips/)
- Google Maps 網址轉 Place ID：[Maps Tools Resolution API](https://developers.google.cn/maps/ai/grounding-lite/resolution-api)、[get-gplace-id](https://cdn.jsdelivr.net/npm/get-gplace-id@1.0.3/README.md)
- 日本 transit API 回報：[Google Developer forums](https://discuss.google.dev/t/directions-api-transit-mode-returns-zero-results/378267)、[Routes API transit](https://developers.google.com/maps/documentation/routes/transit-route?hl=ja)
- Meta oEmbed 免 token：[Meta for Developers 2026/6/15](https://developers.facebook.com/blog/post/2026/06/15/tokenless-access-to-meta-oembed-apis/)、[Embed a Threads Post](https://developers.facebook.com/docs/threads/tools-and-resources/embed-a-threads-post)
