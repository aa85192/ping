/**
 * 星星人配色（Ping 自訂色票）
 *
 * POP MART 沒有公開 TWINKLE TWINKLE 的官方色號；以下是依角色公開特徵
 * （暖黃身體、紅撲撲臉頰、深色星星眼、粉彩系列與「好夢氣象局」天空主題）
 * 訂出的固定色號，文字組合皆已檢查 WCAG AA（≥ 4.5:1）。
 * 設定頁可用「從照片取色」以自己的公仔照片覆寫主色 / 強調色 / 輔助色。
 */
export interface Palette {
  bg: string;
  surface: string;
  surface2: string;
  border: string;
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
  bg: '#FFF9EC', // 奶油星光
  surface: '#FFFFFF',
  surface2: '#FFF4DA', // 淡奶黃
  border: '#F0E4C8',
  ink: '#33283A', // 星星眼深紫棕
  muted: '#766A80',
  onStar: '#33283A',
  star: '#FFD23F', // 星光黃（身體）
  starDeep: '#F2B600', // 星光黃・深（按下、描邊）
  starSoft: '#FFF1BF',
  cheek: '#FF7A8A', // 臉頰粉
  cheekSoft: '#FFE3E7',
  cheekInk: '#B8304A',
  sky: '#7EB8F0', // 夢境藍
  skySoft: '#E2EFFC',
  skyInk: '#2D6AA8',
  mint: '#6FCFAE', // 薄荷綠（狀態 OK）
  mintSoft: '#DCF4EA',
  mintInk: '#1D7556',
  shadow: '0 1px 2px rgba(51,40,58,.06), 0 6px 18px rgba(51,40,58,.06)',
};

export const NIGHT: Palette = {
  bg: '#141832', // 夜空藍
  surface: '#1E2346',
  surface2: '#272D58',
  border: '#343B6E',
  ink: '#F6F1E7',
  muted: '#A8A5C6',
  onStar: '#1A1530',
  star: '#FFD84D',
  starDeep: '#FFC61A',
  starSoft: '#3A3650',
  cheek: '#FF8C9B',
  cheekSoft: '#45304F',
  cheekInk: '#FFAAB6',
  sky: '#8FC3FF',
  skySoft: '#243963',
  skyInk: '#A9CFFF',
  mint: '#74D6B4',
  mintSoft: '#1E4447',
  mintInk: '#93E3C4',
  shadow: '0 1px 2px rgba(0,0,0,.25), 0 8px 24px rgba(0,0,0,.25)',
};

export const SWATCHES: { name: string; light: string; dark: string; role: string }[] = [
  { name: '星光黃', light: DAYLIGHT.star, dark: NIGHT.star, role: '主色：目前分頁、主按鈕' },
  { name: '臉頰粉', light: DAYLIGHT.cheek, dark: NIGHT.cheek, role: '強調：提醒、memo、單車' },
  { name: '夢境藍', light: DAYLIGHT.sky, dark: NIGHT.sky, role: '輔助：天氣、大眾運輸、連結' },
  { name: '薄荷綠', light: DAYLIGHT.mint, dark: NIGHT.mint, role: '狀態：已付款、步行' },
  { name: '星星眼', light: DAYLIGHT.ink, dark: NIGHT.ink, role: '文字' },
  { name: '奶油星光 / 夜空藍', light: DAYLIGHT.bg, dark: NIGHT.bg, role: '背景' },
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
