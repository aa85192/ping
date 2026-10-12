import { CalendarDays, House, Inbox, Map, Settings } from 'lucide-react';
import type { ComponentType } from 'react';
import { TAB_LABEL, usePrefs, type TabId } from '../lib/prefs';

const ICON: Record<TabId, ComponentType<{ size?: number; strokeWidth?: number }>> = {
  home: House,
  plan: CalendarDays,
  map: Map,
  inbox: Inbox,
  settings: Settings,
};

export function TabBar({ current, onChange, badges }: { current: TabId; onChange: (t: TabId) => void; badges: Partial<Record<TabId, number>> }) {
  const tabs = usePrefs((s) => s.tabs);
  return (
    <nav className="tabbar" aria-label="主要分頁">
      <div className="tabbar-inner">
        {tabs
          .filter((t) => t.visible || t.id === 'settings')
          .map(({ id }) => {
            const Icon = ICON[id];
            const n = badges[id];
            return (
              <button key={id} className="tab" aria-current={current === id ? 'page' : undefined} onClick={() => onChange(id)}>
                <span className="tab-icon">
                  <Icon size={21} strokeWidth={current === id ? 2.4 : 2} />
                </span>
                {TAB_LABEL[id]}
                {n ? <span className={`badge num ${id === 'inbox' ? '' : 'count'}`}>{n > 99 ? '99+' : n}</span> : null}
              </button>
            );
          })}
      </div>
    </nav>
  );
}
