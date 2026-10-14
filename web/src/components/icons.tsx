import {
  Bike,
  Car,
  Cloud,
  CloudDrizzle,
  CloudFog,
  CloudLightning,
  CloudRain,
  CloudSnow,
  CloudSun,
  Footprints,
  Globe,
  MapPin,
  Music2,
  Play,
  Sun,
  TrainFront,
  type LucideProps,
} from 'lucide-react';
import type { LinkKind, TravelMode } from '@ping/shared';

export const MODE_LABEL: Record<TravelMode, string> = {
  WALK: '步行',
  TRANSIT: '大眾運輸',
  DRIVE: '開車',
  BICYCLE: '單車',
};

export function ModeIcon({ mode, ...p }: { mode: TravelMode } & LucideProps) {
  if (mode === 'WALK') return <Footprints {...p} />;
  if (mode === 'TRANSIT') return <TrainFront {...p} />;
  if (mode === 'DRIVE') return <Car {...p} />;
  return <Bike {...p} />;
}

export function WeatherIcon({ code, ...p }: { code: number } & LucideProps) {
  if (code === 0) return <Sun {...p} />;
  if (code <= 2) return <CloudSun {...p} />;
  if (code === 3) return <Cloud {...p} />;
  if (code === 45 || code === 48) return <CloudFog {...p} />;
  if (code >= 51 && code <= 57) return <CloudDrizzle {...p} />;
  if ((code >= 61 && code <= 67) || (code >= 80 && code <= 82)) return <CloudRain {...p} />;
  if ((code >= 71 && code <= 77) || code === 85 || code === 86) return <CloudSnow {...p} />;
  if (code >= 95) return <CloudLightning {...p} />;
  return <Cloud {...p} />;
}

/** Simple generic marks; brand logos are intentionally not reproduced. */
function ThreadsMark({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
      <path d="M16.5 11.2c-.4-2.4-2-3.7-4.3-3.7-2.6 0-4.2 1.9-4.2 4.5s1.6 4.5 4.2 4.5c2.3 0 3.6-1.3 3.6-3.1 0-1.6-1.2-2.6-3-2.6-1.6 0-2.6.9-2.6 2 0 1 .8 1.7 2 1.7 2.4 0 4.3-1.8 4.3-5 0-3.8-2.9-6-6.6-6C5.6 3.5 3 6.6 3 12s2.6 8.5 7.6 8.5c3 0 5-1.1 6.3-3" />
    </svg>
  );
}

function CameraMark({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <rect x="3.5" y="3.5" width="17" height="17" rx="5" />
      <circle cx="12" cy="12" r="4" />
      <circle cx="17.2" cy="6.8" r=".8" fill="currentColor" />
    </svg>
  );
}

export function LinkIcon({ kind, size = 18 }: { kind: LinkKind; size?: number }) {
  switch (kind) {
    case 'threads':
      return <ThreadsMark size={size} />;
    case 'instagram':
      return <CameraMark size={size} />;
    case 'youtube':
      return <Play size={size} />;
    case 'tiktok':
      return <Music2 size={size} />;
    case 'google-maps':
      return <MapPin size={size} />;
    default:
      return <Globe size={size} />;
  }
}

/** 星星人風格的星星：星星黃＋描邊棕輪廓、棕色眼睛帶星形高光、腮紅。 */
export function StarMark({ size = 28, face = true, fill = '#FCD32C' }: { size?: number; face?: boolean; fill?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" aria-hidden="true">
      <path
        d="M50 8c2.2 0 3.6 1.3 4.6 3.4l9.6 19.5 21.5 3.1c2.3.3 3.8 1.3 4.5 3.3.7 2.1 0 3.8-1.6 5.4L73 58.8l3.7 21.4c.4 2.3-.2 4-2 5.3-1.8 1.3-3.6 1.3-5.6.2L50 75.6 30.8 85.7c-2 1.1-3.8 1.1-5.6-.2-1.8-1.3-2.4-3-2-5.3L27 58.8 11.4 42.7c-1.6-1.6-2.3-3.3-1.6-5.4.7-2 2.2-3 4.5-3.3l21.5-3.1 9.6-19.5C46.4 9.3 47.8 8 50 8z"
        fill={fill}
        stroke={face ? '#7A3E18' : 'none'}
        strokeWidth="4"
        strokeLinejoin="round"
      />
      {face && (
        <g>
          <ellipse cx="34" cy="59" rx="6.5" ry="4.2" fill="#F2633A" opacity=".85" />
          <ellipse cx="66" cy="59" rx="6.5" ry="4.2" fill="#F2633A" opacity=".85" />
          <ellipse cx="41" cy="50" rx="4" ry="5" fill="#7A3E18" />
          <ellipse cx="59" cy="50" rx="4" ry="5" fill="#7A3E18" />
          <circle cx="42.2" cy="48.4" r="1.3" fill="#FFF8E7" />
          <circle cx="60.2" cy="48.4" r="1.3" fill="#FFF8E7" />
          <path d="M46.5 60c1.8 1.6 5.2 1.6 7 0" fill="none" stroke="#7A3E18" strokeWidth="2.2" strokeLinecap="round" />
        </g>
      )}
    </svg>
  );
}
