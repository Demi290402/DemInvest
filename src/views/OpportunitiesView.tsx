import React, { useEffect, useState } from 'react';
import {
  Activity,
  AlertTriangle,
  Calculator,
  CheckCircle2,
  Filter,
  Radar,
  ShieldAlert,
  Sparkles,
  Zap,
} from 'lucide-react';
import { useDemInvest } from '../context/DemInvestContext';
import {
  AssetClass,
  DirectionalMarketRegime,
  PositionSimulationResult,
  TimeHorizon,
  VolatilityMarketRegime,
} from '../types/domain';
import {
  translateMarketRegime,
  translateVolatilityRegime,
  translateSignalClassification,
  translateSignalStatus,
  translateStrategyName,
} from '../lib/financialSemantics';

interface OpportunitiesViewProps {
  onOpenInstrument: (instrumentId: string) => void;
}

export const OpportunitiesView: React.FC<OpportunitiesViewProps> = ({
  onOpenInstrument,
}) => {
  const {
    uiMode,
    instruments,
    quotes,
    brokerMappings,
    watchlistInstrumentIds,
    generatedSignals,
    triggerSchedulerNow,
    latestMarketScan,
    isScanningMarket,
    runMarketIntelligenceScan,
    simulatePosition,
  } = useDemInvest();

  const [filterClass, setFilterClass] = useState<AssetClass | 'ALL'>('ALL');
  const [filterHorizon, setFilterHorizon] = useState<TimeHorizon | 'ALL'>('ALL');
  const [filterBroker, setFilterBroker] = useState<string>('ALL');
  const [filterFreshness, setFilterFreshness] = useState<string>('ALL');
  const [filterDirectionalRegime, setFilterDirectionalRegime] = useState<
    DirectionalMarketRegime | 'ALL'
  >('ALL');
  const [filterVolatilityRegime, setFilterVolatilityRegime] = useState<
    VolatilityMarketRegime | 'ALL'
  >('ALL');
  const [breakoutOnly, setBreakoutOnly] = useState(false);
  const [pullbackOnly, setPullbackOnly] = useState(false);
  const [onlyWatchlist, setOnlyWatchlist] = useState(false);
  const [hideNoTrade, setHideNoTrade] = useState(false);
  const [scanning, setScanning] = useState(false);

  // Interactive Position Simulator state
  const [simInstrumentId, setSimInstrumentId] = useState<string>('INST_BTC_USD_SPOT');
  const [simCapital, setSimCapital] = useState<string>('2500');
  const [simPortfolioTotal, setSimPortfolioTotal] = useState<string>('25000');
  const [simMaxRiskPct, setSimMaxRiskPct] = useState<string>('1.5');
  const [simEntryPrice, setSimEntryPrice] = useState<string>('85000');
  const [simInvalidationPrice, setSimInvalidationPrice] = useState<string>('81500');
  const [simTargetPrice, setSimTargetPrice] = useState<string>('92000');
  const [simResult, setSimResult] = useState<PositionSimulationResult | null>(null);
  const [simLoading, setSimLoading] = useState(false);

  useEffect(() => {
    if (!latestMarketScan && !isScanningMarket) {
      runMarketIntelligenceScan({
        horizon: filterHorizon === 'ALL' ? 'BREVE' : filterHorizon,
      });
    }
  }, [latestMarketScan, isScanningMarket, runMarketIntelligenceScan, filterHorizon]);

  const buildScanFilterParams = () => ({
    assetClasses: filterClass === 'ALL' ? undefined : [filterClass],
    horizon: filterHorizon === 'ALL' ? 'BREVE' : filterHorizon,
    brokers: filterBroker === 'ALL' ? undefined : [filterBroker],
    regimeFilter: filterDirectionalRegime,
    volatilityFilter: filterVolatilityRegime,
    breakoutOnly,
    pullbackOnly,
    onlyWatchlistOrPortfolio: onlyWatchlist,
  });

  const handleRunScan = async () => {
    setScanning(true);
    try {
      await Promise.all([
        triggerSchedulerNow(),
        runMarketIntelligenceScan(buildScanFilterParams()),
      ]);
    } finally {
      setScanning(false);
    }
  };

  const handleRunSmartScannerOnly = async () => {
    await runMarketIntelligenceScan(buildScanFilterParams());
  };

  const handleRunPositionSimulation = async (e: React.FormEvent) => {
    e.preventDefault();
    setSimLoading(true);
    try {
      const inst = instruments.find((i) => i.id === simInstrumentId);
      const res = await simulatePosition({
        instrumentId: simInstrumentId,
        capitalAllocatedInBase: Number(simCapital) || 1000,
        totalPortfolioEquityInBase: Number(simPortfolioTotal) || 10000,
        maxAcceptablePortfolioRiskPct: Number(simMaxRiskPct) || 1.5,
        entryPrice: Number(simEntryPrice) || 100,
        invalidationStopPrice: Number(simInvalidationPrice) || 95,
        targetPrices: [Number(simTargetPrice) || 110],
        spreadBps: inst?.assetClass === 'CRYPTO' ? 12 : 8,
        slippageBps: 5,
        commissionPct: 0.05,
        fxRateToBase: 1,
      });
      if (res) setSimResult(res);
    } finally {
      setSimLoading(false);
    }
  };

  // Filtra e ordina segnali per punteggio euristico (Opportunity Ranking trasparente)
  const filteredSignals = generatedSignals
    .filter((sig) => {
      const inst = instruments.find((i) => i.id === sig.instrumentId);
      if (!inst) return false;
      if (filterClass !== 'ALL' && inst.assetClass !== filterClass) return false;
      if (filterHorizon !== 'ALL' && sig.horizon !== filterHorizon) return false;
      if (filterFreshness !== 'ALL' && sig.quoteFreshness !== filterFreshness) return false;
      if (onlyWatchlist && !watchlistInstrumentIds.includes(inst.id)) return false;
      if (hideNoTrade && sig.signalType === 'NO_TRADE') return false;
      if (filterBroker !== 'ALL') {
        const hasMap = brokerMappings.some(
          (m) => m.instrumentId === inst.id && m.brokerCode === filterBroker
        );
        if (!hasMap) return false;
      }
      return true;
    })
    .sort((a, b) => b.heuristicScore - a.heuristicScore);

  // Screener su tutti gli strumenti con quotazione valida
  const screenerUniverse = instruments.filter((inst) => {
    if (filterClass !== 'ALL' && inst.assetClass !== filterClass) return false;
    if (onlyWatchlist && !watchlistInstrumentIds.includes(inst.id)) return false;
    return true;
  });

  return (
    <div className="space-y-6">
      {/* Intestazione e Filtri Screener Multiparametro */}
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-anthracite-850">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <Filter className="h-4 w-4 text-brand-500" />
              <h1 className="text-lg font-bold text-slate-900 dark:text-white">
                Market Screener & Opportunity Discovery
              </h1>
            </div>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              Ranking quantitativo trasparente basato su regole deterministiche. I punteggi euristici (0–100) misurano l'allineamento tecnico e NON rappresentano una probabilità di guadagno.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              disabled={isScanningMarket || scanning}
              onClick={handleRunSmartScannerOnly}
              data-testid="run-smart-scanner-btn"
              className="flex items-center gap-2 rounded-xl border border-brand-500/40 bg-brand-500/15 px-3.5 py-2.5 text-xs font-semibold text-brand-300 transition hover:bg-brand-500/25 disabled:opacity-50"
            >
              <Radar className="h-4 w-4" />
              {isScanningMarket ? 'Scansione V3...' : 'Esegui Smart Scanner V3'}
            </button>

            <button
              type="button"
              disabled={scanning}
              onClick={handleRunScan}
              data-testid="screener-scan-btn"
              className="flex items-center gap-2 rounded-xl bg-brand-500 px-4 py-2.5 text-xs font-semibold text-anthracite-950 transition hover:bg-brand-400 disabled:opacity-50"
            >
              <Zap className="h-4 w-4" />
              {scanning ? 'Valutazione Universo in corso...' : 'Valuta Universo & Aggiorna Segnali'}
            </button>
          </div>
        </div>

        {/* Griglia Filtri */}
        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-6">
          <div>
            <label className="mb-1 block text-[10px] font-bold uppercase text-slate-400">
              Asset Class
            </label>
            <select
              value={filterClass}
              onChange={(e) => setFilterClass(e.target.value as AssetClass | 'ALL')}
              className="w-full rounded-lg border border-slate-300 bg-slate-50 px-2.5 py-2 text-xs dark:border-slate-700 dark:bg-anthracite-900 dark:text-white"
            >
              <option value="ALL">Tutte le Asset Class</option>
              <option value="CRYPTO">Crypto Spot</option>
              <option value="EQUITY">Azioni</option>
              <option value="ETF">ETF</option>
              <option value="FOREX">Forex</option>
              <option value="BOND">Obbligazioni</option>
              <option value="COMMODITY">Materie Prime</option>
              <option value="DERIVATIVE">Derivati / CFD</option>
            </select>
          </div>

          <div>
            <label className="mb-1 block text-[10px] font-bold uppercase text-slate-400">
              Orizzonte Temporale
            </label>
            <select
              value={filterHorizon}
              onChange={(e) => setFilterHorizon(e.target.value as TimeHorizon | 'ALL')}
              className="w-full rounded-lg border border-slate-300 bg-slate-50 px-2.5 py-2 text-xs dark:border-slate-700 dark:bg-anthracite-900 dark:text-white"
            >
              <option value="ALL">Tutti gli Orizzonti</option>
              <option value="BREVISSIMO">BREVISSIMO (Intraday)</option>
              <option value="BREVE">BREVE (1–30g)</option>
              <option value="MEDIO">MEDIO (1–12m)</option>
              <option value="LUNGO">LUNGO (&gt;12m)</option>
            </select>
          </div>

          <div>
            <label className="mb-1 block text-[10px] font-bold uppercase text-slate-400">
              Piattaforma / Broker
            </label>
            <select
              value={filterBroker}
              onChange={(e) => setFilterBroker(e.target.value)}
              className="w-full rounded-lg border border-slate-300 bg-slate-50 px-2.5 py-2 text-xs dark:border-slate-700 dark:bg-anthracite-900 dark:text-white"
            >
              <option value="ALL">Qualsiasi Piattaforma</option>
              <option value="TRADE_REPUBLIC">Trade Republic</option>
              <option value="IBKR">Interactive Brokers</option>
              <option value="AVATRADE">AvaTrade</option>
              <option value="MT5">MetaTrader 5</option>
            </select>
          </div>

          <div>
            <label className="mb-1 block text-[10px] font-bold uppercase text-slate-400">
              Freschezza Dati
            </label>
            <select
              value={filterFreshness}
              onChange={(e) => setFilterFreshness(e.target.value)}
              className="w-full rounded-lg border border-slate-300 bg-slate-50 px-2.5 py-2 text-xs dark:border-slate-700 dark:bg-anthracite-900 dark:text-white"
            >
              <option value="ALL">Tutte (Realtime/Delayed/EOD)</option>
              <option value="REALTIME">Solo REALTIME</option>
              <option value="DELAYED">DELAYED</option>
              <option value="EOD">EOD (Fine Giornata)</option>
            </select>
          </div>

          <div className="flex items-end">
            <label className="flex w-full cursor-pointer items-center gap-2 rounded-lg border border-slate-300 bg-slate-50 px-3 py-2 text-xs dark:border-slate-700 dark:bg-anthracite-900">
              <input
                type="checkbox"
                checked={onlyWatchlist}
                onChange={(e) => setOnlyWatchlist(e.target.checked)}
                className="accent-brand-500"
              />
              <span>Solo Watchlist</span>
            </label>
          </div>

          <div className="flex items-end">
            <label className="flex w-full cursor-pointer items-center gap-2 rounded-lg border border-slate-300 bg-slate-50 px-3 py-2 text-xs dark:border-slate-700 dark:bg-anthracite-900">
              <input
                type="checkbox"
                checked={hideNoTrade}
                onChange={(e) => setHideNoTrade(e.target.checked)}
                className="accent-brand-500"
              />
              <span>Escludi NO_TRADE</span>
            </label>
          </div>
        </div>

        {/* Filtri Avanzati Smart Market Scanner V3 (Regime, Volatilità, Breakout/Pullback) */}
        <div className="mt-3 grid grid-cols-1 gap-3 border-t border-slate-200/70 pt-3 dark:border-slate-800 sm:grid-cols-4">
          <div>
            <label className="mb-1 block text-[10px] font-bold uppercase text-slate-400">
              Regime Direzionale V3
            </label>
            <select
              value={filterDirectionalRegime}
              onChange={(e) =>
                setFilterDirectionalRegime(e.target.value as DirectionalMarketRegime | 'ALL')
              }
              className="w-full rounded-lg border border-slate-300 bg-slate-50 px-2.5 py-1.5 text-xs dark:border-slate-700 dark:bg-anthracite-900 dark:text-white"
            >
              <option value="ALL">Tutti i Regimi Direzionali</option>
              <option value="BULLISH_TREND">BULLISH_TREND</option>
              <option value="BEARISH_TREND">BEARISH_TREND</option>
              <option value="SIDEWAYS">SIDEWAYS</option>
              <option value="UNCERTAIN">UNCERTAIN</option>
            </select>
          </div>

          <div>
            <label className="mb-1 block text-[10px] font-bold uppercase text-slate-400">
              Regime Volatilità V3
            </label>
            <select
              value={filterVolatilityRegime}
              onChange={(e) =>
                setFilterVolatilityRegime(e.target.value as VolatilityMarketRegime | 'ALL')
              }
              className="w-full rounded-lg border border-slate-300 bg-slate-50 px-2.5 py-1.5 text-xs dark:border-slate-700 dark:bg-anthracite-900 dark:text-white"
            >
              <option value="ALL">Tutti i Regimi Volatilità</option>
              <option value="LOW_VOLATILITY">LOW_VOLATILITY</option>
              <option value="NORMAL_VOLATILITY">NORMAL_VOLATILITY</option>
              <option value="HIGH_VOLATILITY">HIGH_VOLATILITY</option>
            </select>
          </div>

          <div className="flex items-end">
            <label className="flex w-full cursor-pointer items-center gap-2 rounded-lg border border-slate-300 bg-slate-50 px-3 py-1.5 text-xs dark:border-slate-700 dark:bg-anthracite-900">
              <input
                type="checkbox"
                checked={breakoutOnly}
                onChange={(e) => setBreakoutOnly(e.target.checked)}
                className="accent-brand-500"
              />
              <span>Solo Breakout Confermati</span>
            </label>
          </div>

          <div className="flex items-end">
            <label className="flex w-full cursor-pointer items-center gap-2 rounded-lg border border-slate-300 bg-slate-50 px-3 py-1.5 text-xs dark:border-slate-700 dark:bg-anthracite-900">
              <input
                type="checkbox"
                checked={pullbackOnly}
                onChange={(e) => setPullbackOnly(e.target.checked)}
                className="accent-brand-500"
              />
              <span>Solo Pullback in Trend</span>
            </label>
          </div>
        </div>
      </div>

      {/* Smart Market Scanner V3 & Multi-Factor Opportunity Ranking */}
      {latestMarketScan && (
        <div
          data-testid="smart-scanner-v3-panel"
          className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-anthracite-850"
        >
          <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Activity className="h-4 w-4 text-brand-400" />
              <h2 className="text-sm font-bold uppercase tracking-wider text-slate-700 dark:text-slate-200">
                Smart Market Scanner V3 — Ranking Multifattoriale (
                {latestMarketScan.topRankedOpportunities.length} Opportunità /{' '}
                {latestMarketScan.analyzedCount} Analizzati / {latestMarketScan.excludedCount}{' '}
                Esclusi)
              </h2>
            </div>
            <span className="font-mono text-[11px] text-slate-500">
              Run: {latestMarketScan.runId} • Copertura: {latestMarketScan.coveragePct}%
            </span>
          </div>

          <div className="space-y-3">
            {latestMarketScan.topRankedOpportunities.map((item) => (
              <div
                key={item.instrumentId}
                data-testid={`opportunity-ranking-card-${item.instrumentId}`}
                className="rounded-xl border border-slate-200 bg-slate-50 p-4 transition dark:border-slate-800 dark:bg-anthracite-900"
              >
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded bg-brand-500/20 px-2 py-0.5 font-mono text-xs font-bold text-brand-600 dark:text-brand-400">
                      #{item.rank}
                    </span>
                    <span className="text-sm font-bold text-slate-900 dark:text-white">
                      {item.instrumentName} ({item.instrumentTicker})
                    </span>
                    <span className="rounded-full bg-emerald-500/15 px-2.5 py-0.5 text-[11px] font-bold text-emerald-600 dark:text-emerald-400">
                      {uiMode === 'SIMPLE'
                        ? translateSignalClassification(item.signalClassification).shortLabel
                        : item.signalClassification}
                    </span>
                    <span className="rounded bg-slate-200 px-2 py-0.5 text-[10px] font-semibold text-slate-800 dark:bg-slate-800 dark:text-slate-200">
                      {translateStrategyName(item.strategyId).name}
                    </span>
                    <span className="rounded bg-slate-200 px-2 py-0.5 text-[10px] text-slate-700 dark:bg-slate-800 dark:text-slate-300">
                      {uiMode === 'SIMPLE'
                        ? `${translateMarketRegime(item.directionalRegime).shortLabel} • ${translateVolatilityRegime(item.volatilityRegime).label}`
                        : `${item.directionalRegime} • ${item.volatilityRegime}`}
                    </span>
                  </div>

                  <div className="flex items-center gap-3">
                    <div className="text-right">
                      <div className="num-mono text-sm font-bold text-brand-600 dark:text-brand-400">
                        Score: {item.compositeScore}/100
                      </div>
                      <div className="text-[10px] text-slate-500 dark:text-slate-400">
                        Dati: {item.dataCompletenessScore}% • Rischio: {item.riskBand}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => onOpenInstrument(item.instrumentId)}
                      className="rounded-lg bg-brand-500 px-3.5 py-1.5 text-xs font-semibold text-anthracite-950 transition hover:bg-brand-400"
                    >
                      Analizza
                    </button>
                  </div>
                </div>

                {item.sellDistinction !== 'NOT_APPLICABLE' && (
                  <div className="mt-2 rounded border border-amber-500/30 bg-amber-500/10 px-2.5 py-1 text-[11px] font-semibold text-amber-700 dark:text-amber-300">
                    Distinzione: {item.sellDistinction === 'EXISTING_POSITION_EXIT'
                      ? 'Uscita da Posizione in Portafoglio'
                      : 'Segnale Tecnico Ribassista di Mercato (Non Short)'}
                  </div>
                )}

                <div className="mt-2.5 grid grid-cols-1 gap-2 border-t border-slate-200/80 pt-2.5 text-[11px] dark:border-slate-800 sm:grid-cols-3">
                  <div className="num-mono text-slate-700 dark:text-slate-300">
                    <strong className="text-slate-500 dark:text-slate-400">Livelli Operativi:</strong> Prezzo{' '}
                    {item.observedPrice} {item.currency} | Inv:{' '}
                    {item.invalidationPrice ?? 'N/D'} | Target:{' '}
                    {item.targetLevels.map((t) => t.price).join(' → ') || 'N/D'}
                  </div>
                  <div className="text-slate-600 dark:text-slate-400">
                    <strong className="text-emerald-600 dark:text-emerald-400">Fattori a Favore:</strong>{' '}
                    {item.positiveDrivers.slice(0, 2).join(' • ')}
                  </div>
                  <div className="text-slate-600 dark:text-slate-400">
                    <strong className="text-rose-600 dark:text-rose-400">Elementi di Rischio:</strong>{' '}
                    {item.negativeRiskFactors[0] || 'Rischio di mercato standard'}
                  </div>
                </div>
              </div>
            ))}
          </div>

          {latestMarketScan.excludedInstruments.length > 0 && (
            <div className="mt-4 rounded-xl border border-amber-500/30 bg-amber-500/5 p-3.5 text-xs">
              <div className="font-bold text-amber-700 dark:text-amber-400">
                Strumenti con dati non sufficienti per lo screening ({latestMarketScan.excludedInstruments.length}):
              </div>
              <div className="mt-2 grid grid-cols-1 gap-1.5 sm:grid-cols-2">
                {latestMarketScan.excludedInstruments.map((ex) => (
                  <div
                    key={ex.instrumentId}
                    className="flex items-center justify-between rounded-lg border border-amber-500/20 bg-white px-2.5 py-1.5 text-[11px] shadow-sm dark:bg-anthracite-900"
                  >
                    <span className="font-bold text-slate-900 dark:text-white">
                      {ex.ticker} — {ex.name}
                    </span>
                    <span className="text-amber-700 dark:text-amber-300">
                      {ex.detail}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Simulatore Interattivo di Posizione e Rischio (Sezione 10 Prompt 3) */}
      <div
        data-testid="position-simulator-card"
        className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-anthracite-850"
      >
        <div className="mb-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Calculator className="h-4 w-4 text-brand-400" />
            <h2 className="text-sm font-bold uppercase tracking-wider text-slate-700 dark:text-slate-200">
              Simulatore Interattivo di Posizione, Sizing & Rischio (Risk Intelligence V3)
            </h2>
          </div>
          <span className="text-[11px] text-slate-500">
            Calcolo deterministico comprensivo di spread, slippage e commissioni
          </span>
        </div>

        <form
          onSubmit={handleRunPositionSimulation}
          className="grid grid-cols-1 gap-3 sm:grid-cols-4 lg:grid-cols-7"
        >
          <div className="sm:col-span-2">
            <label className="mb-1 block text-[10px] font-bold uppercase text-slate-400">
              Strumento
            </label>
            <select
              value={simInstrumentId}
              onChange={(e) => setSimInstrumentId(e.target.value)}
              data-testid="sim-instrument-select"
              className="w-full rounded-lg border border-slate-300 bg-slate-50 px-2.5 py-1.5 text-xs dark:border-slate-700 dark:bg-anthracite-900 dark:text-white"
            >
              {instruments.map((inst) => (
                <option key={inst.id} value={inst.id}>
                  {inst.ticker} — {inst.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-1 block text-[10px] font-bold uppercase text-slate-400">
              Capitale Posizione
            </label>
            <input
              type="number"
              step="any"
              value={simCapital}
              onChange={(e) => setSimCapital(e.target.value)}
              data-testid="sim-capital-input"
              className="w-full rounded-lg border border-slate-300 bg-slate-50 px-2.5 py-1.5 text-xs dark:border-slate-700 dark:bg-anthracite-900 dark:text-white"
            />
          </div>

          <div>
            <label className="mb-1 block text-[10px] font-bold uppercase text-slate-400">
              Portafoglio Totale
            </label>
            <input
              type="number"
              step="any"
              value={simPortfolioTotal}
              onChange={(e) => setSimPortfolioTotal(e.target.value)}
              className="w-full rounded-lg border border-slate-300 bg-slate-50 px-2.5 py-1.5 text-xs dark:border-slate-700 dark:bg-anthracite-900 dark:text-white"
            />
          </div>

          <div>
            <label className="mb-1 block text-[10px] font-bold uppercase text-slate-400">
              Prezzo Ingresso
            </label>
            <input
              type="number"
              step="any"
              value={simEntryPrice}
              onChange={(e) => setSimEntryPrice(e.target.value)}
              data-testid="sim-entry-input"
              className="w-full rounded-lg border border-slate-300 bg-slate-50 px-2.5 py-1.5 text-xs dark:border-slate-700 dark:bg-anthracite-900 dark:text-white"
            />
          </div>

          <div>
            <label className="mb-1 block text-[10px] font-bold uppercase text-slate-400">
              Stop Invalidazione
            </label>
            <input
              type="number"
              step="any"
              value={simInvalidationPrice}
              onChange={(e) => setSimInvalidationPrice(e.target.value)}
              data-testid="sim-stop-input"
              className="w-full rounded-lg border border-slate-300 bg-slate-50 px-2.5 py-1.5 text-xs dark:border-slate-700 dark:bg-anthracite-900 dark:text-white"
            />
          </div>

          <div>
            <label className="mb-1 block text-[10px] font-bold uppercase text-slate-400">
              Target Prezzo
            </label>
            <div className="flex gap-1.5">
              <input
                type="number"
                step="any"
                value={simTargetPrice}
                onChange={(e) => setSimTargetPrice(e.target.value)}
                data-testid="sim-target-input"
                className="w-full rounded-lg border border-slate-300 bg-slate-50 px-2 py-1.5 text-xs dark:border-slate-700 dark:bg-anthracite-900 dark:text-white"
              />
              <button
                type="submit"
                disabled={simLoading}
                data-testid="run-position-simulation-btn"
                className="shrink-0 rounded-lg bg-brand-500 px-3 py-1.5 text-xs font-semibold text-anthracite-950 hover:bg-brand-400"
              >
                Simula
              </button>
            </div>
          </div>
        </form>

        {simResult && (
          <div
            data-testid="position-simulation-result"
            className="mt-4 grid grid-cols-1 gap-3 rounded-xl border border-slate-200 bg-slate-50 p-4 text-xs dark:border-slate-800 dark:bg-anthracite-900 sm:grid-cols-4"
          >
            <div>
              <div className="text-[10px] uppercase font-bold text-slate-500 dark:text-slate-400">Unità & Costi Roundtrip</div>
              <div className="num-mono mt-1 font-bold text-slate-900 dark:text-white">
                {simResult.positionUnits} unità ({simResult.grossExposureInBase} EUR)
              </div>
              <div className="mt-0.5 text-[11px] text-slate-500 dark:text-slate-400">
                Costi (Spread+Slip+Comm): {simResult.totalRoundtripCostsInBase} EUR
              </div>
            </div>

            <div>
              <div className="text-[10px] uppercase font-bold text-slate-500 dark:text-slate-400">
                Perdita Max a Invalidazione
              </div>
              <div className="num-mono mt-1 font-bold text-rose-600 dark:text-red-400">
                -{simResult.maxLossAtInvalidationInBase} EUR (
                {simResult.portfolioCapitalAtRiskPct}% del Portafoglio)
              </div>
              <div className="mt-0.5 text-[11px] text-slate-500 dark:text-slate-400">
                Impatto su posizione: {simResult.maxLossPctOfPosition}%
              </div>
            </div>

            <div>
              <div className="text-[10px] uppercase font-bold text-slate-500 dark:text-slate-400">
                Profitto Netto & R/R Target
              </div>
              <div className="num-mono mt-1 font-bold text-emerald-600 dark:text-emerald-400">
                +{simResult.targetsSimulation[0]?.netProfitInBase ?? 0} EUR | R/R Netto:{' '}
                {simResult.targetsSimulation[0]?.riskRewardRatio ?? 'N/D'}:1
              </div>
              <div className="mt-0.5 text-[11px] text-slate-500 dark:text-slate-400">
                Rendimento Netto Target: {simResult.targetsSimulation[0]?.netReturnPct ?? 0}%
              </div>
            </div>

            <div>
              <div className="text-[10px] uppercase font-bold text-slate-500 dark:text-slate-400">
                Sizing Consigliato ({simMaxRiskPct}%)
              </div>
              <div className="num-mono mt-1 font-bold text-brand-600 dark:text-brand-400">
                Max Capitale: {simResult.recommendedMaxCapitalInBase} EUR (
                {simResult.recommendedMaxPositionUnits} unità)
              </div>
              <div className="mt-0.5 text-[11px]">
                {!simResult.exceedsMaxRiskThreshold ? (
                  <span className="text-emerald-600 dark:text-emerald-400 font-medium">Entro il budget di rischio</span>
                ) : (
                  <span className="text-amber-600 dark:text-amber-400 font-medium">
                    Eccede il rischio max ({simResult.warnings[0]})
                  </span>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Opportunity Ranking & Storico Segnali Deterministici */}
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-anthracite-850">
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-brand-400" />
            <h2 className="text-sm font-bold uppercase tracking-wider text-slate-700 dark:text-slate-200">
              Opportunity Ranking & Registro Segnali ({filteredSignals.length})
            </h2>
          </div>
          <span className="text-[11px] text-slate-500">
            Ordinato per Punteggio Euristico Multifattoriale (0–100)
          </span>
        </div>

        {filteredSignals.length === 0 ? (
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-6 text-center text-xs text-slate-500 dark:border-slate-800 dark:bg-anthracite-900">
            Nessun segnale presente con i filtri selezionati. Premi <strong>"Valuta Universo & Aggiorna Segnali"</strong> per eseguire il motore deterministico sugli strumenti monitorati.
          </div>
        ) : (
          <div className="space-y-4">
            {filteredSignals.map((sig) => (
              <div
                key={sig.id}
                className="rounded-xl border border-slate-200 bg-slate-50 p-4 transition dark:border-slate-800 dark:bg-anthracite-900"
              >
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-bold text-slate-900 dark:text-white">
                      {sig.instrumentName} ({sig.instrumentTicker})
                    </span>
                    <span
                      className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${
                        sig.signalType === 'BUY_SETUP' || sig.signalType === 'BREAKOUT_ALERT'
                          ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400'
                          : sig.signalType === 'NO_TRADE'
                            ? 'bg-slate-500/15 text-slate-600 dark:text-slate-300'
                            : 'bg-amber-500/15 text-amber-600 dark:text-amber-400'
                      }`}
                    >
                      {uiMode === 'SIMPLE'
                        ? translateSignalClassification(sig.signalType).shortLabel
                        : sig.signalType}
                    </span>
                    <span className="rounded bg-slate-200 px-2 py-0.5 text-[11px] font-semibold text-slate-800 dark:bg-slate-800 dark:text-slate-200">
                      Stato: {translateSignalStatus(sig.status).label}
                    </span>
                    <span className="rounded bg-brand-500/10 px-2 py-0.5 text-[11px] font-semibold text-brand-700 dark:text-brand-400">
                      Orizzonte: {sig.horizon} ({sig.timeframe})
                    </span>
                  </div>

                  <div className="flex items-center gap-3">
                    <div className="text-right">
                      <div className="num-mono text-sm font-bold text-brand-600 dark:text-brand-400">
                        Score Euristico: {sig.heuristicScore}/100
                      </div>
                      <div className="text-[10px] text-slate-500 dark:text-slate-400">
                        Trend {sig.scoreBreakdown.trendScore} • Mom{' '}
                        {sig.scoreBreakdown.momentumScore} • Vol{' '}
                        {sig.scoreBreakdown.volatilityRiskScore} • Dati{' '}
                        {sig.scoreBreakdown.dataQualityScore}
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => onOpenInstrument(sig.instrumentId)}
                      className="rounded-lg bg-brand-500 px-3 py-1.5 text-xs font-semibold text-anthracite-950 transition hover:bg-brand-400"
                    >
                      Apri Grafico
                    </button>
                  </div>
                </div>

                <p className="mt-2.5 text-xs leading-relaxed text-slate-700 dark:text-slate-300">
                  {sig.quantitativeRationale}
                </p>

                <div className="mt-3 grid grid-cols-1 gap-3 border-t border-slate-200/80 pt-3 text-[11px] dark:border-slate-800 sm:grid-cols-3">
                  <div>
                    <div className="font-semibold text-emerald-600 dark:text-emerald-400">Condizioni Soddisfatte:</div>
                    {sig.conditionsMet.map((c, idx) => (
                      <div key={idx} className="mt-0.5 flex items-start gap-1 text-slate-600 dark:text-slate-400">
                        <CheckCircle2 className="mt-0.5 h-3 w-3 shrink-0 text-emerald-500 dark:text-emerald-400" />
                        <span>{c}</span>
                      </div>
                    ))}
                  </div>

                  <div>
                    <div className="font-semibold text-amber-600 dark:text-amber-400">
                      Condizioni Non Soddisfatte / Filtri:
                    </div>
                    {sig.conditionsUnmet.length === 0 ? (
                      <div className="mt-0.5 text-slate-500 dark:text-slate-400">Tutte le condizioni primarie verificate.</div>
                    ) : (
                      sig.conditionsUnmet.map((u, idx) => (
                        <div key={idx} className="mt-0.5 flex items-start gap-1 text-slate-600 dark:text-slate-400">
                          <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0 text-amber-500 dark:text-amber-400" />
                          <span>{u}</span>
                        </div>
                      ))
                    )}
                  </div>

                  <div>
                    <div className="font-semibold text-rose-600 dark:text-red-400">Livelli & Rischi:</div>
                    <div className="num-mono mt-0.5 text-slate-700 dark:text-slate-300">
                      Prezzo: {sig.observedPrice} {sig.currency} | Invalidazione:{' '}
                      {sig.invalidationLevel ?? 'N/D'}
                    </div>
                    {sig.keyRisks.map((r, idx) => (
                      <div key={idx} className="mt-0.5 flex items-start gap-1 text-slate-600 dark:text-slate-400">
                        <ShieldAlert className="mt-0.5 h-3 w-3 shrink-0 text-rose-500 dark:text-red-400" />
                        <span>{r}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Tabella Copertura Universo Screener */}
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-anthracite-850">
        <h3 className="mb-3 text-sm font-bold uppercase tracking-wider text-slate-700 dark:text-slate-200">
          Copertura Universo Strumenti & Stato Qualità Dati ({screenerUniverse.length})
        </h3>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-slate-200 text-[11px] uppercase text-slate-500 dark:border-slate-800">
                <th className="pb-2.5">Strumento</th>
                <th className="pb-2.5">Tipo / Venue</th>
                <th className="pb-2.5 text-right">Prezzo</th>
                <th className="pb-2.5 text-right">Var. 24h</th>
                <th className="pb-2.5">Liquidità</th>
                <th className="pb-2.5">Qualità & Copertura Dato</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/70">
              {screenerUniverse.map((inst) => {
                const q = quotes[inst.id];
                const isValid = q && q.validity === 'VALID' && q.price > 0;
                return (
                  <tr key={inst.id}>
                    <td className="py-2.5 font-bold text-slate-900 dark:text-white">
                      {inst.ticker} — <span className="font-normal text-slate-400">{inst.name}</span>
                    </td>
                    <td className="py-2.5 font-mono text-[11px]">
                      {inst.instrumentType} ({inst.venueMic})
                    </td>
                    <td className="num-mono py-2.5 text-right font-semibold">
                      {isValid ? `${q.price} ${q.currency}` : 'Sospeso'}
                    </td>
                    <td className="num-mono py-2.5 text-right">
                      {isValid ? `${q.changePct >= 0 ? '+' : ''}${q.changePct.toFixed(2)}%` : '—'}
                    </td>
                    <td className="py-2.5">
                      <span className="rounded bg-slate-100 px-2 py-0.5 text-[10px] font-bold dark:bg-slate-800">
                        {inst.liquidityTier}
                      </span>
                    </td>
                    <td className="py-2.5 text-[11px]">
                      {isValid ? (
                        <span className="text-emerald-400">
                          Idoneo allo Screening ({q.providerName} • {q.freshness})
                        </span>
                      ) : (
                        <span className="text-amber-400">
                          Escluso dallo Screening Live (Richiede API Key {inst.primaryProviderId})
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

