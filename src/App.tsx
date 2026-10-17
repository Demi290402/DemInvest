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
          <div className="mx-auto mb-3 flex h-14 w-14 animate-pulse items-center justify-center rounded-2xl bg-brand-500/10 p-2 ring-1 ring-brand-500/20 shadow-soft-glow">
            <img src="/Logo_no_sfondo.png" alt="DemInvest" className="h-10 w-10 object-contain" />
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

      {/* Top Header con Brand, Navigazione Desktop e Controlli Globali */}
      <header className="sticky top-0 z-30 border-b border-slate-200/90 bg-white/95 backdrop-blur-md dark:border-navy-800/80 dark:bg-navy-950/95">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 px-4 py-3">
          {/* Brand Logo & Tagline */}
          <div
            onClick={() => setActiveTab('dashboard')}
            className="flex cursor-pointer items-center gap-2.5 transition opacity-90 hover:opacity-100"
          >
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-500/10 p-1 ring-1 ring-brand-500/20 shadow-soft-glow dark:bg-navy-850/80">
              <img
                src="/Logo_no_sfondo.png"
                alt="DemInvest"
                className="h-8 w-8 object-contain transition group-hover:scale-105"
              />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="text-base font-extrabold tracking-tight text-slate-900 dark:text-white">
                  DemInvest
                </span>
                <span className="rounded-md bg-brand-500/15 px-1.5 py-0.5 font-mono text-[9px] font-bold text-brand-smart">
                  v1.0
                </span>
              </div>
              <p className="text-[10px] text-slate-500 dark:text-slate-400">
                Personal Investment Intelligence
              </p>
            </div>
          </div>

          {/* Menu Navigazione Desktop (Tutti i 7 moduli primari) */}
          <nav className="hidden items-center gap-1 lg:flex" aria-label="Navigazione Principale Desktop">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setActiveTab(item.id)}
                  data-testid={`nav-${item.id}`}
                  className={`relative flex items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-semibold transition focus-ring ${
                    isActive
                      ? 'bg-brand-500/15 text-brand-smart dark:text-brand-smart font-bold'
                      : 'text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-navy-850'
                  }`}
                >
                  <Icon className="h-4 w-4" aria-hidden="true" />
                  <span>{item.label}</span>
                  {item.badge !== undefined && (
                    <span className="ml-1 rounded-full bg-brand-500 px-1.5 py-0.2 text-[10px] font-bold text-anthracite-950">
                      {item.badge}
                    </span>
                  )}
                  {isActive && (
                    <span className="absolute bottom-0 left-3 right-3 h-0.5 rounded-full bg-brand-500" />
                  )}
                </button>
              );
            })}
          </nav>

          {/* Controlli Rapidi: Switch Semplice/Pro, Live/Demo, Tema, Assistente AI */}
          <div className="flex items-center gap-2">
            {/* Switch Modalità Semplice / Pro con selettore moderno */}
            <button
              type="button"
              onClick={() => setUiMode(uiMode === 'SIMPLE' ? 'PRO' : 'SIMPLE')}
              data-testid="toggle-ui-mode-btn"
              className="group flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-sm transition hover:border-brand-500/50 focus-ring dark:border-navy-700/80 dark:bg-navy-900 dark:text-slate-200"
              title="Passa tra vista Semplice guidata e vista PRO analitica"
              aria-label={`Modalità interfaccia: ${uiMode === 'SIMPLE' ? 'Semplice' : 'PRO'}`}
            >
              <span className="text-[10px] font-medium uppercase tracking-wider text-slate-400">Vista</span>
              <span className={`inline-flex items-center rounded-md px-1.5 py-0.5 text-[11px] font-bold ${
                uiMode === 'SIMPLE'
                  ? 'bg-emerald-500/15 text-emerald-600 dark:text-brand-smart'
                  : 'bg-cyan-500/15 text-cyan-600 dark:text-cyan-400'
              }`}>
                {uiMode === 'SIMPLE' ? 'Semplice' : 'PRO'}
              </span>
            </button>

            {/* Switch LIVE vs DEMO con indicatore di stato pulsante */}
            <button
              type="button"
              onClick={() =>
                setDataExecutionMode(dataExecutionMode === 'LIVE' ? 'DEMO' : 'LIVE')
              }
              data-testid="toggle-data-mode-btn"
              className={`flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-xs font-semibold shadow-sm transition focus-ring ${
                dataExecutionMode === 'LIVE'
                  ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                  : 'border-amber-500/30 bg-amber-500/10 text-amber-600 dark:text-amber-300'
              }`}
              title="Alterna tra feed di mercato Live e ambiente simulato Demo"
            >
              <span className={`h-2 w-2 rounded-full ${dataExecutionMode === 'LIVE' ? 'bg-emerald-500 animate-pulse' : 'bg-amber-400'}`} />
              <span className="font-bold tracking-tight">
                {dataExecutionMode === 'LIVE' ? 'Mercato Live' : 'Sandbox Demo'}
              </span>
            </button>

            {/* Switch Dark / Light */}
            <button
              type="button"
              onClick={() => setTheme(theme === 'DARK' ? 'LIGHT' : 'DARK')}
              className="touch-target inline-flex items-center justify-center rounded-xl border border-slate-300 p-2 text-slate-600 hover:bg-slate-100 focus-ring dark:border-navy-700 dark:text-slate-300 dark:hover:bg-navy-850"
              title="Cambia tema Chiaro / Scuro"
              aria-label="Cambia tema Chiaro o Scuro"
            >
              {theme === 'DARK' ? <Sun className="h-4 w-4" aria-hidden="true" /> : <Moon className="h-4 w-4" aria-hidden="true" />}
            </button>

            {/* Pulsante Header DemInvest AI */}
            <button
              type="button"
              onClick={() => setIsAiDrawerOpen(true)}
              data-testid="header-ai-btn"
              className="flex items-center gap-1.5 rounded-xl bg-brand-500 px-3 py-2 text-xs font-bold text-anthracite-950 transition hover:bg-brand-400 shadow-sm focus-ring"
              title="Apri Assistente Contestuale DemInvest AI"
            >
              <Bot className="h-4 w-4" aria-hidden="true" />
              <span className="hidden sm:inline">DemInvest AI</span>
            </button>
          </div>
        </div>

        {/* Barra di Navigazione Rapida Superiore per Schermi Mobile / Tablet (Garantisce compatibilità e test selectors) */}
        <div className="flex overflow-x-auto border-t border-slate-200/80 px-2 py-1.5 lg:hidden dark:border-navy-800/80 scrollbar-none" aria-label="Navigazione Rapida">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={`top-mobile-${item.id}`}
                type="button"
                onClick={() => setActiveTab(item.id)}
                data-testid={`mobile-nav-${item.id}`}
                className={`flex shrink-0 items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-semibold transition ${
                  isActive
                    ? 'bg-brand-500/15 text-brand-smart font-bold'
                    : 'text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-navy-850'
                }`}
              >
                <Icon className="h-3.5 w-3.5" aria-hidden="true" />
                <span>{item.label}</span>
                {item.badge !== undefined && (
                  <span className="rounded-full bg-brand-500 px-1 text-[9px] font-bold text-anthracite-950">
                    {item.badge}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </header>

      {/* Contenuto Principale (con padding inferiore protetto per la bottom bar mobile) */}
      <main className="mx-auto max-w-7xl px-4 py-6 pb-28 lg:pb-8" id="main-content">
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

      {/* Floating Action Button (FAB) Mobile per DemInvest AI (Sempre a portata di pollice) */}
      <button
        type="button"
        onClick={() => setIsAiDrawerOpen(true)}
        className="fixed bottom-20 right-4 z-40 flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-500 text-anthracite-950 shadow-lg shadow-brand-500/25 transition hover:scale-105 active:scale-95 lg:hidden focus-ring"
        aria-label="Apri assistente DemInvest AI"
      >
        <Bot className="h-6 w-6" aria-hidden="true" />
      </button>

      {/* Ergonomic Mobile Bottom Navigation Bar (Sezione 8.2 Master Prompt 4) */}
      <nav
        className="fixed bottom-0 inset-x-0 z-40 border-t border-slate-200/90 bg-white/95 px-2 py-1.5 backdrop-blur-lg dark:border-navy-800/90 dark:bg-navy-950/95 lg:hidden"
        aria-label="Navigazione Ergonomica Inferiore"
      >
        <div className="mx-auto grid grid-cols-5 max-w-md items-center">
          {[
            { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
            { id: 'markets', label: 'Mercati', icon: LineChart },
            { id: 'opportunities', label: 'Opportunità', icon: Compass },
            { id: 'portfolio', label: 'Portafoglio', icon: Wallet },
            {
              id: 'notifications',
              label: 'Avvisi',
              icon: Bell,
              badge: unreadCount > 0 ? unreadCount : undefined,
            },
          ].map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={`bottom-${tab.id}`}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={`relative flex flex-col items-center justify-center py-1 text-[10px] font-semibold transition touch-target ${
                  isActive
                    ? 'text-brand-smart dark:text-brand-smart'
                    : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'
                }`}
              >
                <div className="relative">
                  <Icon className="h-5 w-5" aria-hidden="true" />
                  {tab.badge !== undefined && (
                    <span className="absolute -top-1 -right-2 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-brand-500 px-1 text-[9px] font-bold text-anthracite-950">
                      {tab.badge}
                    </span>
                  )}
                </div>
                <span className="mt-0.5 tracking-tight truncate max-w-[64px]">{tab.label}</span>
                {isActive && (
                  <span className="absolute bottom-0 h-1 w-5 rounded-full bg-brand-500" />
                )}
              </button>
            );
          })}
        </div>
      </nav>

      {/* Footer di Conformità e Sicurezza Operativa */}
      <footer className="mt-12 border-t border-slate-200/80 bg-white py-5 text-xs text-slate-500 dark:border-navy-800/80 dark:bg-navy-950 dark:text-slate-400">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-2 px-4 sm:flex-row">
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-brand-smart" aria-hidden="true" />
            <span>
              <strong>DemInvest — Personal Investment Intelligence:</strong> Sistema privato di supporto analitico alle decisioni. Nessun modulo può eseguire ordini sui tuoi broker.
            </span>
          </div>
          <div className="text-[11px] text-slate-500">
            Zero promesse di rendimento • Distinzione rigorosa Spot vs CFD • Dati con fonte verificata e timestamp
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
