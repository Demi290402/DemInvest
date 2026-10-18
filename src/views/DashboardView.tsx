import React from 'react';
import {
  Activity,
  AlertTriangle,
  ArrowRight,
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
import {
  formatFinancialCurrency,
  formatFinancialPercent,
  translateDataFreshness,
  translateMarketRegime,
  translateSignalClassification,
  translateSignalStatus,
} from '../lib/financialSemantics';

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

  // Eventi prioritari "Da tenere d'occhio" (max 3)
  const prioritySignals = activeSignals.slice(0, 2);
  const unreadAlerts = notifications.filter((n) => n.deliveryStatus !== 'READ');

  const openInstrumentDetail = (instId: string) => {
    setSelectedInstrumentId(instId);
    onNavigateTab('markets');
  };

  const displayName = user?.displayName?.split(' ')[0] || 'Investitore';

  return (
    <div className="space-y-6">
      {/* 1. Header sintetico ed elegante (Master Prompt 5, Sez. 8.2A) */}
      <div className="flex flex-col justify-between gap-4 border-b border-slate-200/80 pb-5 dark:border-navy-800/80 sm:flex-row sm:items-center">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-extrabold tracking-tight text-slate-900 dark:text-white sm:text-3xl">
              Panoramica
            </h1>
            <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-semibold text-slate-600 dark:bg-navy-850 dark:text-slate-300">
              Bentornato, {displayName}
            </span>
          </div>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            {uiMode === 'SIMPLE'
              ? 'Controllo strategico e decisioni disciplinate guidate da calcoli matematici verificabili.'
              : 'Cockpit analitico quantitativo con multi-timeframe consensus, deviazioni ATR e feed audit.'}
          </p>
        </div>

        {/* Azioni rapide di controllo */}
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => refreshMarketQuotes()}
            className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50 focus-ring dark:border-navy-700 dark:bg-navy-900 dark:text-slate-200 dark:hover:bg-navy-850"
            title="Aggiorna le quotazioni dei tuoi asset monitorati"
          >
            <RefreshCw className="h-3.5 w-3.5 text-teal-600 dark:text-teal-400" aria-hidden="true" />
            <span>Aggiorna dati</span>
          </button>

          <button
            type="button"
            onClick={() => triggerSchedulerNow()}
            data-testid="run-scheduler-btn"
            className="inline-flex items-center gap-1.5 rounded-xl border border-teal-500/30 bg-teal-500/10 px-3 py-2 text-xs font-semibold text-teal-700 transition hover:bg-teal-500/20 focus-ring dark:text-teal-300"
            title="Esegue un ciclo immediato di valutazione quantitativa del mercato"
          >
            <Zap className="h-3.5 w-3.5" aria-hidden="true" />
            <span>Scansione segnali</span>
          </button>

          <button
            type="button"
            onClick={() => setIsAiDrawerOpen(true)}
            data-testid="open-ai-assistant-btn"
            className="inline-flex items-center gap-1.5 rounded-xl bg-teal-600 px-3.5 py-2 text-xs font-bold text-white shadow-sm transition hover:bg-teal-500 focus-ring"
          >
            <Bot className="h-4 w-4" aria-hidden="true" />
            <span>Chiedi all'AI</span>
          </button>
        </div>
      </div>

      {/* 2. Sezione Portafoglio Snapshot & Valutazione (Master Prompt 5, Sez. 8.2B) */}
      <div className="rounded-2xl border border-slate-200/90 bg-white p-5 shadow-sm dark:border-navy-800/80 dark:bg-navy-900/90">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-3.5 dark:border-navy-800/60">
          <div className="flex items-center gap-2">
            <Wallet className="h-4 w-4 text-teal-600 dark:text-teal-400" />
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Il tuo Portafoglio
            </span>
          </div>

          <div className="flex items-center gap-2">
            {portfolioAnalytics && !portfolioAnalytics.isValuationComplete && (
              <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/15 px-2.5 py-0.5 text-[11px] font-bold text-amber-600 dark:text-amber-400">
                <AlertTriangle className="h-3 w-3" />
                Valutazione parziale ({portfolioAnalytics.incompletePositionsCount} senza prezzo)
              </span>
            )}
            <button
              type="button"
              onClick={() => onNavigateTab('portfolio')}
              className="text-xs font-semibold text-teal-600 hover:underline dark:text-teal-400"
            >
              Apri dettagli &rarr;
            </button>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <div className="text-xs text-slate-500 dark:text-slate-400">Controvalore Stimato</div>
            <div className="num-mono mt-1 text-2xl font-extrabold text-slate-900 dark:text-white">
              {portfolioAnalytics
                ? formatFinancialCurrency(portfolioAnalytics.totalPortfolioEquityInBase, portfolioAnalytics.baseCurrency)
                : 'Calcolo...'}
            </div>
            <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              Liquidità disponibile:{' '}
              <span className="font-semibold text-slate-700 dark:text-slate-300">
                {portfolioAnalytics ? formatFinancialCurrency(portfolioAnalytics.cashBalanceInBase, portfolioAnalytics.baseCurrency) : '—'}
              </span>
            </div>
          </div>

          <div>
            <div className="text-xs text-slate-500 dark:text-slate-400">Rendimento non realizzato</div>
            <div
              className={`num-mono mt-1 text-2xl font-extrabold ${
                (portfolioAnalytics?.unrealizedPnlInBase ?? 0) >= 0
                  ? 'text-emerald-600 dark:text-emerald-400'
                  : 'text-rose-600 dark:text-rose-400'
              }`}
            >
              {portfolioAnalytics
                ? `${formatFinancialCurrency(portfolioAnalytics.unrealizedPnlInBase, portfolioAnalytics.baseCurrency, { showPlus: true })} (${formatFinancialPercent(portfolioAnalytics.unrealizedPnlPct, { showPlus: true })})`
                : '—'}
            </div>
            <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              Costo base investito:{' '}
              {portfolioAnalytics ? formatFinancialCurrency(portfolioAnalytics.totalInvestedCostInBase, portfolioAnalytics.baseCurrency) : '—'}
            </div>
          </div>

          <div>
            <div className="text-xs text-slate-500 dark:text-slate-400">Concentrazione & Rischio (HHI)</div>
            <div className="mt-1 flex items-baseline gap-2">
              <span className="num-mono text-xl font-bold text-slate-900 dark:text-white">
                {portfolioAnalytics ? `${portfolioAnalytics.concentrationRisk.herfindahlIndex}/10000` : '—'}
              </span>
              <span className="text-xs font-semibold text-slate-500">
                (Top: {portfolioAnalytics?.concentrationRisk.topPositionWeightPct ?? 0}%)
              </span>
            </div>
            <div className="mt-1 text-xs font-medium text-slate-500 dark:text-slate-400">
              {portfolioAnalytics?.concentrationRisk.concentrationLevel === 'HIGH_CONCENTRATION_RISK'
                ? 'Elevata concentrazione su singolo asset'
                : portfolioAnalytics?.concentrationRisk.concentrationLevel === 'MODERATE'
                ? 'Concentrazione moderata'
                : 'Ben diversificato'}
            </div>
          </div>

          <div>
            <div className="text-xs text-slate-500 dark:text-slate-400">Opportunità e Avvisi</div>
            <div className="mt-1 flex items-baseline gap-2">
              <span className="num-mono text-xl font-bold text-slate-900 dark:text-white">
                {activeSignals.length} attivi
              </span>
              <span className="text-xs text-slate-500">
                / {alertRules.filter((r) => r.isActive).length} alert attivi
              </span>
            </div>
            <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              {unreadAlerts.length > 0 ? `${unreadAlerts.length} notifiche non lette` : 'Nessun alert critico recente'}
            </div>
          </div>
        </div>
      </div>

      {/* 3. "Da tenere d'occhio" — Eventi Prioritari Sintetici (Master Prompt 5, Sez. 8.2C) */}
      {(prioritySignals.length > 0 || unreadAlerts.length > 0) && (
        <div className="rounded-2xl border border-slate-200/90 bg-slate-50/70 p-5 dark:border-navy-800/80 dark:bg-navy-850/40">
          <div className="mb-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-amber-500" />
              <h2 className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-200">
                Da tenere d'occhio oggi
              </h2>
            </div>
            <span className="text-[11px] text-slate-500">Massimo 3 eventi prioritari</span>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {prioritySignals.map((sig) => {
              const cl = translateSignalClassification(sig.signalType);
              const st = translateSignalStatus(sig.status);
              return (
                <div
                  key={sig.id}
                  onClick={() => openInstrumentDetail(sig.instrumentId)}
                  className="cursor-pointer rounded-xl border border-slate-200 bg-white p-3.5 shadow-sm transition hover:border-teal-500/40 dark:border-navy-800 dark:bg-navy-900"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-extrabold text-slate-900 dark:text-white">{sig.instrumentTicker}</span>
                    <span className={`rounded-md px-2 py-0.5 text-[10px] font-bold ${cl.colorClass}`}>
                      {cl.shortLabel}
                    </span>
                  </div>
                  <p className="mt-1.5 text-xs text-slate-600 dark:text-slate-300 line-clamp-2">
                    {sig.quantitativeRationale}
                  </p>
                  <div className="mt-2.5 flex items-center justify-between text-[11px] text-slate-400 pt-2 border-t border-slate-100 dark:border-navy-800">
                    <span>Orizzonte: {sig.horizon}</span>
                    <span className="font-semibold text-teal-600 dark:text-teal-400">Verifica &rarr;</span>
                  </div>
                </div>
              );
            })}

            {unreadAlerts.slice(0, 1).map((notif) => (
              <div
                key={notif.id}
                onClick={() => onNavigateTab('notifications')}
                className="cursor-pointer rounded-xl border border-slate-200 bg-white p-3.5 shadow-sm transition hover:border-teal-500/40 dark:border-navy-800 dark:bg-navy-900"
              >
                <div className="flex items-center justify-between">
                  <span className="font-bold text-slate-900 dark:text-white">{notif.title}</span>
                  <span className="rounded-md bg-amber-500/15 px-2 py-0.5 text-[10px] font-bold text-amber-600 dark:text-amber-300">
                    Avviso
                  </span>
                </div>
                <p className="mt-1.5 text-xs text-slate-600 dark:text-slate-300 line-clamp-2">
                  {notif.body}
                </p>
                <div className="mt-2.5 flex items-center justify-between text-[11px] text-slate-400 pt-2 border-t border-slate-100 dark:border-navy-800">
                  <span>{notif.observedTimestamp ? notif.observedTimestamp.slice(11, 16) : ''} UTC</span>
                  <span className="font-semibold text-teal-600 dark:text-teal-400">Dettagli &rarr;</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 4. Watchlist Personale & Quotazioni Verificate (Master Prompt 5, Sez. 8.2D) */}
      <div className="rounded-2xl border border-slate-200/90 bg-white p-5 shadow-sm dark:border-navy-800/80 dark:bg-navy-900/90">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Star className="h-4 w-4 text-amber-400" aria-hidden="true" />
            <h2 className="text-sm font-bold text-slate-900 dark:text-white">
              Watchlist Personale & Quotazioni Verificate
            </h2>
          </div>
          <button
            type="button"
            onClick={() => onNavigateTab('markets')}
            className="text-xs font-semibold text-teal-600 hover:underline dark:text-teal-400"
          >
            Esplora tutti i mercati &rarr;
          </button>
        </div>

        {/* Modalità Semplice: visualizzazione a lista pulita */}
        {uiMode === 'SIMPLE' ? (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {watchlistInstruments.map((inst) => {
              const q = quotes[inst.id];
              const isValid = q && q.validity === 'VALID' && q.price > 0;
              const isPositive = (q?.changePct ?? 0) >= 0;
              const fresh = translateDataFreshness(q?.freshness);

              return (
                <div
                  key={inst.id}
                  onClick={() => openInstrumentDetail(inst.id)}
                  className="flex cursor-pointer flex-col justify-between rounded-xl border border-slate-200/80 bg-slate-50/70 p-4 transition hover:border-teal-500/40 hover:bg-slate-100/70 dark:border-navy-800/80 dark:bg-navy-850/70 dark:hover:border-teal-500/40"
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
                      {isValid ? formatFinancialCurrency(q.price, q.currency) : '—'}
                    </div>
                    {isValid && (
                      <span
                        className={`num-mono inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-xs font-bold ${
                          isPositive
                            ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400'
                            : 'bg-rose-500/15 text-rose-600 dark:text-rose-400'
                        }`}
                      >
                        {isPositive ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                        {formatFinancialPercent(q.changePct, { showPlus: true })}
                      </span>
                    )}
                  </div>

                  <div className="mt-2.5 flex items-center justify-between text-[11px] text-slate-500 pt-2 border-t border-slate-200/50 dark:border-navy-800/50">
                    <span className={`rounded px-1.5 py-0.2 text-[10px] font-medium ${fresh.badgeClass}`}>
                      {fresh.shortLabel}
                    </span>
                    <span className="font-semibold text-teal-600 dark:text-teal-400">Scheda &rarr;</span>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          /* Modalità PRO: Tabella dettagliata con numeri tabulari */
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-200 text-[11px] text-slate-500 dark:border-navy-800 dark:text-slate-400">
                  <th className="pb-3 font-semibold">Strumento</th>
                  <th className="pb-3 font-semibold">Classe & Mercato</th>
                  <th className="pb-3 text-right font-semibold">Ultimo Prezzo</th>
                  <th className="pb-3 text-right font-semibold">Variazione 24h</th>
                  <th className="pb-3 font-semibold">Fonte & Timestamp</th>
                  <th className="pb-3 text-right font-semibold">Dettaglio</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-navy-800/70">
                {watchlistInstruments.map((inst) => {
                  const q = quotes[inst.id];
                  const isValid = q && q.validity === 'VALID' && q.price > 0;
                  const isPositive = (q?.changePct ?? 0) >= 0;
                  const fresh = translateDataFreshness(q?.freshness);

                  return (
                    <tr
                      key={inst.id}
                      className="transition hover:bg-slate-50 dark:hover:bg-navy-850/60"
                    >
                      <td className="py-3 pr-4">
                        <div className="font-bold text-slate-900 dark:text-white">
                          {inst.ticker}
                        </div>
                        <div className="text-[11px] text-slate-500">{inst.name}</div>
                      </td>
                      <td className="py-3 pr-4">
                        <span className="rounded bg-slate-100 px-2 py-0.5 font-mono text-[10px] font-semibold text-slate-700 dark:bg-navy-800 dark:text-slate-300">
                          {inst.assetClass} • {inst.venueMic}
                        </span>
                      </td>
                      <td className="num-mono py-3 pr-4 text-right font-bold text-slate-900 dark:text-white">
                        {isValid ? formatFinancialCurrency(q.price, q.currency) : (
                          <span className="text-amber-500">Non disponibile</span>
                        )}
                      </td>
                      <td className="num-mono py-3 pr-4 text-right">
                        {isValid ? (
                          <span
                            className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 font-semibold ${
                              isPositive
                                ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400'
                                : 'bg-rose-500/15 text-rose-600 dark:text-rose-400'
                            }`}
                          >
                            {isPositive ? (
                              <TrendingUp className="h-3 w-3" />
                            ) : (
                              <TrendingDown className="h-3 w-3" />
                            )}
                            {formatFinancialPercent(q.changePct, { showPlus: true })}
                          </span>
                        ) : (
                          '—'
                        )}
                      </td>
                      <td className="py-3 pr-4">
                        {q ? (
                          <div>
                            <div className="flex items-center gap-1.5">
                              <span className={`rounded px-1.5 py-0.5 text-[10px] font-bold ${fresh.badgeClass}`}>
                                {fresh.shortLabel}
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
                          <span className="text-slate-500">In attesa...</span>
                        )}
                      </td>
                      <td className="py-3 text-right">
                        <button
                          type="button"
                          onClick={() => openInstrumentDetail(inst.id)}
                          className="rounded-lg bg-teal-500/10 px-3 py-1.5 text-xs font-semibold text-teal-600 transition hover:bg-teal-500 hover:text-white dark:text-teal-400 dark:hover:bg-teal-600 dark:hover:text-white focus-ring"
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

      {/* 5. Market Pulse — Stato Principali Borse & Sessioni di Mercato (Master Prompt 5, Sez. 8.2E) */}
      <div className="rounded-2xl border border-slate-200/90 bg-white p-5 shadow-sm dark:border-navy-800/80 dark:bg-navy-900/90">
        <div className="mb-3.5 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Globe className="h-4 w-4 text-teal-600 dark:text-teal-400" aria-hidden="true" />
            <h2 className="text-sm font-bold text-slate-900 dark:text-white">
              Stato Principali Borse & Sessioni di Mercato
            </h2>
          </div>
          <span className="text-[11px] text-slate-500 dark:text-slate-400">
            Fusi orari e festività sincronizzati
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
                    ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/25'
                    : 'bg-slate-200 text-slate-600 dark:bg-slate-800 dark:text-slate-400 border border-slate-300 dark:border-slate-700'
                }`}
              >
                <span
                  className={`h-1.5 w-1.5 rounded-full ${
                    v.isOpen ? 'bg-emerald-500 animate-pulse' : 'bg-slate-400'
                  }`}
                />
                {v.isOpen ? 'Aperto' : 'Chiuso'}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* 6. Assistente AI Contestuale — Spiegazioni e Domande Rapide (Master Prompt 5, Sez. 8.2F) */}
      <div className="rounded-2xl border border-teal-500/20 bg-gradient-to-br from-teal-500/5 via-transparent to-cyan-500/5 p-5 shadow-sm dark:border-navy-800/80 dark:bg-navy-900/90">
        <div className="flex items-center gap-2 mb-2">
          <Sparkles className="h-4 w-4 text-teal-600 dark:text-teal-400" aria-hidden="true" />
          <h2 className="text-sm font-bold text-slate-900 dark:text-white">
            Assistenza Intelligente DemInvest AI
          </h2>
        </div>
        <p className="text-xs leading-relaxed text-slate-600 dark:text-slate-300 max-w-3xl">
          Fai domande in linguaggio naturale: l'analista consulta unicamente i tool matematici verificati e i dati reali per chiarire scenari, rischi e indicatori.
        </p>

        <div className="mt-3.5 grid grid-cols-1 gap-2 sm:grid-cols-3">
          {[
            { q: 'Cosa sta succedendo sui mercati oggi?', icon: Compass },
            { q: 'Quali sono i rischi principali del mio portafoglio?', icon: Wallet },
            { q: 'Spiegami la configurazione attiva su Bitcoin e Apple', icon: Zap },
          ].map((item, idx) => {
            const Icon = item.icon;
            return (
              <button
                key={idx}
                type="button"
                onClick={() => setIsAiDrawerOpen(true)}
                className="flex items-center justify-between gap-2 rounded-xl border border-slate-200/90 bg-white p-3 text-left text-xs font-medium text-slate-700 shadow-sm transition hover:border-teal-500/50 hover:bg-slate-50 dark:border-navy-800 dark:bg-navy-850 dark:text-slate-200 dark:hover:bg-navy-800"
              >
                <div className="flex items-center gap-2">
                  <Icon className="h-3.5 w-3.5 text-teal-600 dark:text-teal-400 shrink-0" />
                  <span className="truncate">{item.q}</span>
                </div>
                <ArrowUpRight className="h-3.5 w-3.5 shrink-0 text-slate-400" />
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};
