import React from 'react';
import {
  Activity,
  AlertTriangle,
  ArrowUpRight,
  Bell,
  Bot,
  CheckCircle2,
  Clock,
  Compass,
  Globe,
  HelpCircle,
  RefreshCw,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  Star,
  TrendingDown,
  TrendingUp,
  Wallet,
  Zap,
} from 'lucide-react';
import { useDemInvest } from '../context/DemInvestContext';
import { getMarketVenueStatus, TRADING_VENUES } from '../engines/instrumentRegistry';
import { KpiCard } from '../components/ui/Card';
import { SignalBadge } from '../components/ui/Badge';
import { Tooltip } from '../components/ui/Tooltip';

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
  const openVenuesCount = venueList.filter((v) => v.isOpen).length;
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
      {/* Saluto personalizzato, stato freschezza dati e controlli operativi */}
      <div className="flex flex-col justify-between gap-5 rounded-2xl border border-slate-200/90 bg-white p-6 shadow-sm dark:border-navy-800/80 dark:bg-navy-900/90 lg:flex-row lg:items-center">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-brand-500/15 px-3 py-0.5 text-xs font-semibold text-brand-smart">
              <ShieldCheck className="h-3.5 w-3.5" aria-hidden="true" />
              Istanza Personale Protetta
            </span>
            <span className="rounded-full bg-slate-100 px-3 py-0.5 text-xs font-medium text-slate-600 dark:bg-navy-800 dark:text-slate-300">
              Vista {uiMode === 'SIMPLE' ? 'Semplice Guidata' : 'PRO Quantitativa'}
            </span>
            {openVenuesCount > 0 ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/15 px-2.5 py-0.5 text-xs font-bold text-emerald-400">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
                {openVenuesCount} Borse Aperte
              </span>
            ) : (
              <span className="rounded-full bg-slate-200/70 px-2.5 py-0.5 text-xs text-slate-500 dark:bg-navy-850 dark:text-slate-400">
                Mercati Chiusi
              </span>
            )}
          </div>
          <h1 className="mt-2 text-2xl font-extrabold tracking-tight text-slate-900 dark:text-white sm:text-3xl">
            Bentornato, {user?.displayName || 'Investitore'}
          </h1>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400 max-w-2xl leading-relaxed">
            {uiMode === 'SIMPLE'
              ? 'Panoramica essenziale dei mercati, della tua watchlist e degli avvisi verificati. Decisioni calme, disciplinate e supportate da modelli matematici verificabili.'
              : 'Cockpit quantitativo: multi-asset consensus, indicatori dinamici ADX/ATR, controllo deviazioni e audit rigoroso dei feed ufficiali.'}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {/* Stato Scheduler Backend */}
          <div className="flex items-center gap-2.5 rounded-xl border border-slate-200/80 bg-slate-50/80 px-3.5 py-2 text-xs dark:border-navy-800 dark:bg-navy-850/80">
            <Activity className="h-4 w-4 text-brand-smart" aria-hidden="true" />
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
            className="flex items-center gap-1.5 rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-xs font-semibold text-slate-700 transition hover:border-brand-500 focus-ring dark:border-navy-700 dark:bg-navy-900 dark:text-slate-200"
            title="Aggiorna le quotazioni dei tuoi asset monitorati"
          >
            <RefreshCw className="h-3.5 w-3.5 text-brand-smart" aria-hidden="true" />
            Aggiorna Quotazioni
          </button>

          <button
            type="button"
            onClick={() => triggerSchedulerNow()}
            data-testid="run-scheduler-btn"
            className="flex items-center gap-1.5 rounded-xl border border-brand-500/40 bg-brand-500/10 px-3.5 py-2.5 text-xs font-semibold text-brand-smart transition hover:bg-brand-500/20 focus-ring"
            title="Esegue un ciclo immediato di valutazione quantitativa del mercato"
          >
            <Zap className="h-3.5 w-3.5" aria-hidden="true" />
            Esegui Scansione Segnali
          </button>

          <button
            type="button"
            onClick={() => setIsAiDrawerOpen(true)}
            data-testid="open-ai-assistant-btn"
            className="flex items-center gap-1.5 rounded-xl bg-brand-500 px-4 py-2.5 text-xs font-bold text-anthracite-950 shadow-sm transition hover:bg-brand-400 focus-ring"
          >
            <Bot className="h-4 w-4" aria-hidden="true" />
            Apri DemInvest AI
          </button>
        </div>
      </div>

      {/* Stato Principali Borse (Mercati Aperti e Chiusi) — Sezione 6.1 */}
      <div className="rounded-2xl border border-slate-200/90 bg-white p-5 shadow-sm dark:border-navy-800/80 dark:bg-navy-900/90">
        <div className="mb-3.5 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Globe className="h-4 w-4 text-brand-smart" aria-hidden="true" />
            <h2 className="text-sm font-bold uppercase tracking-wider text-slate-700 dark:text-slate-200">
              Stato Principali Borse & Sessioni di Mercato
            </h2>
          </div>
          <span className="text-[11px] text-slate-500 dark:text-slate-400">
            Fusi orari e calendari festività sincronizzati
          </span>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {venueList.slice(0, 4).map((v) => (
            <div
              key={v.venue.micCode}
              className="flex items-center justify-between rounded-xl border border-slate-200/80 bg-slate-50/70 p-3.5 transition hover:border-slate-300 dark:border-navy-800/70 dark:bg-navy-850/70 dark:hover:border-navy-700"
            >
              <div>
                <div className="flex items-center gap-1.5">
                  <span className="font-mono text-xs font-bold text-slate-900 dark:text-white">
                    {v.venue.micCode}
                  </span>
                  <span className="text-[11px] text-slate-500">({v.venue.countryCode})</span>
                </div>
                <div className="mt-0.5 text-xs font-medium text-slate-600 dark:text-slate-300 truncate max-w-[150px]">
                  {v.venue.name}
                </div>
                <div className="mt-1 text-[10px] text-slate-500">{v.statusLabel}</div>
              </div>
              <span
                className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-bold ${
                  v.isOpen
                    ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/25'
                    : 'bg-slate-500/15 text-slate-400 border border-slate-600/30'
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

      {/* KPI Sintetici Portafoglio, Segnali e Freschezza (Sezione 4.3 Design System) */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard
          title="Controvalore Stimato Portafoglio"
          value={
            portfolioAnalytics
              ? `${portfolioAnalytics.totalPortfolioEquityInBase.toLocaleString('it-IT', {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })} ${portfolioAnalytics.baseCurrency}`
              : 'Calcolo...'
          }
          subtitle={
            portfolioAnalytics
              ? `P&L: ${portfolioAnalytics.unrealizedPnlInBase >= 0 ? '+' : ''}${portfolioAnalytics.unrealizedPnlInBase.toFixed(2)} ${portfolioAnalytics.baseCurrency} (${portfolioAnalytics.unrealizedPnlPct.toFixed(2)}%)`
              : 'Nessuna operazione registrata'
          }
          changePct={portfolioAnalytics?.unrealizedPnlPct}
          icon={Wallet}
          onClick={() => onNavigateTab('portfolio')}
        />

        <KpiCard
          title="Segnali Quantitativi Attivi"
          value={activeSignals.length}
          subtitle={`Su ${generatedSignals.length} valutazioni storiche totali`}
          icon={Zap}
          badge={
            activeSignals.length > 0 ? (
              <span className="rounded-full bg-brand-500/15 px-2 py-0.5 text-[10px] font-bold text-brand-smart">
                Attivi
              </span>
            ) : undefined
          }
          onClick={() => onNavigateTab('opportunities')}
        />

        <KpiCard
          title="Regole Alert & Avvisi"
          value={`${alertRules.filter((r) => r.isActive).length} Attive`}
          subtitle={`${notifications.length} eventi nel registro notifiche`}
          icon={Bell}
          onClick={() => onNavigateTab('notifications')}
        />

        <KpiCard
          title="Integrità & Freschezza Dati"
          value={dataExecutionMode === 'LIVE' ? 'LIVE Reale' : 'DEMO Sandbox'}
          subtitle={
            dataExecutionMode === 'LIVE'
              ? 'Zero prezzi inventati — Fonti verificate'
              : 'Dati simulati isolati dal mercato'
          }
          icon={Clock}
          badge={
            <span
              className={`rounded-md px-2 py-0.5 font-mono text-[10px] font-bold ${
                dataExecutionMode === 'LIVE'
                  ? 'bg-emerald-500/15 text-emerald-400'
                  : 'bg-amber-500/15 text-amber-300'
              }`}
            >
              {dataExecutionMode}
            </span>
          }
          onClick={() => onNavigateTab('settings')}
        />
      </div>

      {/* Watchlist Personale & Asset Principali (Progressive Disclosure Semplice vs Pro) */}
      <div className="rounded-2xl border border-slate-200/90 bg-white p-5 shadow-sm dark:border-navy-800/80 dark:bg-navy-900/90">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Star className="h-4 w-4 text-amber-400" aria-hidden="true" />
            <h2 className="text-sm font-bold uppercase tracking-wider text-slate-700 dark:text-slate-200">
              Watchlist Personale & Quotazioni Verificate
            </h2>
          </div>
          <button
            type="button"
            onClick={() => onNavigateTab('markets')}
            className="text-xs font-semibold text-brand-smart hover:underline"
          >
            Esplora tutti gli strumenti &rarr;
          </button>
        </div>

        {/* Modalità Semplice: Card intuitive e leggibili */}
        {uiMode === 'SIMPLE' ? (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {watchlistInstruments.map((inst) => {
              const q = quotes[inst.id];
              const isValid = q && q.validity === 'VALID' && q.price > 0;
              const isPositive = (q?.changePct ?? 0) >= 0;

              return (
                <div
                  key={inst.id}
                  onClick={() => openInstrumentDetail(inst.id)}
                  className="flex cursor-pointer flex-col justify-between rounded-xl border border-slate-200/80 bg-slate-50/70 p-4 transition hover:border-brand-500/40 hover:bg-slate-100/70 dark:border-navy-800/80 dark:bg-navy-850/70 dark:hover:border-brand-500/40"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="text-sm font-extrabold text-slate-900 dark:text-white">
                        {inst.ticker}
                      </div>
                      <div className="text-xs text-slate-500 dark:text-slate-400 truncate max-w-[170px]">
                        {inst.name}
                      </div>
                    </div>
                    <span className="rounded-md bg-slate-200/70 px-2 py-0.5 text-[10px] font-semibold text-slate-700 dark:bg-navy-800 dark:text-slate-300">
                      {inst.assetClass}
                    </span>
                  </div>

                  <div className="mt-3 flex items-baseline justify-between gap-2">
                    <div className="num-mono text-lg font-extrabold text-slate-900 dark:text-white">
                      {isValid
                        ? `${q.price.toLocaleString('it-IT', {
                            minimumFractionDigits: q.price < 10 ? 4 : 2,
                            maximumFractionDigits: q.price < 10 ? 4 : 2,
                          })} ${q.currency}`
                        : '—'}
                    </div>
                    {isValid && (
                      <span
                        className={`num-mono inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-xs font-bold ${
                          isPositive
                            ? 'bg-emerald-500/15 text-emerald-400'
                            : 'bg-rose-500/15 text-rose-400'
                        }`}
                      >
                        {isPositive ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                        {isPositive ? '+' : ''}
                        {q.changePct.toFixed(2)}%
                      </span>
                    )}
                  </div>

                  <div className="mt-2.5 flex items-center justify-between text-[11px] text-slate-400 pt-2 border-t border-slate-200/50 dark:border-navy-800/50">
                    <span>{q?.providerName ? q.providerName.split(' ')[0] : 'Ufficiale'}</span>
                    <span className="font-semibold text-brand-smart">Apri Scheda &rarr;</span>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          /* Modalità PRO: Tabella dettagliata ad alta densità informativa */
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-200 text-[11px] uppercase tracking-wider text-slate-500 dark:border-navy-800 dark:text-slate-400">
                  <th className="pb-3 font-semibold">Strumento</th>
                  <th className="pb-3 font-semibold">Classe / Mercato (MIC)</th>
                  <th className="pb-3 text-right font-semibold">Ultimo Prezzo</th>
                  <th className="pb-3 text-right font-semibold">Variazione 24h</th>
                  <th className="pb-3 font-semibold">Fonte & Timestamp Feed</th>
                  <th className="pb-3 text-right font-semibold">Azioni</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-navy-800/70">
                {watchlistInstruments.map((inst) => {
                  const q = quotes[inst.id];
                  const isValid = q && q.validity === 'VALID' && q.price > 0;
                  const isPositive = (q?.changePct ?? 0) >= 0;

                  return (
                    <tr
                      key={inst.id}
                      className="transition hover:bg-slate-50 dark:hover:bg-navy-850/60"
                    >
                      <td className="py-3.5 pr-4">
                        <div className="font-bold text-slate-900 dark:text-white">
                          {inst.ticker}
                        </div>
                        <div className="text-[11px] text-slate-500">{inst.name}</div>
                      </td>
                      <td className="py-3.5 pr-4">
                        <span className="rounded bg-slate-100 px-2 py-0.5 font-mono text-[10px] font-semibold text-slate-700 dark:bg-navy-800 dark:text-slate-300">
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
                                : 'bg-rose-500/15 text-rose-400'
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
                              <span className="text-[11px] font-medium text-slate-600 dark:text-slate-300 truncate max-w-[130px]">
                                {q.providerName}
                              </span>
                            </div>
                            <div className="mt-0.5 font-mono text-[10px] text-slate-500">
                              {q.observedAt ? q.observedAt.slice(0, 19).replace('T', ' ') : 'N/D'} UTC
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
                          className="rounded-lg bg-brand-500/15 px-3 py-1.5 text-xs font-semibold text-brand-smart transition hover:bg-brand-500 hover:text-anthracite-950 focus-ring"
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
        )}
      </div>

      {/* Ultimi Segnali & Assistenza Contestuale AI */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="rounded-2xl border border-slate-200/90 bg-white p-5 shadow-sm dark:border-navy-800/80 dark:bg-navy-900/90">
          <div className="mb-3.5 flex items-center justify-between">
            <h3 className="text-sm font-bold uppercase tracking-wider text-slate-700 dark:text-slate-200">
              Ultimi Segnali & Configurazioni Rilevate
            </h3>
            <button
              type="button"
              onClick={() => onNavigateTab('opportunities')}
              className="text-xs font-semibold text-brand-smart hover:underline"
            >
              Vedi Screener Completo &rarr;
            </button>
          </div>

          {generatedSignals.length === 0 ? (
            <div className="rounded-xl border border-slate-200/80 bg-slate-50/70 p-4 text-xs text-slate-500 dark:border-navy-800 dark:bg-navy-850/60 leading-relaxed">
              Premi <strong>"Esegui Scansione Segnali"</strong> in alto per avviare subito la valutazione quantitativa sugli strumenti monitorati.
            </div>
          ) : (
            <div className="space-y-3">
              {generatedSignals.slice(0, 3).map((sig) => (
                <div
                  key={sig.id}
                  className="rounded-xl border border-slate-200/80 bg-slate-50/70 p-3.5 text-xs transition hover:border-slate-300 dark:border-navy-800/80 dark:bg-navy-850/70 dark:hover:border-navy-700"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="font-extrabold text-slate-900 dark:text-white">
                        {sig.instrumentTicker}
                      </span>
                      <SignalBadge classification={sig.signalType} size="sm" />
                      <span className="rounded bg-slate-200/80 px-2 py-0.5 text-[10px] font-semibold dark:bg-navy-800 text-slate-300">
                        {sig.status}
                      </span>
                    </div>
                    <span className="num-mono text-[11px] font-bold text-brand-smart">
                      Score: {sig.heuristicScore}/100
                    </span>
                  </div>
                  <p className="mt-2 text-xs leading-relaxed text-slate-600 dark:text-slate-300">
                    {sig.quantitativeRationale}
                  </p>
                  <div className="mt-2.5 flex flex-wrap items-center justify-between text-[10px] text-slate-500 pt-2 border-t border-slate-200/50 dark:border-navy-800/50">
                    <span>
                      Orizzonte: <strong>{sig.horizon}</strong> • Fonte: {sig.providerId}
                    </span>
                    {sig.invalidationLevel && (
                      <span className="font-semibold text-rose-400">
                        Invalidazione: {sig.invalidationLevel} {sig.currency}
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Chiedi a DemInvest AI — Box Contestuale Guidato */}
        <div className="rounded-2xl border border-brand-500/25 bg-gradient-to-br from-brand-500/5 via-transparent to-cyan-500/5 p-5 shadow-sm dark:border-navy-800/80 dark:bg-navy-900/90 flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <Sparkles className="h-4 w-4 text-brand-smart" aria-hidden="true" />
              <h3 className="text-sm font-bold uppercase tracking-wider text-slate-700 dark:text-slate-200">
                Assistenza Analitica DemInvest AI
              </h3>
            </div>
            <p className="text-xs leading-relaxed text-slate-600 dark:text-slate-300">
              Interroga l'analista contestuale con guardrail di sicurezza: l'AI consulta esclusivamente dati di mercato verificati e modelli matematici deterministici senza allucinare prezzi.
            </p>

            <div className="mt-4 space-y-2">
              {[
                'Quali configurazioni quantitative mostrano la massima coerenza multi-timeframe oggi?',
                'Ci sono anomalie di volatilità o alert di drawdown aperti sui miei strumenti?',
                'Spiega il regime direzionale e di volatilità di Bitcoin e Apple.',
              ].map((question, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => setIsAiDrawerOpen(true)}
                  className="w-full text-left rounded-xl border border-slate-200/80 bg-white/80 p-2.5 text-xs text-slate-700 transition hover:border-brand-500/50 hover:bg-white dark:border-navy-800 dark:bg-navy-850/80 dark:text-slate-300 dark:hover:bg-navy-800 flex items-center justify-between gap-2"
                >
                  <span className="truncate">{question}</span>
                  <ArrowUpRight className="h-3.5 w-3.5 shrink-0 text-brand-smart" />
                </button>
              ))}
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-slate-200/60 dark:border-navy-800/60 flex items-center justify-between text-[11px] text-slate-500">
            <span>Audit log completo e certificato</span>
            <button
              type="button"
              onClick={() => setIsAiDrawerOpen(true)}
              className="font-bold text-brand-smart hover:underline"
            >
              Apri Chat con Analista &rarr;
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
