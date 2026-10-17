import React, { useEffect, useState } from 'react';
import {
  Bell,
  Bot,
  Compass,
  FlaskConical,
  LayoutDashboard,
  LineChart,
  Moon,
  Settings,
  ShieldAlert,
  ShieldCheck,
  Sun,
  TrendingUp,
  Wallet,
  WifiOff,
} from 'lucide-react';
import { DemInvestProvider, useDemInvest } from './context/DemInvestContext';
import { AuthAndOnboardingView } from './components/AuthAndOnboardingView';
import { ContextualAiDrawer } from './components/ContextualAiDrawer';
import { DashboardView } from './views/DashboardView';
import { MarketsView } from './views/MarketsView';
import { OpportunitiesView } from './views/OpportunitiesView';
import { TradingLabView } from './views/TradingLabView';
import { PortfolioView } from './views/PortfolioView';
import {
  NotificationsView,
  SettingsView,
} from './views/NotificationsAndSettingsView';

const MainShell: React.FC = () => {
  const {
    isLoading,
    isOffline,
    isAuthenticated,
    user,
    uiMode,
    theme,
    dataExecutionMode,
    notifications,
    setUiMode,
    setTheme,
    setDataExecutionMode,
    setSelectedInstrumentId,
    setIsAiDrawerOpen,
  } = useDemInvest();

  const [activeTab, setActiveTab] = useState<string>('dashboard');

  // Ascolta messaggi dal Service Worker (es. click su notifica Web Push)
  useEffect(() => {
    if (!('serviceWorker' in navigator)) return;
    const handler = (event: MessageEvent) => {
      if (event.data?.type === 'NOTIFICATION_CLICKED') {
        if (event.data.data?.assetId) {
          setSelectedInstrumentId(event.data.data.assetId);
          setActiveTab('markets');
        } else {
          setActiveTab('notifications');
        }
      }
    };
    navigator.serviceWorker.addEventListener('message', handler);
    return () => navigator.serviceWorker.removeEventListener('message', handler);
  }, [setSelectedInstrumentId]);

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-anthracite-950 text-slate-200">
        <div className="text-center">
          <div className="mx-auto mb-3 flex h-12 w-12 animate-pulse items-center justify-center rounded-2xl bg-brand-500/20 text-brand-400">
            <TrendingUp className="h-6 w-6" />
          </div>
          <div className="text-sm font-bold">Inizializzazione DemInvest...</div>
          <div className="mt-1 text-xs text-slate-500">
            Verifica integrità catalogo strumenti e stato provider
          </div>
        </div>
      </div>
    );
  }

  if (!isAuthenticated || (user && !user.onboardingCompleted)) {
    return <AuthAndOnboardingView />;
  }

  const unreadCount = notifications.filter((n) => n.deliveryStatus !== 'READ').length;

  const navItems = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'markets', label: 'Mercati', icon: LineChart },
    { id: 'opportunities', label: 'Opportunità', icon: Compass },
    { id: 'lab', label: 'Trading Lab', icon: FlaskConical },
    { id: 'portfolio', label: 'Portafoglio', icon: Wallet },
    {
      id: 'notifications',
      label: 'Notifiche',
      icon: Bell,
      badge: unreadCount > 0 ? unreadCount : undefined,
    },
    { id: 'settings', label: 'Impostazioni', icon: Settings },
  ];

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 dark:bg-anthracite-900 dark:text-slate-100">
      {/* Banner Offline di Sicurezza (Sezione 20) */}
      {isOffline && (
        <div className="flex items-center justify-center gap-2 bg-red-600 px-4 py-2 text-xs font-bold text-white">
          <WifiOff className="h-4 w-4 shrink-0" />
          <span>
            MODALITÀ OFFLINE ATTIVA: Connessione assente. I prezzi memorizzati non sono quotazioni attuali e i segnali operativi sono sospesi.
          </span>
        </div>
      )}

      {/* Banner Modalità DEMO Didattica esplicitamente identificata (Regola 29) */}
      {dataExecutionMode === 'DEMO' && (
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-amber-500/40 bg-amber-500/15 px-4 py-2 text-xs text-amber-300">
          <div className="flex items-center gap-2 font-semibold">
            <ShieldAlert className="h-4 w-4 shrink-0 text-amber-400" />
            <span>
              MODALITÀ DEMO DIDATTICA ATTIVA — Stai consultando serie storiche dimostrative isolate dal mercato reale.
            </span>
          </div>
          <button
            type="button"
            onClick={() => setDataExecutionMode('LIVE')}
            className="rounded bg-amber-400 px-2.5 py-0.5 text-[11px] font-bold text-anthracite-950 hover:bg-amber-300"
          >
            Torna a Modalità LIVE Reale
          </button>
        </div>
      )}

      {/* Top Header */}
      <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/95 backdrop-blur-md dark:border-slate-800 dark:bg-anthracite-900/95">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 px-4 py-3">
          {/* Brand Logo */}
          <div
            onClick={() => setActiveTab('dashboard')}
            className="flex cursor-pointer items-center gap-2.5"
          >
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-500/15 text-brand-400 ring-1 ring-brand-500/30">
              <TrendingUp className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="text-base font-extrabold tracking-tight text-slate-900 dark:text-white">
                  DemInvest
                </span>
                <span className="rounded bg-brand-500/15 px-1.5 py-0.5 font-mono text-[9px] font-bold text-brand-500 dark:text-brand-400">
                  v1.0
                </span>
              </div>
              <p className="hidden text-[10px] text-slate-500 sm:block dark:text-slate-400">
                Personal Investment Intelligence
              </p>
            </div>
          </div>

          {/* Menu Navigazione Desktop */}
          <nav className="hidden items-center gap-1 lg:flex">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setActiveTab(item.id)}
                  data-testid={`nav-${item.id}`}
                  className={`relative flex items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-semibold transition ${
                    isActive
                      ? 'bg-brand-500/15 text-brand-500 dark:text-brand-400'
                      : 'text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-anthracite-850'
                  }`}
                >
                  <Icon className="h-4 w-4" />
                  <span>{item.label}</span>
                  {item.badge !== undefined && (
                    <span className="ml-1 rounded-full bg-brand-500 px-1.5 py-0.2 text-[10px] font-bold text-anthracite-950">
                      {item.badge}
                    </span>
                  )}
                </button>
              );
            })}
          </nav>

          {/* Controlli Rapidi: Switch Semplice/Pro, Live/Demo, Tema, Assistente AI */}
          <div className="flex items-center gap-2">
            {/* Switch Modalità Semplice / Pro */}
            <button
              type="button"
              onClick={() => setUiMode(uiMode === 'SIMPLE' ? 'PRO' : 'SIMPLE')}
              data-testid="toggle-ui-mode-btn"
              className="flex items-center gap-1.5 rounded-xl border border-slate-300 bg-slate-100 px-3 py-1.5 text-xs font-bold text-slate-800 transition hover:border-brand-500 dark:border-slate-700 dark:bg-anthracite-850 dark:text-slate-200"
              title="Passa tra Modalità Semplice e Modalità Pro"
            >
              <span className="text-[10px] uppercase text-slate-400">Vista:</span>
              <span className="text-brand-500 dark:text-brand-400">
                {uiMode === 'SIMPLE' ? 'Semplice' : 'PRO'}
              </span>
            </button>

            {/* Switch LIVE vs DEMO */}
            <button
              type="button"
              onClick={() =>
                setDataExecutionMode(dataExecutionMode === 'LIVE' ? 'DEMO' : 'LIVE')
              }
              data-testid="toggle-data-mode-btn"
              className={`rounded-xl border px-2.5 py-1.5 font-mono text-[11px] font-bold transition ${
                dataExecutionMode === 'LIVE'
                  ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-400'
                  : 'border-amber-500/50 bg-amber-500/20 text-amber-300'
              }`}
            >
              {dataExecutionMode === 'LIVE' ? '● LIVE' : '◐ DEMO'}
            </button>

            {/* Switch Dark / Light */}
            <button
              type="button"
              onClick={() => setTheme(theme === 'DARK' ? 'LIGHT' : 'DARK')}
              className="rounded-xl border border-slate-300 p-2 text-slate-600 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-anthracite-850"
              title="Cambia tema Chiaro / Scuro"
            >
              {theme === 'DARK' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </button>

            {/* Pulsante Contestuale DemInvest AI */}
            <button
              type="button"
              onClick={() => setIsAiDrawerOpen(true)}
              data-testid="header-ai-btn"
              className="flex items-center gap-1.5 rounded-xl bg-brand-500 px-3 py-2 text-xs font-bold text-anthracite-950 transition hover:bg-brand-400"
            >
              <Bot className="h-4 w-4" />
              <span className="hidden sm:inline">AI</span>
            </button>
          </div>
        </div>

        {/* Barra Navigazione Mobile / Tablet */}
        <div className="flex overflow-x-auto border-t border-slate-200 px-2 py-1.5 lg:hidden dark:border-slate-800">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setActiveTab(item.id)}
                className={`flex shrink-0 items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-semibold ${
                  isActive
                    ? 'bg-brand-500/15 text-brand-400'
                    : 'text-slate-500 dark:text-slate-400'
                }`}
              >
                <Icon className="h-3.5 w-3.5" />
                <span>{item.label}</span>
              </button>
            );
          })}
        </div>
      </header>

      {/* Contenuto Principale */}
      <main className="mx-auto max-w-7xl px-4 py-6">
        {activeTab === 'dashboard' && <DashboardView onNavigateTab={setActiveTab} />}
        {activeTab === 'markets' && <MarketsView />}
        {activeTab === 'opportunities' && (
          <OpportunitiesView
            onOpenInstrument={(instId) => {
              setSelectedInstrumentId(instId);
              setActiveTab('markets');
            }}
          />
        )}
        {activeTab === 'lab' && <TradingLabView />}
        {activeTab === 'portfolio' && <PortfolioView />}
        {activeTab === 'notifications' && <NotificationsView />}
        {activeTab === 'settings' && <SettingsView />}
      </main>

      {/* Footer di Conformità e Sicurezza Operativa */}
      <footer className="mt-12 border-t border-slate-200 bg-white py-5 text-xs text-slate-500 dark:border-slate-800 dark:bg-anthracite-950 dark:text-slate-400">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-2 px-4 sm:flex-row">
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-brand-500" />
            <span>
              <strong>DemInvest — Personal Investment Intelligence:</strong> Sistema privato di supporto alle decisioni. Nessun modulo può eseguire ordini sui tuoi broker.
            </span>
          </div>
          <div className="text-[11px] text-slate-500">
            Zero promesse di rendimento • Distinzione rigorosa Spot vs CFD • Dati con fonte e timestamp
          </div>
        </div>
      </footer>

      {/* Drawer Contestuale DemInvest AI */}
      <ContextualAiDrawer />
    </div>
  );
};

export const App: React.FC = () => {
  return (
    <DemInvestProvider>
      <MainShell />
    </DemInvestProvider>
  );
};

export default App;
