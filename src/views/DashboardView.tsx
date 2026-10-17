import React from 'react';
import {
  Activity,
  AlertTriangle,
  ArrowUpRight,
  Bell,
  Bot,
  CheckCircle2,
  Clock,
  Globe,
  RefreshCw,
  ShieldCheck,
  Star,
  TrendingDown,
  TrendingUp,
  Zap,
} from 'lucide-react';
import { useDemInvest } from '../context/DemInvestContext';
import { getMarketVenueStatus, TRADING_VENUES } from '../engines/instrumentRegistry';

interface DashboardViewProps {
  onNavigateTab: (tab: string) => void;
}

export const DashboardView: React.FC<DashboardViewProps> = ({ onNavigateTab }) => {
  const {
    user,
    uiMode,
    dataExecutionMode,
    instruments,
    quotes,
    watchlistInstrumentIds,
    generatedSignals,
    alertRules,
    notifications,
    schedulerStatus,
    portfolioAnalytics,
    setSelectedInstrumentId,
    setIsAiDrawerOpen,
    refreshMarketQuotes,
    triggerSchedulerNow,
  } = useDemInvest();

  const venueList = Object.keys(TRADING_VENUES).map((mic) => getMarketVenueStatus(mic));
  const watchlistInstruments = instruments.filter((i) =>
    watchlistInstrumentIds.includes(i.id)
  );
  const activeSignals = generatedSignals.filter(
    (s) =>
      s.signalType !== 'NO_TRADE' &&
      (s.status === 'CONFIRMED' ||
        s.status === 'AWAITING_CONFIRMATION' ||
        s.status === 'DETECTED')
  );

  const openInstrumentDetail = (instId: string) => {
    setSelectedInstrumentId(instId);
    onNavigateTab('markets');
  };

  return (
    <div className="space-y-6">
      {/* Saluto personalizzato, stato freschezza dati e processi automatici */}
      <div className="flex flex-col justify-between gap-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-anthracite-850 lg:flex-row lg:items-center">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1 rounded-full bg-brand-500/15 px-2.5 py-0.5 text-xs font-semibold text-brand-500 dark:text-brand-400">
              <ShieldCheck className="h-3.5 w-3.5" />
              Istanza Privata Proprietario
            </span>
            <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-600 dark:bg-slate-800 dark:text-slate-300">
              Vista {uiMode === 'SIMPLE' ? 'Semplice Guidata' : 'Pro Quantitativa'}
            </span>
          </div>
          <h1 className="mt-2 text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
            Bentornato, {user?.displayName || 'Investitore'}
          </h1>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            {uiMode === 'SIMPLE'
              ? 'Panoramica essenziale dei mercati, della tua watchlist e degli avvisi verificati.'
              : 'Controllo operativo multi-asset, freschezza feed, segnali deterministici e rischio di portafoglio.'}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {/* Stato Scheduler Backend */}
          <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2 text-xs dark:border-slate-800 dark:bg-anthracite-900">
            <Activity className="h-4 w-4 text-brand-500" />
            <div>
              <div className="font-semibold text-slate-800 dark:text-slate-200">
                Scheduler: {schedulerStatus?.mode === 'ACTIVE_BACKEND_CRON' ? 'Attivo' : 'Sospeso'}
              </div>
              <div className="text-[10px] text-slate-500">
                Budget API: {schedulerStatus?.dailyApiCallsUsed ?? 0}/
                {schedulerStatus?.dailyApiBudget ?? 500}
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={() => refreshMarketQuotes()}
            className="flex items-center gap-1.5 rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-xs font-semibold text-slate-700 transition hover:border-brand-500 dark:border-slate-700 dark:bg-anthracite-900 dark:text-slate-200"
          >
            <RefreshCw className="h-3.5 w-3.5 text-brand-400" />
            Aggiorna Quotazioni
          </button>

          <button
            type="button"
            onClick={() => triggerSchedulerNow()}
            data-testid="run-scheduler-btn"
            className="flex items-center gap-1.5 rounded-xl border border-brand-500/40 bg-brand-500/10 px-3.5 py-2.5 text-xs font-semibold text-brand-400 transition hover:bg-brand-500/20"
          >
            <Zap className="h-3.5 w-3.5" />
            Esegui Scansione Segnali
          </button>

          <button
            type="button"
            onClick={() => setIsAiDrawerOpen(true)}
            data-testid="open-ai-assistant-btn"
            className="flex items-center gap-1.5 rounded-xl bg-brand-500 px-4 py-2.5 text-xs font-semibold text-anthracite-950 shadow-sm transition hover:bg-brand-400"
          >
            <Bot className="h-4 w-4" />
            Apri DemInvest AI
          </button>
        </div>
      </div>

      {/* Stato Principali Borse (Mercati Aperti e Chiusi) */}
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-anthracite-850">
        <div className="mb-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Globe className="h-4 w-4 text-brand-500" />
            <h2 className="text-sm font-bold uppercase tracking-wider text-slate-700 dark:text-slate-200">
              Stato Principali Borse & Sessioni di Mercato
            </h2>
          </div>
          <span className="text-[11px] text-slate-500 dark:text-slate-400">
            Calcolo fusi orari in tempo reale
          </span>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {venueList.slice(0, 4).map((v) => (
            <div
              key={v.venue.micCode}
              className="flex items-center justify-between rounded-xl border border-slate-200/80 bg-slate-50/70 p-3 dark:border-slate-800 dark:bg-anthracite-900"
            >
              <div>
                <div className="flex items-center gap-1.5">
                  <span className="font-mono text-xs font-bold text-slate-900 dark:text-white">
                    {v.venue.micCode}
                  </span>
                  <span className="text-[11px] text-slate-500">({v.venue.countryCode})</span>
                </div>
                <div className="mt-0.5 text-xs font-medium text-slate-600 dark:text-slate-300">
                  {v.venue.name}
                </div>
                <div className="mt-1 text-[10px] text-slate-500">{v.statusLabel}</div>
              </div>
              <span
                className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[10px] font-bold ${
                  v.isOpen
                    ? 'bg-emerald-500/15 text-emerald-400'
                    : 'bg-slate-500/15 text-slate-400'
                }`}
              >
                <span
                  className={`h-1.5 w-1.5 rounded-full ${
                    v.isOpen ? 'bg-emerald-400' : 'bg-slate-400'
                  }`}
                />
                {v.isOpen ? 'APERTO' : 'CHIUSO'}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* KPI Sintetici Portafoglio, Segnali e Freschezza */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div
          onClick={() => onNavigateTab('portfolio')}
          className="cursor-pointer rounded-2xl border border-slate-200 bg-white p-5 transition hover:border-brand-500/50 dark:border-slate-800 dark:bg-anthracite-850"
        >
          <div className="flex items-center justify-between text-xs font-medium text-slate-500 dark:text-slate-400">
            <span>Controvalore Stimato Portafoglio</span>
            <ArrowUpRight className="h-4 w-4 text-brand-400" />
          </div>
          <div className="num-mono mt-2 text-2xl font-bold text-slate-900 dark:text-white">
            {portfolioAnalytics
              ? `${portfolioAnalytics.totalPortfolioEquityInBase.toLocaleString('it-IT', {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })} ${portfolioAnalytics.baseCurrency}`
              : 'In calcolo...'}
          </div>
          <div className="mt-1 flex items-center gap-2 text-xs">
            {portfolioAnalytics && (
              <span
                className={
                  portfolioAnalytics.unrealizedPnlInBase >= 0
                    ? 'font-semibold text-emerald-400'
                    : 'font-semibold text-red-400'
                }
              >
                P&L Non Realizzato: {portfolioAnalytics.unrealizedPnlInBase >= 0 ? '+' : ''}
                {portfolioAnalytics.unrealizedPnlInBase.toFixed(2)}{' '}
                {portfolioAnalytics.baseCurrency} ({portfolioAnalytics.unrealizedPnlPct.toFixed(2)}%)
              </span>
            )}
          </div>
        </div>

        <div
          onClick={() => onNavigateTab('opportunities')}
          className="cursor-pointer rounded-2xl border border-slate-200 bg-white p-5 transition hover:border-brand-500/50 dark:border-slate-800 dark:bg-anthracite-850"
        >
          <div className="flex items-center justify-between text-xs font-medium text-slate-500 dark:text-slate-400">
            <span>Segnali Deterministici Attivi</span>
            <Zap className="h-4 w-4 text-brand-400" />
          </div>
          <div className="num-mono mt-2 text-2xl font-bold text-slate-900 dark:text-white">
            {activeSignals.length}
          </div>
          <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            Su {generatedSignals.length} valutazioni storiche totali
          </div>
        </div>

        <div
          onClick={() => onNavigateTab('notifications')}
          className="cursor-pointer rounded-2xl border border-slate-200 bg-white p-5 transition hover:border-brand-500/50 dark:border-slate-800 dark:bg-anthracite-850"
        >
          <div className="flex items-center justify-between text-xs font-medium text-slate-500 dark:text-slate-400">
            <span>Regole Alert & Centro Notifiche</span>
            <Bell className="h-4 w-4 text-brand-400" />
          </div>
          <div className="num-mono mt-2 text-2xl font-bold text-slate-900 dark:text-white">
            {alertRules.filter((r) => r.isActive).length} Regole Attive
          </div>
          <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            {notifications.length} eventi registrati nel registro avvisi
          </div>
        </div>

        <div
          onClick={() => onNavigateTab('settings')}
          className="cursor-pointer rounded-2xl border border-slate-200 bg-white p-5 transition hover:border-brand-500/50 dark:border-slate-800 dark:bg-anthracite-850"
        >
          <div className="flex items-center justify-between text-xs font-medium text-slate-500 dark:text-slate-400">
            <span>Integrità & Freschezza Dati</span>
            <Clock className="h-4 w-4 text-brand-400" />
          </div>
          <div className="mt-2 text-lg font-bold text-slate-900 dark:text-white">
            {dataExecutionMode === 'LIVE' ? 'Modalità LIVE Reale' : 'Modalità DEMO Didattica'}
          </div>
          <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            {dataExecutionMode === 'LIVE'
              ? 'Zero prezzi inventati — Fonti verificate'
              : 'Dataset dimostrativo isolato'}
          </div>
        </div>
      </div>

      {/* Watchlist Personale & Asset Principali */}
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-anthracite-850">
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Star className="h-4 w-4 text-amber-400" />
            <h2 className="text-sm font-bold uppercase tracking-wider text-slate-700 dark:text-slate-200">
              Watchlist Personale & Quotazioni Verificate
            </h2>
          </div>
          <button
            type="button"
            onClick={() => onNavigateTab('markets')}
            className="text-xs font-semibold text-brand-500 hover:underline"
          >
            Esplora tutti gli strumenti &rarr;
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-slate-200 text-[11px] uppercase text-slate-500 dark:border-slate-800 dark:text-slate-400">
                <th className="pb-3 font-semibold">Strumento</th>
                <th className="pb-3 font-semibold">Classe / Mercato (MIC)</th>
                <th className="pb-3 text-right font-semibold">Ultimo Prezzo</th>
                <th className="pb-3 text-right font-semibold">Var. 24h</th>
                <th className="pb-3 font-semibold">Fonte Dato & Freschezza</th>
                <th className="pb-3 text-right font-semibold">Azioni</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/70">
              {watchlistInstruments.map((inst) => {
                const q = quotes[inst.id];
                const isValid = q && q.validity === 'VALID' && q.price > 0;
                const isPositive = (q?.changePct ?? 0) >= 0;

                return (
                  <tr
                    key={inst.id}
                    className="transition hover:bg-slate-50 dark:hover:bg-anthracite-900/70"
                  >
                    <td className="py-3.5 pr-4">
                      <div className="font-bold text-slate-900 dark:text-white">
                        {inst.ticker}
                      </div>
                      <div className="text-[11px] text-slate-500">{inst.name}</div>
                    </td>
                    <td className="py-3.5 pr-4">
                      <span className="rounded bg-slate-100 px-2 py-0.5 font-mono text-[10px] font-semibold text-slate-700 dark:bg-slate-800 dark:text-slate-300">
                        {inst.assetClass} • {inst.venueMic}
                      </span>
                    </td>
                    <td className="num-mono py-3.5 pr-4 text-right font-bold text-slate-900 dark:text-white">
                      {isValid ? (
                        `${q.price.toLocaleString('it-IT', {
                          minimumFractionDigits: q.price < 10 ? 4 : 2,
                          maximumFractionDigits: q.price < 10 ? 4 : 2,
                        })} ${q.currency}`
                      ) : (
                        <span className="text-amber-400">Non disponibile</span>
                      )}
                    </td>
                    <td className="num-mono py-3.5 pr-4 text-right">
                      {isValid ? (
                        <span
                          className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 font-semibold ${
                            isPositive
                              ? 'bg-emerald-500/15 text-emerald-400'
                              : 'bg-red-500/15 text-red-400'
                          }`}
                        >
                          {isPositive ? (
                            <TrendingUp className="h-3 w-3" />
                          ) : (
                            <TrendingDown className="h-3 w-3" />
                          )}
                          {isPositive ? '+' : ''}
                          {q.changePct.toFixed(2)}%
                        </span>
                      ) : (
                        '—'
                      )}
                    </td>
                    <td className="py-3.5 pr-4">
                      {q ? (
                        <div>
                          <div className="flex items-center gap-1.5">
                            <span
                              className={`rounded px-1.5 py-0.5 text-[10px] font-bold ${
                                q.freshness === 'REALTIME'
                                  ? 'bg-emerald-500/15 text-emerald-400'
                                  : q.freshness === 'DELAYED'
                                    ? 'bg-sky-500/15 text-sky-400'
                                    : 'bg-amber-500/15 text-amber-400'
                              }`}
                            >
                              {q.freshness}
                            </span>
                            <span className="text-[11px] font-medium text-slate-600 dark:text-slate-300">
                              {q.providerName}
                            </span>
                          </div>
                          <div className="mt-0.5 font-mono text-[10px] text-slate-500">
                            Rilevato: {q.observedAt.slice(0, 19).replace('T', ' ')} UTC
                          </div>
                        </div>
                      ) : (
                        <span className="text-slate-500">Caricamento...</span>
                      )}
                    </td>
                    <td className="py-3.5 text-right">
                      <button
                        type="button"
                        onClick={() => openInstrumentDetail(inst.id)}
                        className="rounded-lg bg-brand-500/15 px-3 py-1.5 text-xs font-semibold text-brand-400 transition hover:bg-brand-500 hover:text-anthracite-950"
                      >
                        Analizza Scheda
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Ultimi Segnali e Spiegazione Guidata (Modalità Semplice vs Pro) */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-anthracite-850">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-sm font-bold uppercase tracking-wider text-slate-700 dark:text-slate-200">
              Ultimi Segnali & Valutazioni Quantitative
            </h3>
            <button
              type="button"
              onClick={() => onNavigateTab('opportunities')}
              className="text-xs font-semibold text-brand-400 hover:underline"
            >
              Vedi Screener & Storico &rarr;
            </button>
          </div>

          {generatedSignals.length === 0 ? (
            <div className="rounded-xl border border-slate-200/80 bg-slate-50 p-4 text-xs text-slate-500 dark:border-slate-800 dark:bg-anthracite-900">
              Premi <strong>"Esegui Scansione Segnali"</strong> in alto per avviare subito la valutazione deterministica sugli strumenti prioritari.
            </div>
          ) : (
            <div className="space-y-3">
              {generatedSignals.slice(0, 3).map((sig) => (
                <div
                  key={sig.id}
                  className="rounded-xl border border-slate-200 bg-slate-50 p-3.5 text-xs dark:border-slate-800 dark:bg-anthracite-900"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-slate-900 dark:text-white">
                        {sig.instrumentTicker}
                      </span>
                      <span
                        className={`rounded px-2 py-0.5 text-[10px] font-bold ${
                          sig.signalType === 'BUY_SETUP' || sig.signalType === 'BREAKOUT_ALERT'
                            ? 'bg-emerald-500/15 text-emerald-400'
                            : sig.signalType === 'NO_TRADE'
                              ? 'bg-slate-500/20 text-slate-300'
                              : 'bg-amber-500/15 text-amber-400'
                        }`}
                      >
                        {sig.signalType}
                      </span>
                      <span className="rounded bg-slate-200 px-2 py-0.5 text-[10px] font-semibold dark:bg-slate-800">
                        {sig.status}
                      </span>
                    </div>
                    <span className="num-mono text-[11px] font-semibold text-brand-400">
                      Punteggio Euristico: {sig.heuristicScore}/100
                    </span>
                  </div>
                  <p className="mt-2 leading-relaxed text-slate-600 dark:text-slate-300">
                    {sig.quantitativeRationale}
                  </p>
                  <div className="mt-2 flex flex-wrap items-center justify-between text-[10px] text-slate-500">
                    <span>
                      Orizzonte: <strong>{sig.horizon}</strong> | Fonte: {sig.providerId} (
                      {sig.quoteFreshness})
                    </span>
                    {sig.invalidationLevel && (
                      <span className="text-red-400">
                        Invalidazione: {sig.invalidationLevel} {sig.currency}
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Contesto Educativo / Macro & Presidio Rischi */}
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-anthracite-850">
          <h3 className="mb-3 text-sm font-bold uppercase tracking-wider text-slate-700 dark:text-slate-200">
            {uiMode === 'SIMPLE'
              ? 'Guida Rapida alla Lettura del Mercato (Modalità Semplice)'
              : 'Stato Regole di Qualità Dati & Presidio Rischi (Modalità Pro)'}
          </h3>

          <div className="space-y-3 text-xs leading-relaxed text-slate-600 dark:text-slate-300">
            <div className="rounded-xl border border-brand-500/20 bg-brand-500/5 p-3.5">
              <div className="flex items-center gap-2 font-bold text-brand-400">
                <CheckCircle2 className="h-4 w-4" />
                <span>Come leggere la Freschezza dei Dati (REALTIME vs DELAYED vs EOD)</span>
              </div>
              <p className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">
                DemInvest indica sempre l'origine e il ritardo di ogni prezzo. Le quotazioni <strong>EOD (End-Of-Day)</strong> rappresentano l'ultima chiusura giornaliera ufficiale e vengono automaticamente bloccate per qualsiasi analisi intraday (Orizzonte Brevissimo).
              </p>
            </div>

            <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-3.5">
              <div className="flex items-center gap-2 font-bold text-amber-400">
                <AlertTriangle className="h-4 w-4" />
                <span>Distinzione Fondamentale: Asset Spot vs CFD Derivati</span>
              </div>
              <p className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">
                Acquistare un'azione o una criptovaluta <strong>Spot</strong> (es. su Trade Republic o IBKR) significa detenere lo strumento. Negoziare un <strong>CFD</strong> (es. su AvaTrade o MetaTrader) è un contratto derivato a leva con spread OTC e costi di mantenimento overnight (swap).
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
