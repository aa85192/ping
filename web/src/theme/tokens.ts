/**
 * 星星人配色（POP MART TWINKLE TWINKLE）
 *
 * 色號由官方插畫與全款展示圖逐像素取樣（依色相 / 明度篩選後取中位數，
 * 三張圖交叉比對）。標「衍生」的是為了可讀性從取樣色調亮或加深的值；
 * 所有文字組合皆 ≥ WCAG AA 4.5:1。
 *
 *   星星黃   #FCD32C  插畫星星                描邊棕   #7A3E18  輪廓線、眼睛
 *   奶油底   #FCE5AF  全款展示海報底           插畫底   #FAECA4  插畫背景
 *   芥末框   #F9C668  海報外框                琥珀身   #F0A94B  公仔身體 / 兜帽
 *   蜜桃臉   #F98350  臉                      腮紅     #F2633A  臉頰
 *   蘋果紅   #B1371C  小蘋果                  青蘋果   #AFAA45  青蘋果帽
 *   葉子綠   #4A6514  蘋果葉                  標籤藍   #0A4D76  Twinkle 標籤
 */
export interface Palette {
  bg: string;
  surface: string;
  surface2: string;
  border: string;
  outline: string;
  ink: string;
  muted: string;
  onStar: string;
  star: string;
  starDeep: string;
  starSoft: string;
  cheek: string;
  cheekSoft: string;
  cheekInk: string;
  sky: string;
  skySoft: string;
  skyInk: string;
  mint: string;
  mintSoft: string;
  mintInk: string;
  shadow: string;
}

export const DAYLIGHT: Palette = {
  bg: '#FCE5AF', // 奶油底（海報）
  surface: '#FFF8E7', // 衍生：奶油底提亮，卡片
  surface2: '#FAECA4', // 插畫底
  border: '#EBCB8B', // 衍生：芥末框淡化
  outline: '#7A3E18', // 描邊棕
  ink: '#4E2810', // 衍生：描邊棕加深，內文
  muted: '#86603F', // 衍生：描邊棕減彩
  onStar: '#4E2810',
  star: '#FCD32C', // 星星黃
  starDeep: '#F0A94B', // 琥珀身
  starSoft: '#FDF0B0', // 衍生
  cheek: '#F2633A', // 腮紅
  cheekSoft: '#FDDCC8', // 衍生：蜜桃臉淡化
  cheekInk: '#B1371C', // 蘋果紅
  sky: '#0A4D76', // 標籤藍
  skySoft: '#D9E6EE', // 衍生
  skyInk: '#0A4D76', // 標籤藍
  mint: '#AFAA45', // 青蘋果
  mintSoft: '#EEEBC6', // 衍生
  mintInk: '#4A6514', // 葉子綠
  shadow: '0 1px 0 rgba(122,62,24,.10), 0 6px 16px rgba(122,62,24,.10)',
};

/** 星夜：以標籤藍為夜空，星星與奶油色不變。 */
export const NIGHT: Palette = {
  bg: '#0C2740', // 衍生：標籤藍加深
  surface: '#13334F',
  surface2: '#1A3F60',
  border: '#2A5272',
  outline: '#FCD32C',
  ink: '#FCE5AF', // 奶油底
  muted: '#C9B48C',
  onStar: '#4E2810',
  star: '#FCD32C', // 星星黃
  starDeep: '#F9C668', // 芥末框
  starSoft: '#3A3A2E',
  cheek: '#F98350', // 蜜桃臉
  cheekSoft: '#4A2E2A',
  cheekInk: '#FDB08F',
  sky: '#7FB3D5',
  skySoft: '#1D4566',
  skyInk: '#B9D6EA',
  mint: '#C9C46A',
  mintSoft: '#2E3F2A',
  mintInk: '#D8D48A',
  shadow: '0 1px 2px rgba(0,0,0,.3), 0 8px 24px rgba(0,0,0,.28)',
};

