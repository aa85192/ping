import { useEffect, useState } from 'react';
import { TabBar } from './components/TabBar';
import { ToastHost } from './components/Toast';
import { StarMark } from './components/icons';
import { CardSheet } from './features/card/CardSheet';
import { Dashboard } from './features/dashboard/Dashboard';
import { Inbox } from './features/inbox/Inbox';
import { Plan } from './features/itinerary/Plan';
import { MapView } from './features/map/MapView';
import { PickTrip, SignIn } from './features/onboarding/Onboarding';
import { Settings } from './features/settings/Settings';
import type { TabId } from './lib/prefs';
import { useApplyTheme } from './lib/useTheme';
import { useApp } from './store';

const TABS: TabId[] = ['home', 'plan', 'map', 'inbox', 'settings'];

function readHash(): TabId {
  const h = location.hash.replace(/^#\/?/, '') as TabId;
  return TABS.includes(h) ? h : 'home';
}

/** Android share sheet → /share?title=&text=&url= (see manifest share_target). */
function captureShare() {
  if (location.pathname !== '/share') return;
  const p = new URLSearchParams(location.search);
  const text = [p.get('title'), p.get('text'), p.get('url')].filter(Boolean).join('\n');
  if (text) sessionStorage.setItem('ping:share', text);
  history.replaceState(null, '', '/#/inbox');
}
captureShare();

export function App() {
  useApplyTheme();
  const phase = useApp((s) => s.phase);
  const error = useApp((s) => s.error);
  const cards = useApp((s) => s.cards);
  const openCardId = useApp((s) => s.openCardId);
  const [tab, setTab] = useState<TabId>(readHash);

  useEffect(() => {
    void useApp.getState().boot();
    const onHash = () => setTab(readHash());
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  useEffect(() => {
    if (phase !== 'ready') return;
    const shared = sessionStorage.getItem('ping:share');
    if (shared) {
      sessionStorage.removeItem('ping:share');
      void useApp.getState().addFromText(shared, null);
    }
  }, [phase]);

  const go = (t: TabId) => {
    location.hash = `/${t}`;
    window.scrollTo({ top: 0 });
  };

  if (phase === 'boot')
    return (
      <div className="center-screen">
        <span className="twinkle">
          <StarMark size={64} />
        </span>
      </div>
    );
  if (phase === 'signin') return <SignIn />;
  if (phase === 'pick') return <PickTrip />;
  if (phase === 'error')
    return (
      <div className="center-screen">
        <StarMark size={56} />
        <h1>出了點狀況</h1>
        <p className="muted">{error}</p>
        <button className="btn primary" onClick={() => location.reload()}>
          重新載入
        </button>
      </div>
    );

  const inboxCount = cards.filter((c) => c.day === null).length;
  return (
    <div className="app">
      {tab === 'home' && <Dashboard onNavigate={go} />}
      {tab === 'plan' && <Plan />}
      {tab === 'map' && <MapView />}
      {tab === 'inbox' && <Inbox />}
      {tab === 'settings' && <Settings />}
      {openCardId && <CardSheet cardId={openCardId} />}
      <ToastHost />
      <TabBar current={tab} onChange={go} badges={{ plan: cards.length - inboxCount, inbox: inboxCount }} />
    </div>
  );
}
