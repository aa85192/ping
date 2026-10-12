import { useEffect, useState } from 'react';
import { applyPalette, buildPalette, DAYLIGHT, NIGHT } from '../theme/tokens';
import { usePrefs } from './prefs';

export function useSystemDark(): boolean {
  const q = '(prefers-color-scheme: dark)';
  const [dark, setDark] = useState(() => window.matchMedia?.(q).matches ?? false);
  useEffect(() => {
    const mq = window.matchMedia?.(q);
    if (!mq) return;
    const on = () => setDark(mq.matches);
    mq.addEventListener('change', on);
    return () => mq.removeEventListener('change', on);
  }, []);
  return dark;
}

export function useApplyTheme() {
  const mode = usePrefs((s) => s.themeMode);
  const overrides = usePrefs((s) => s.overrides);
  const systemDark = useSystemDark();
  const dark = mode === 'dark' || (mode === 'system' && systemDark);
  useEffect(() => {
    document.documentElement.dataset.theme = dark ? 'dark' : 'light';
    applyPalette(buildPalette(dark ? NIGHT : DAYLIGHT, overrides), overrides.radius ?? 16);
  }, [dark, overrides]);
  return dark;
}