export const SWATCHES: { name: string; light: string; dark: string; role: string }[] = [
  { name: '星星黃', light: '#FCD32C', dark: '#FCD32C', role: '主色：目前分頁、主按鈕（插畫星星）' },
  { name: '描邊棕', light: '#7A3E18', dark: '#FCD32C', role: '黃色元件的貼紙描邊（輪廓線、眼睛）' },
  { name: '腮紅', light: '#F2633A', dark: '#F98350', role: '強調：提醒、徽章（臉頰）' },
  { name: '蘋果紅', light: '#B1371C', dark: '#FDB08F', role: '警示文字（小蘋果）' },
  { name: '標籤藍', light: '#0A4D76', dark: '#B9D6EA', role: '大眾運輸、連結、圖表（Twinkle 標籤）' },
  { name: '葉子綠 / 青蘋果', light: '#4A6514', dark: '#D8D48A', role: '已付款、步行（蘋果葉）' },
  { name: '琥珀身', light: '#F0A94B', dark: '#F9C668', role: '按下狀態、深一階的黃（公仔身體）' },
  { name: '奶油底 / 星夜', light: '#FCE5AF', dark: '#0C2740', role: '背景（全款展示海報底）' },
];

export interface ThemeOverrides {
  star?: string;
  cheek?: string;
  sky?: string;
  radius?: number;
}

function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace('#', '');
  return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16)) as [number, number, number];
}

function rgbToHex(r: number, g: number, b: number): string {
  return '#' + [r, g, b].map((v) => Math.round(Math.max(0, Math.min(255, v))).toString(16).padStart(2, '0')).join('');
}

/** Mix a colour toward a background (amount 0..1 of the colour kept). */
export function mix(hex: string, bg: string, amount: number): string {
  const a = hexToRgb(hex);
  const b = hexToRgb(bg);
  return rgbToHex(...(a.map((v, i) => v * amount + b[i] * (1 - amount)) as [number, number, number]));
}

export function luminance(hex: string): number {
  const [r, g, b] = hexToRgb(hex).map((v) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export function contrast(a: string, b: string): number {
  const x = luminance(a);
  const y = luminance(b);
  return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
}

/** Darken/lighten until the text colour reaches 4.5:1 on the given surface. */
export function ensureReadable(hex: string, surface: string): string {
  let c = hex;
  const towards = luminance(surface) > 0.5 ? '#000000' : '#FFFFFF';
  for (let i = 0; i < 20 && contrast(c, surface) < 4.5; i++) c = mix(c, towards, 0.9);
  return c;
}

export function buildPalette(base: Palette, o: ThemeOverrides): Palette {
  const p = { ...base };
  if (o.star) {
    p.star = o.star;
    p.starDeep = mix(o.star, '#000000', 0.88);
    p.starSoft = mix(o.star, base.surface, 0.28);
    p.onStar = contrast(base.ink, o.star) >= 4.5 ? base.ink : contrast('#1A1530', o.star) >= 4.5 ? '#1A1530' : '#FFFFFF';
  }
  if (o.cheek) {
    p.cheek = o.cheek;
    p.cheekSoft = mix(o.cheek, base.surface, 0.2);
    p.cheekInk = ensureReadable(o.cheek, p.cheekSoft);
  }
  if (o.sky) {
    p.sky = o.sky;
    p.skySoft = mix(o.sky, base.surface, 0.2);
    p.skyInk = ensureReadable(o.sky, p.skySoft);
  }
  return p;
}

export function applyPalette(p: Palette, radius = 16): void {
  const root = document.documentElement;
  const map: Record<string, string> = {
    '--bg': p.bg,
    '--surface': p.surface,
    '--surface-2': p.surface2,
    '--border': p.border,
    '--outline': p.outline,
    '--ink': p.ink,
    '--muted': p.muted,
    '--on-star': p.onStar,
    '--star': p.star,
    '--star-deep': p.starDeep,
    '--star-soft': p.starSoft,
    '--cheek': p.cheek,
    '--cheek-soft': p.cheekSoft,
    '--cheek-ink': p.cheekInk,
    '--sky': p.sky,
    '--sky-soft': p.skySoft,
    '--sky-ink': p.skyInk,
    '--mint': p.mint,
    '--mint-soft': p.mintSoft,
    '--mint-ink': p.mintInk,
    '--shadow': p.shadow,
    '--radius': `${radius}px`,
  };
  for (const [k, v] of Object.entries(map)) root.style.setProperty(k, v);
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', p.bg);
}
