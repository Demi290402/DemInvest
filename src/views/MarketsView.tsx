import React, { useCallback, useEffect, useState } from 'react';
import {
  AlertTriangle,
  Bot,
  CheckCircle2,
  FileSpreadsheet,
  Info,
  Layers,
  Plus,
  Search,
  ShieldAlert,
  Star,
  TrendingDown,
  TrendingUp,
} from 'lucide-react';
import { useDemInvest } from '../context/DemInvestContext';
import {
  AnalyzedInstrumentIntelligenceItem,
  AssetClass,
  CandleTimeframe,
  GeneratedSignal,
  HistoricalCandle,
  MarketQuote,
  QuantitativeIndicatorsSnapshot,
  TimeHorizon,
} from '../types/domain';
import { DEFAULT_TIME_HORIZON_CONFIGS } from '../engines/signalIntelligenceEngine';
import { detectMarketRegime } from '../engines/marketIntelligenceEngine';
import { TradingViewChart } from '../components/TradingViewChart';

export const MarketsView: React.FC = () => {
  const {
    uiMode,
    theme,
    dataExecutionMode,
    instruments,
    assets,
    brokerMappings,
    selectedInstrumentId,
    setSelectedInstrumentId,
    selectedBrokerCode,
    setSelectedBrokerCode,
    activeHorizon,
    setActiveHorizon,
    watchlistInstrumentIds,
    toggleWatchlist,
    setIsAiDrawerOpen,
    createAlertRule,
    importBrokerMappingsCsv,
    confirmBrokerMappingManually,
    registerCoinGeckoAsset,
  } = useDemInvest();

  const [selectedCategory, setSelectedCategory] = useState<AssetClass | 'ALL'>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [externalMatches, setExternalMatches] = useState<
    Array<{ coingeckoId: string; symbol: string; name: string; marketCapRank: number | null }>
  >([]);
  const [timeframe, setTimeframe] = useState<CandleTimeframe>('1d');

  const [detailQuote, setDetailQuote] = useState<MarketQuote | null>(null);
  const [detailCandles, setDetailCandles] = useState<HistoricalCandle[]>([]);
  const [detailIndicators, setDetailIndicators] =
    useState<QuantitativeIndicatorsSnapshot | null>(null);
  const [detailSignal, setDetailSignal] = useState<GeneratedSignal | null>(null);
  const [detailIntelligence, setDetailIntelligence] =
    useState<AnalyzedInstrumentIntelligenceItem | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);

  // Alert quick creation state
  const [alertThreshold, setAlertThreshold] = useState('');
  const [alertFeedback, setAlertFeedback] = useState<string | null>(null);

  // CSV Broker import state
  const [showBrokerCsvModal, setShowBrokerCsvModal] = useState(false);
  const [csvInputText, setCsvInputText] = useState(
    'broker_code,broker_symbol,instrument_id,description,contract_type,currency,contract_size,tick_size,spread_bps\nMT5,BTCUSD.ecn,INST_BTC_USD_SPOT,Bitcoin vs USD ECN Server,CFD,USD,1,0.01,18'
  );
  const [csvFeedback, setCsvFeedback] = useState<string | null>(null);

  // Manual broker confirmation state
  const [manualBrokerSymbol, setManualBrokerSymbol] = useState('');
  const [manualContractType, setManualContractType] = useState<'SPOT' | 'CASH_SHARE' | 'ETF_SHARE' | 'CFD'>('SPOT');

  const currentInstrument =
    instruments.find((i) => i.id === selectedInstrumentId) || instruments[0];
  const currentUnderlying = assets.find(
    (a) => a.id === currentInstrument?.underlyingAssetId
  );

  const loadInstrumentAnalysis = useCallback(async () => {
    if (!currentInstrument) return;
    setLoadingDetail(true);
    try {
      const url = `/api/market/instrument-analysis?instrumentId=${encodeURIComponent(
        currentInstrument.id
      )}&timeframe=${timeframe}&horizon=${activeHorizon}&brokerCode=${selectedBrokerCode}&mode=${dataExecutionMode}`;
      const intelUrl = `/api/intelligence/analyze-instrument?instrumentId=${encodeURIComponent(
        currentInstrument.id
      )}&timeframe=${timeframe}&horizon=${activeHorizon}&mode=${dataExecutionMode}`;
      const [res, intelRes] = await Promise.all([fetch(url), fetch(intelUrl)]);
      if (res.ok) {
        const data = await res.json();
        setDetailQuote(data.quote);
        setDetailCandles(data.candles || []);
        setDetailIndicators(data.indicators);
        setDetailSignal(data.signalEvaluation);
      }
      if (intelRes.ok) {
        const intelData = await intelRes.json();
        setDetailIntelligence(intelData.intelligence || intelData.analysis || null);
      }
    } finally {
      setLoadingDetail(false);
    }
  }, [currentInstrument, timeframe, activeHorizon, selectedBrokerCode, dataExecutionMode]);

  useEffect(() => {
    loadInstrumentAnalysis();
  }, [loadInstrumentAnalysis]);

  const handleSearch = async (q: string) => {
    setSearchQuery(q);
    if (q.trim().length < 2) {
      setExternalMatches([]);
      return;
    }
    try {
      const res = await fetch(`/api/market/search?q=${encodeURIComponent(q)}`);
      if (res.ok) {
        const data = await res.json();
        setExternalMatches(data.externalCoinGeckoMatches || []);
      }
    } catch {
      setExternalMatches([]);
    }
  };

  const filteredInstruments = instruments.filter((inst) => {
    if (selectedCategory !== 'ALL' && inst.assetClass !== selectedCategory) return false;
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      inst.ticker.toLowerCase().includes(q) ||
      inst.name.toLowerCase().includes(q) ||
      (inst.isin && inst.isin.toLowerCase().includes(q)) ||
      (inst.coingeckoId && inst.coingeckoId.toLowerCase().includes(q))
    );
  });

  const instrumentBrokerMappings = brokerMappings.filter(
    (m) => m.instrumentId === currentInstrument?.id
  );
  const selectedBrokerMapping = instrumentBrokerMappings.find(
    (m) => m.brokerCode === selectedBrokerCode
  );

  const horizonSpec = DEFAULT_TIME_HORIZON_CONFIGS[activeHorizon];

  const handleQuickAlertCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    const val = Number(alertThreshold);
    if (!Number.isFinite(val) || val <= 0 || !currentInstrument) return;
    const currentPx = detailQuote?.price || 0;
    const ruleType = val >= currentPx ? 'PRICE_ABOVE' : 'PRICE_BELOW';
    await createAlertRule({
      instrumentId: currentInstrument.id,
      brokerCode: selectedBrokerCode,
      ruleType,
      horizon: activeHorizon,
      thresholdValue: val,
      priority: 'HIGH',
      cooldownMinutes: 60,
    });
    setAlertThreshold('');
    setAlertFeedback(`Alert ${ruleType} a ${val} ${currentInstrument.quoteCurrency} registrato.`);
    setTimeout(() => setAlertFeedback(null), 4000);
  };

  const handleBrokerCsvImport = async (e: React.FormEvent) => {
    e.preventDefault();
    const res = await importBrokerMappingsCsv(csvInputText);
    if (res.errors.length > 0) {
      setCsvFeedback(`Importati: ${res.importedCount}. Errori: ${res.errors.join('; ')}`);
    } else {
      setCsvFeedback(`Importati con successo ${res.importedCount} simboli broker (USER_CONFIRMED).`);
    }
  };

  const handleManualBrokerConfirm = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualBrokerSymbol.trim() || !currentInstrument) return;
    await confirmBrokerMappingManually({
      instrumentId: currentInstrument.id,
      brokerCode: selectedBrokerCode,
      brokerName: selectedBrokerCode,
      brokerSymbol: manualBrokerSymbol.trim(),
      brokerInstrumentName: `${currentInstrument.name} (${manualBrokerSymbol.trim()})`,
      contractType: manualContractType,
      currency: currentInstrument.quoteCurrency,
    });
    setManualBrokerSymbol('');
  };

  const categories: Array<{ id: AssetClass | 'ALL'; label: string }> = [
    { id: 'ALL', label: 'Tutti' },
    { id: 'CRYPTO', label: 'Crypto' },
    { id: 'EQUITY', label: 'Azioni' },
    { id: 'ETF', label: 'ETF' },
    { id: 'FOREX', label: 'Forex' },
    { id: 'BOND', label: 'Obbligazioni' },
    { id: 'COMMODITY', label: 'Materie Prime' },
    { id: 'DERIVATIVE', label: 'Derivati / CFD' },
  ];

  return (
    <div className="space-y-6">
      {/* Barra Ricerca, Categorie Asset, Orizzonte e Broker */}
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-anthracite-850">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          {/* Categorie */}
          <div className="flex flex-wrap gap-1.5">
            {categories.map((cat) => (
              <button
                key={cat.id}
                type="button"
                onClick={() => setSelectedCategory(cat.id)}
                className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                  selectedCategory === cat.id
                    ? 'bg-brand-500 text-anthracite-950'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-anthracite-900 dark:text-slate-300'
                }`}
              >
                {cat.label}
              </button>
            ))}
          </div>

          {/* Ricerca per Ticker, ISIN o CoinGecko ID */}
          <div className="relative w-full lg:w-80">
            <Search className=" absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => handleSearch(e.target.value)}
              placeholder="Cerca Ticker, ISIN (es. US0378331005) o CoinGecko ID..."
              data-testid="market-search-input"
              className="w-full rounded-xl border border-slate-300 bg-slate-50 pl-9 pr-3 py-2 text-xs focus:border-brand-500 focus:outline-none dark:border-slate-700 dark:bg-anthracite-900 dark:text-white"
            />
          </div>
        </div>

        {/* Risultati dinamici dal catalogo CoinGecko esterno */}
        {externalMatches.length > 0 && (
          <div className="mt-3 rounded-xl border border-brand-500/30 bg-brand-500/5 p-3">
            <div className="mb-2 text-[11px] font-semibold text-brand-400">
              Risultati trovati su CoinGecko API v3 (Registra nel Catalogo Universale con ID verificato):
            </div>
            <div className="flex flex-wrap gap-2">
              {externalMatches.map((ext) => (
                <button
                  key={ext.coingeckoId}
                  type="button"
                  onClick={async () => {
                    const newInst = await registerCoinGeckoAsset(ext);
                    if (newInst) {
                      setSelectedInstrumentId(newInst.id);
                      setExternalMatches([]);
                      setSearchQuery('');
                    }
                  }}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-brand-500/40 bg-anthracite-900 px-2.5 py-1 text-xs text-slate-200 hover:bg-brand-500 hover:text-anthracite-950"
                >
                  <Plus className="h-3.5 w-3.5" />
                  <span>
                    {ext.name} ({ext.symbol})
                  </span>
                  <span className="font-mono text-[10px] opacity-75">[{ext.coingeckoId}]</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Elenco Strumenti Selezionabili */}
        <div className="mt-4 flex gap-2 overflow-x-auto pb-2">
          {filteredInstruments.map((inst) => {
            const isSelected = inst.id === currentInstrument?.id;
            return (
              <button
                key={inst.id}
                type="button"
                onClick={() => setSelectedInstrumentId(inst.id)}
                data-testid={`select-instrument-${inst.id}`}
                className={`shrink-0 rounded-xl border px-3.5 py-2.5 text-left transition ${
                  isSelected
                    ? 'border-brand-500 bg-brand-500/15 ring-1 ring-brand-500/40'
                    : 'border-slate-200 bg-slate-50 hover:border-slate-300 dark:border-slate-800 dark:bg-anthracite-900'
                }`}
              >
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-slate-900 dark:text-white">
                    {inst.ticker}
                  </span>
                  <span className="rounded bg-slate-200 px-1.5 py-0.5 font-mono text-[9px] font-semibold dark:bg-slate-800">
                    {inst.instrumentType}
                  </span>
                </div>
                <div className="mt-0.5 max-w-[160px] truncate text-[11px] text-slate-500">
                  {inst.name}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Scheda Principale Strumento + Controlli Orizzonte e Broker */}
      {currentInstrument && (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          {/* Colonna Sinistra (2/3): Intestazione Strumento, Grafico e Indicatori */}
          <div className="space-y-6 lg:col-span-2">
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-anthracite-850">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h1 className="text-xl font-bold text-slate-900 dark:text-white">
                      {currentInstrument.name} ({currentInstrument.ticker})
                    </h1>
                    <span className="rounded-full bg-brand-500/15 px-2.5 py-0.5 font-mono text-[11px] font-bold text-brand-400">
                      {currentInstrument.instrumentType}
                    </span>
                    {currentInstrument.isDerivative && (
                      <span className="rounded-full bg-red-500/20 px-2.5 py-0.5 text-[11px] font-bold text-red-400">
                        DERIVATO / CFD
                      </span>
                    )}
                  </div>

                  {/* Metadati Universal Instrument Registry */}
                  <div className="mt-1.5 flex flex-wrap gap-3 font-mono text-[11px] text-slate-500 dark:text-slate-400">
                    <span>ID: {currentInstrument.id}</span>
                    <span>Mercato MIC: {currentInstrument.venueMic}</span>
                    {currentInstrument.isin && <span>ISIN: {currentInstrument.isin}</span>}
                    {currentInstrument.coingeckoId && (
                      <span>CoinGecko ID: {currentInstrument.coingeckoId}</span>
                    )}
                    {currentUnderlying?.contractAddress && (
                      <span>
                        Contract: {currentUnderlying.contractAddress.slice(0, 10)}...
                      </span>
                    )}
                  </div>
                </div>

                {/* Quotazione e Azioni Watchlist / AI */}
                <div className="text-right">
                  {detailQuote && detailQuote.validity === 'VALID' ? (
                    <>
                      <div className="num-mono text-2xl font-bold text-slate-900 dark:text-white">
                        {detailQuote.price.toLocaleString('it-IT', {
                          minimumFractionDigits: detailQuote.price < 10 ? 4 : 2,
                          maximumFractionDigits: detailQuote.price < 10 ? 4 : 2,
                        })}{' '}
                        {detailQuote.currency}
                      </div>
                      <div className="mt-1 flex items-center justify-end gap-2 text-xs">
                        <span
                          className={`inline-flex items-center gap-1 font-bold ${
                            detailQuote.changePct >= 0 ? 'text-emerald-400' : 'text-red-400'
                          }`}
                        >
                          {detailQuote.changePct >= 0 ? (
                            <TrendingUp className="h-3.5 w-3.5" />
                          ) : (
                            <TrendingDown className="h-3.5 w-3.5" />
                          )}
                          {detailQuote.changePct >= 0 ? '+' : ''}
                          {detailQuote.changePct.toFixed(2)}%
                        </span>
                        <span className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-[10px] dark:bg-slate-800">
                          {detailQuote.freshness} ({detailQuote.delaySeconds}s)
                        </span>
                      </div>
                      <div className="mt-1 text-[10px] text-slate-500">
                        Fonte: {detailQuote.providerName} •{' '}
                        {detailQuote.observedAt.slice(11, 19)} UTC
                      </div>
                    </>
                  ) : (
                    <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-300">
                      Quotazione LIVE Sospesa: {detailQuote?.statusMessage || 'Configura Provider'}
                    </div>
                  )}

                  <div className="mt-3 flex justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => toggleWatchlist(currentInstrument.id)}
                      data-testid="toggle-watchlist-btn"
                      className={`inline-flex items-center gap-1 rounded-lg border px-3 py-1.5 text-xs font-semibold transition ${
                        watchlistInstrumentIds.includes(currentInstrument.id)
                          ? 'border-amber-400/50 bg-amber-400/15 text-amber-300'
                          : 'border-slate-700 bg-anthracite-900 text-slate-300'
                      }`}
                    >
                      <Star className="h-3.5 w-3.5" />
                      {watchlistInstrumentIds.includes(currentInstrument.id)
                        ? 'In Watchlist'
                        : 'Aggiungi Watchlist'}
                    </button>

                    <button
                      type="button"
                      onClick={() => setIsAiDrawerOpen(true)}
                      className="inline-flex items-center gap-1 rounded-lg bg-brand-500 px-3 py-1.5 text-xs font-semibold text-anthracite-950 hover:bg-brand-400"
                    >
                      <Bot className="h-3.5 w-3.5" />
                      Chiedi a DemInvest AI
                    </button>
                  </div>
                </div>
              </div>

              {/* Selettore Timeframe e Orizzonte Temporale */}
              <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-4 dark:border-slate-800">
                <div className="flex items-center gap-1.5">
                  <span className="mr-1 text-xs font-semibold text-slate-500">Timeframe:</span>
                  {(['15m', '1h', '4h', '1d', '1w'] as CandleTimeframe[]).map((tf) => (
                    <button
                      key={tf}
                      type="button"
                      onClick={() => setTimeframe(tf)}
                      className={`rounded-md px-2.5 py-1 font-mono text-xs font-semibold ${
                        timeframe === tf
                          ? 'bg-brand-500 text-anthracite-950'
                          : 'bg-slate-100 text-slate-600 dark:bg-anthracite-900 dark:text-slate-300'
                      }`}
                    >
                      {tf}
                    </button>
                  ))}
                </div>

                <div className="flex items-center gap-1.5">
                  <span className="mr-1 text-xs font-semibold text-slate-500">
                    Orizzonte Analisi:
                  </span>
                  {(['BREVISSIMO', 'BREVE', 'MEDIO', 'LUNGO'] as TimeHorizon[]).map((h) => (
                    <button
                      key={h}
                      type="button"
                      onClick={() => setActiveHorizon(h)}
                      className={`rounded-md px-2.5 py-1 text-xs font-semibold ${
                        activeHorizon === h
                          ? 'bg-brand-500/20 text-brand-400 ring-1 ring-brand-500/50'
                          : 'bg-slate-100 text-slate-600 dark:bg-anthracite-900 dark:text-slate-400'
                      }`}
                    >
                      {h}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Grafico TradingView Lightweight Charts */}
            <TradingViewChart
              candles={detailCandles}
              indicators={detailIndicators}
              uiMode={uiMode}
              theme={theme}
              ticker={currentInstrument.ticker}
              currency={currentInstrument.quoteCurrency}
              providerName={detailQuote?.providerName || currentInstrument.primaryProviderId}
              isDemoData={Boolean(detailQuote?.isDemoData)}
            />

            {/* Analisi Tecnica: Vista Semplice vs Vista Pro */}
            {detailIndicators && (
              <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-anthracite-850">
                <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                  <h3 className="text-sm font-bold uppercase tracking-wider text-slate-700 dark:text-slate-200">
                    {uiMode === 'SIMPLE'
                      ? 'Spiegazione Guidata Indicatori & Orizzonte (Vista Semplice)'
                      : 'Motore Quantitativo Deterministico (Vista Pro)'}
                  </h3>
                  <div className="flex flex-wrap items-center gap-2 font-mono text-xs text-slate-500">
                    <span>Osservazioni chiuse: {detailIndicators.observationsCount}</span>
                    {detailIntelligence?.dataQuality && (
                      <span
                        data-testid="market-data-quality-badge"
                        className={`rounded px-2 py-0.5 text-[10px] font-bold ${
                          detailIntelligence.dataQuality.classification === 'VALID'
                            ? 'bg-emerald-500/15 text-emerald-400'
                            : 'bg-amber-500/15 text-amber-400'
                        }`}
                      >
                        Data Quality: {detailIntelligence.dataQuality.classification} (
                        {detailIntelligence.dataQuality.validClosedCandlesCount} barre chiuse)
                      </span>
                    )}
                  </div>
                </div>

                {/* Market Regime Detection V3 & Multi-Timeframe Consensus */}
                {(() => {
                  const effectiveRegime =
                    detailIntelligence?.regime ||
                    (detailIndicators ? detectMarketRegime(detailIndicators) : null);
                  if (!effectiveRegime) return null;
                  return (
                    <div
                      data-testid="market-regime-panel"
                      className="mb-4 grid grid-cols-1 gap-3 rounded-xl border border-slate-200 bg-slate-50 p-3.5 text-xs dark:border-slate-800 dark:bg-anthracite-900 sm:grid-cols-3"
                    >
                      <div>
                        <div className="text-[10px] font-bold uppercase text-slate-400">
                          Regime Direzionale
                        </div>
                        <div className="mt-0.5 font-mono text-xs font-bold text-brand-400">
                          {effectiveRegime.directionalRegime}
                        </div>
                        <div className="mt-0.5 text-[10px] text-slate-400">
                          {effectiveRegime.explanation}
                        </div>
                      </div>
                      <div>
                        <div className="text-[10px] font-bold uppercase text-slate-400">
                          Regime di Volatilità
                        </div>
                        <div className="mt-0.5 font-mono text-xs font-bold text-slate-900 dark:text-white">
                          {effectiveRegime.volatilityRegime}
                        </div>
                        <div className="mt-0.5 text-[10px] text-slate-400">
                          {detailIntelligence
                            ? `Fascia Rischio: ${detailIntelligence.riskReport.riskBand} (Score ${detailIntelligence.riskReport.overallRiskScore}/100)`
                            : `Confidenza Regime: ${effectiveRegime.regimeConfidenceScore}/100`}
                        </div>
                      </div>
                      <div>
                        <div className="text-[10px] font-bold uppercase text-slate-400">
                          {detailIntelligence
                            ? `Coerenza Multi-Timeframe (${detailIntelligence.multiTimeframe.operationalTimeframe} → ${detailIntelligence.multiTimeframe.higherConfirmationTimeframe})`
                            : 'Allineamento Strutturale Medie'}
                        </div>
                        <div className="mt-0.5 font-mono text-xs font-bold text-emerald-400">
                          {detailIntelligence
                            ? detailIntelligence.multiTimeframe.consensusState
                            : effectiveRegime.maAlignment}
                        </div>
                        <div className="mt-0.5 text-[10px] text-slate-400">
                          {detailIntelligence
                            ? detailIntelligence.multiTimeframe.summary
                            : `Compatibile con: ${effectiveRegime.compatibleStrategies.join(', ')}`}
                        </div>
                      </div>
                    </div>
                  );
                })()}

                {!detailIndicators.sufficientData ? (
                  <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-4 text-xs text-amber-300">
                    {detailIndicators.insufficientReason}
                  </div>
                ) : uiMode === 'SIMPLE' ? (
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                    <div className="rounded-xl border border-slate-200 bg-slate-50 p-3.5 dark:border-slate-800 dark:bg-anthracite-900">
                      <div className="text-xs font-bold text-slate-700 dark:text-slate-200">
                        1. Direzione del Trend ({detailIndicators.trendDirection})
                      </div>
                      <p className="mt-1 text-[11px] leading-relaxed text-slate-500 dark:text-slate-400">
                        Il prezzo ({detailIndicators.latestClose}) si trova{' '}
                        {detailIndicators.distanceFromSma20Pct !== null &&
                        detailIndicators.distanceFromSma20Pct >= 0
                          ? `sopra la media degli ultimi 20 periodi (+${detailIndicators.distanceFromSma20Pct}%)`
                          : `sotto la media degli ultimi 20 periodi (${detailIndicators.distanceFromSma20Pct}%)`}
                        .
                      </p>
                    </div>

                    <div className="rounded-xl border border-slate-200 bg-slate-50 p-3.5 dark:border-slate-800 dark:bg-anthracite-900">
                      <div className="text-xs font-bold text-slate-700 dark:text-slate-200">
                        2. Forza / Momentum (RSI = {detailIndicators.rsi14})
                      </div>
                      <p className="mt-1 text-[11px] leading-relaxed text-slate-500 dark:text-slate-400">
                        L'indice RSI misura la velocità dei movimenti da 0 a 100. Sopra 70 indica un mercato potenzialmente surriscaldato (ipercomprato); sotto 30 indica forti vendite recenti (ipervenduto).
                      </p>
                    </div>

                    <div className="rounded-xl border border-slate-200 bg-slate-50 p-3.5 dark:border-slate-800 dark:bg-anthracite-900">
                      <div className="text-xs font-bold text-slate-700 dark:text-slate-200">
                        3. Oscillazione Media (ATR = {detailIndicators.atrPct}%)
                      </div>
                      <p className="mt-1 text-[11px] leading-relaxed text-slate-500 dark:text-slate-400">
                        In media lo strumento oscilla del {detailIndicators.atrPct}% per candela. Valori più alti richiedono maggiore prudenza sulla dimensione della posizione.
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                      <div className="rounded-lg border border-slate-800 bg-anthracite-900 p-3">
                        <div className="text-[10px] uppercase text-slate-400">SMA 20 / SMA 50</div>
                        <div className="num-mono mt-1 text-xs font-bold text-white">
                          {detailIndicators.sma20 ?? 'N/D'} / {detailIndicators.sma50 ?? 'N/D'}
                        </div>
                        <div className="mt-0.5 text-[10px] text-slate-400">
                          Dist. SMA20: {detailIndicators.distanceFromSma20Pct ?? 0}% | Slope:{' '}
                          {detailIndicators.sma20SlopeNormalizedPct ?? 0}%
                        </div>
                      </div>

                      <div className="rounded-lg border border-slate-800 bg-anthracite-900 p-3">
                        <div className="text-[10px] uppercase text-slate-400">
                          RSI(14) & Stochastic
                        </div>
                        <div className="num-mono mt-1 text-xs font-bold text-white">
                          RSI: {detailIndicators.rsi14 ?? 'N/D'} | %K:{' '}
                          {detailIndicators.stochastic14?.k ?? 'N/D'}
                        </div>
                        <div className="mt-0.5 text-[10px] text-slate-400">
                          ROC(10): {detailIndicators.roc10 ?? 0}% | Mom(10):{' '}
                          {detailIndicators.momentum10 ?? 'N/D'}
                        </div>
                      </div>

                      <div className="rounded-lg border border-slate-800 bg-anthracite-900 p-3">
                        <div className="text-[10px] uppercase text-slate-400">
                          MACD (12,26,9) & ADX(14)
                        </div>
                        <div className="num-mono mt-1 text-xs font-bold text-white">
                          Hist: {detailIndicators.macd?.histogram ?? 'N/D'}
                        </div>
                        <div className="mt-0.5 text-[10px] text-slate-400">
                          ADX: {detailIndicators.adx14 ?? 'N/D'} (+DI {detailIndicators.plusDi14 ?? 'N/D'}{' '}
                          / -DI {detailIndicators.minusDi14 ?? 'N/D'})
                        </div>
                      </div>

                      <div className="rounded-lg border border-slate-800 bg-anthracite-900 p-3">
                        <div className="text-[10px] uppercase text-slate-400">
                          ATR(14) & Volatilità Ann.
                        </div>
                        <div className="num-mono mt-1 text-xs font-bold text-white">
                          {detailIndicators.atr14 ?? 'N/D'} ({detailIndicators.atrPct ?? 0}%)
                        </div>
                        <div className="mt-0.5 text-[10px] text-slate-400">
                          HV Ann.: {detailIndicators.historicalVolatilityAnnualizedPct ?? 'N/D'}% | DD:{' '}
                          {detailIndicators.maxDrawdownPct ?? 0}%
                        </div>
                      </div>
                    </div>

                    {/* Supporti e Resistenze Frattali + Pivot Confermati */}
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                      <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/5 p-3 text-xs">
                        <div className="font-bold text-emerald-400">
                          Supporti Verificati (Cluster Frattali ATR):
                        </div>
                        {detailIndicators.supports.length === 0 ? (
                          <div className="mt-1 text-slate-400">
                            Nessun cluster statico inferiore rilevato nella finestra corrente.
                          </div>
                        ) : (
                          detailIndicators.supports.map((s, idx) => (
                            <div key={idx} className="num-mono mt-1 flex justify-between">
                              <span>Livello S{idx + 1}: {s.price}</span>
                              <span>
                                Touches: {s.touches}x (Forza {s.strengthScore}/100)
                              </span>
                            </div>
                          ))
                        )}
                      </div>

                      <div className="rounded-lg border border-amber-500/20 bg-amber-500/5 p-3 text-xs">
                        <div className="font-bold text-amber-400">
                          Resistenze Verificate (Cluster Frattali ATR):
                        </div>
                        {detailIndicators.resistances.length === 0 ? (
                          <div className="mt-1 text-slate-400">
                            Nessuna resistenza statica superiore rilevata nella finestra corrente.
                          </div>
                        ) : (
                          detailIndicators.resistances.map((r, idx) => (
                            <div key={idx} className="num-mono mt-1 flex justify-between">
                              <span>Livello R{idx + 1}: {r.price}</span>
                              <span>
                                Touches: {r.touches}x (Forza {r.strengthScore}/100)
                              </span>
                            </div>
                          ))
                        )}
                      </div>
                    </div>

                    {/* Pivot High / Low Confermati (Zero Look-Ahead Bias) */}
                    {((detailIndicators.confirmedPivotHighs &&
                      detailIndicators.confirmedPivotHighs.length > 0) ||
                      (detailIndicators.confirmedPivotLows &&
                        detailIndicators.confirmedPivotLows.length > 0)) && (
                      <div className="rounded-lg border border-slate-800 bg-anthracite-900 p-3 text-xs">
                        <div className="font-bold text-brand-400">
                          Pivot Strutturali Confermati (Zero Look-Ahead Bias — 2 Candele Destre Chiuse):
                        </div>
                        <div className="mt-1.5 grid grid-cols-1 gap-1.5 sm:grid-cols-2">
                          {[
                            ...(detailIndicators.confirmedPivotHighs || []),
                            ...(detailIndicators.confirmedPivotLows || []),
                          ]
                            .slice(-4)
                            .map((piv, idx) => (
                              <div
                                key={idx}
                                className="num-mono flex items-center justify-between rounded bg-anthracite-950 px-2.5 py-1 text-[11px]"
                              >
                                <span
                                  className={
                                    piv.type === 'PIVOT_HIGH' ? 'text-amber-400' : 'text-emerald-400'
                                  }
                                >
                                  {piv.type}: {piv.price}
                                </span>
                                <span className="text-[10px] text-slate-400">
                                  Conf. +{piv.rightBars} barre{' '}
                                  {piv.broken ? '• ROTTO' : '• ATTIVO'}
                                  {piv.falseBreakoutDetected ? ' (Falso Breakout)' : ''}
                                </span>
                              </div>
                            ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Colonna Destra (1/3): Valutazione Segnale, Scheda Broker Mapping & Alert */}
          <div className="space-y-6">
            {/* Scheda Valutazione Segnale sull'Orizzonte Scelto */}
            {detailSignal && (
              <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-anthracite-850">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
                    Signal Intelligence ({activeHorizon})
                  </span>
                  <span
                    className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${
                      detailSignal.signalType === 'BUY_SETUP' ||
                      detailSignal.signalType === 'BREAKOUT_ALERT'
                        ? 'bg-emerald-500/15 text-emerald-400'
                        : detailSignal.signalType === 'NO_TRADE'
                          ? 'bg-slate-500/20 text-slate-300'
                          : 'bg-amber-500/15 text-amber-400'
                    }`}
                  >
                    {detailSignal.signalType}
                  </span>
                </div>

                <div className="mt-2 flex items-baseline justify-between">
                  <div className="text-xs text-slate-400">
                    Stato: <strong className="text-white">{detailSignal.status}</strong>
                  </div>
                  <div className="num-mono text-sm font-bold text-brand-400">
                    Punteggio Euristico: {detailSignal.heuristicScore}/100
                  </div>
                </div>
                <div className="mt-0.5 text-[10px] text-slate-500">
                  Nota: Punteggio multifattoriale deterministico (non è una probabilità statistica di profitto).
                </div>

                <p className="mt-3 rounded-lg bg-slate-50 p-3 text-xs leading-relaxed text-slate-700 dark:bg-anthracite-900 dark:text-slate-300">
                  {detailSignal.quantitativeRationale}
                </p>

                {detailIntelligence?.bestStrategySetup && (
                  <div className="mt-3 rounded-lg border border-brand-500/25 bg-brand-500/5 p-3 text-[11px]">
                    <div className="flex items-center justify-between font-bold text-brand-400">
                      <span>
                        Strategia V3: {detailIntelligence.bestStrategySetup.strategyName} (v
                        {detailIntelligence.bestStrategySetup.strategyVersion})
                      </span>
                      <span>{detailIntelligence.bestStrategySetup.signalClassification}</span>
                    </div>
                    {detailIntelligence.bestStrategySetup.sellDistinction !== 'NOT_APPLICABLE' && (
                      <div className="mt-1 font-semibold text-amber-300">
                        Distinzione Segnale Ribassista:{' '}
                        {detailIntelligence.bestStrategySetup.sellDistinction ===
                        'EXISTING_POSITION_EXIT'
                          ? 'Uscita da Posizione Esistente in Portafoglio'
                          : 'Segnale Tecnico Ribassista di Mercato (Non Short Automatico)'}
                      </div>
                    )}
                    <div className="num-mono mt-1 text-slate-300">
                      Invalidazione: {detailIntelligence.bestStrategySetup.invalidationPrice ?? 'N/D'}{' '}
                      | Target:{' '}
                      {detailIntelligence.bestStrategySetup.targetLevels
                        .map((t) => t.price)
                        .join(' → ') || 'N/D'}
                    </div>
                  </div>
                )}

                <div className="mt-3 space-y-2 text-xs">
                  <div>
                    <div className="font-semibold text-emerald-400">Condizioni Soddisfatte:</div>
                    <ul className="mt-1 space-y-1 text-[11px] text-slate-400">
                      {detailSignal.conditionsMet.map((c, i) => (
                        <li key={i} className="flex items-start gap-1.5">
                          <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-400" />
                          <span>{c}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  {detailSignal.conditionsUnmet.length > 0 && (
                    <div>
                      <div className="font-semibold text-amber-400">
                        Condizioni Non Soddisfatte / Filtri No-Trade:
                      </div>
                      <ul className="mt-1 space-y-1 text-[11px] text-slate-400">
                        {detailSignal.conditionsUnmet.map((c, i) => (
                          <li key={i} className="flex items-start gap-1.5">
                            <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-400" />
                            <span>{c}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>

                <div className="mt-3 border-t border-slate-800 pt-2.5 text-[11px] text-slate-400">
                  <div>
                    <strong>Focus Metodologico ({horizonSpec.label}):</strong>
                  </div>
                  <ul className="mt-1 list-disc pl-4">
                    {horizonSpec.methodologyFocus.map((m, i) => (
                      <li key={i}>{m}</li>
                    ))}
                  </ul>
                </div>
              </div>
            )}

            {/* Scheda Broker Instrument Mapping (Sezione 8) */}
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-anthracite-850">
              <div className="mb-3 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Layers className="h-4 w-4 text-brand-400" />
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-200">
                    Scheda Broker & Nomenclatura
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={() => setShowBrokerCsvModal(!showBrokerCsvModal)}
                  className="inline-flex items-center gap-1 rounded bg-slate-100 px-2 py-1 text-[11px] font-semibold text-slate-700 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300"
                >
                  <FileSpreadsheet className="h-3 w-3 text-brand-400" />
                  Importa CSV MT4/MT5
                </button>
              </div>

              <div className="mb-3 flex flex-wrap gap-1.5">
                {['TRADE_REPUBLIC', 'IBKR', 'AVATRADE', 'MT4', 'MT5'].map((bCode) => (
                  <button
                    key={bCode}
                    type="button"
                    onClick={() => setSelectedBrokerCode(bCode)}
                    className={`rounded-lg px-2.5 py-1 text-[11px] font-semibold ${
                      selectedBrokerCode === bCode
                        ? 'bg-brand-500 text-anthracite-950'
                        : 'bg-slate-100 text-slate-600 dark:bg-anthracite-900 dark:text-slate-400'
                    }`}
                  >
                    {bCode}
                  </button>
                ))}
              </div>

              {selectedBrokerMapping ? (
                <div className="space-y-2.5 rounded-xl border border-slate-200 bg-slate-50 p-3.5 text-xs dark:border-slate-800 dark:bg-anthracite-900">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-slate-900 dark:text-white">
                      {selectedBrokerMapping.brokerName} ({selectedBrokerMapping.platformType})
                    </span>
                    <span
                      className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                        selectedBrokerMapping.verificationStatus === 'VERIFIED'
                          ? 'bg-emerald-500/15 text-emerald-400'
                          : selectedBrokerMapping.verificationStatus === 'USER_CONFIRMED'
                            ? 'bg-sky-500/15 text-sky-400'
                            : 'bg-amber-500/15 text-amber-400'
                      }`}
                    >
                      {selectedBrokerMapping.verificationStatus}
                    </span>
                  </div>

                  <div className="num-mono text-xs">
                    Simbolo Esatto:{' '}
                    <strong className="text-brand-400">
                      {selectedBrokerMapping.brokerSymbol}
                    </strong>
                  </div>
                  <div className="text-[11px] text-slate-400">
                    Tipo Contratto: <strong>{selectedBrokerMapping.contractType}</strong> • Valuta:{' '}
                    <strong>{selectedBrokerMapping.currency}</strong> • Venue:{' '}
                    {selectedBrokerMapping.venueLabel}
                  </div>
                  <div className="text-[11px] text-slate-400">
                    <strong>Costi Documentati:</strong> {selectedBrokerMapping.commissionNotes}
                  </div>
                  <div className="text-[11px] text-slate-400">
                    <strong>Fonte Corrispondenza:</strong>{' '}
                    {selectedBrokerMapping.verificationSource}
                  </div>

                  {selectedBrokerMapping.spotVsDerivativeWarning && (
                    <div className="rounded-lg border border-red-500/40 bg-red-500/10 p-2.5 text-[11px] text-red-300">
                      <ShieldAlert className="mr-1 inline h-3.5 w-3.5" />
                      {selectedBrokerMapping.spotVsDerivativeWarning}
                    </div>
                  )}
                </div>
              ) : (
                <div className="space-y-3 rounded-xl border border-amber-500/30 bg-amber-500/5 p-3.5 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-amber-300">
                      Stato Corrispondenza: UNVERIFIED
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-400">
                    Per regola rigorosa (Sezione 8), DemInvest non inventa mai simboli broker non verificati per <strong>{selectedBrokerCode}</strong>. Puoi registrare manualmente il simbolo esatto del tuo intermediario qui sotto:
                  </p>
                  <form onSubmit={handleManualBrokerConfirm} className="space-y-2">
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={manualBrokerSymbol}
                        onChange={(e) => setManualBrokerSymbol(e.target.value)}
                        placeholder={`Simbolo su ${selectedBrokerCode} (es. ${currentInstrument.ticker})`}
                        className="flex-1 rounded-lg border border-slate-700 bg-anthracite-900 px-2.5 py-1.5 text-xs text-white"
                      />
                      <select
                        value={manualContractType}
                        onChange={(e) =>
                          setManualContractType(
                            e.target.value as 'SPOT' | 'CASH_SHARE' | 'ETF_SHARE' | 'CFD'
                          )
                        }
                        className="rounded-lg border border-slate-700 bg-anthracite-900 px-2 py-1.5 text-xs text-white"
                      >
                        <option value="SPOT">SPOT</option>
                        <option value="CASH_SHARE">AZIONE CASH</option>
                        <option value="ETF_SHARE">ETF</option>
                        <option value="CFD">CFD DERIVATO</option>
                      </select>
                    </div>
                    <button
                      type="submit"
                      className="w-full rounded-lg bg-brand-500/20 py-1.5 text-xs font-semibold text-brand-300 hover:bg-brand-500 hover:text-anthracite-950"
                    >
                      Conferma Manualmente (USER_CONFIRMED)
                    </button>
                  </form>
                </div>
              )}

              {/* Modal / Box Importazione CSV MT4/MT5 */}
              {showBrokerCsvModal && (
                <form
                  onSubmit={handleBrokerCsvImport}
                  className="mt-3 space-y-2 rounded-xl border border-slate-700 bg-anthracite-900 p-3 text-xs"
                >
                  <div className="font-semibold text-brand-400">
                    Importazione Elenco Strumenti da CSV (MetaTrader 4/5 o Broker):
                  </div>
                  <textarea
                    rows={3}
                    value={csvInputText}
                    onChange={(e) => setCsvInputText(e.target.value)}
                    className="w-full rounded border border-slate-700 bg-anthracite-950 p-2 font-mono text-[10px] text-slate-200"
                  />
                  <button
                    type="submit"
                    className="w-full rounded-lg bg-brand-500 py-1.5 text-xs font-semibold text-anthracite-950"
                  >
                    Importa Simboli CSV
                  </button>
                  {csvFeedback && (
                    <div className="text-[11px] text-emerald-400">{csvFeedback}</div>
                  )}
                </form>
              )}
            </div>

            {/* Creazione Rapida Alert Prezzo */}
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-anthracite-850">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-200">
                Imposta Alert Prezzo su {currentInstrument.ticker}
              </h3>
              <form onSubmit={handleQuickAlertCreate} className="mt-3 flex gap-2">
                <input
                  type="number"
                  step="any"
                  required
                  value={alertThreshold}
                  onChange={(e) => setAlertThreshold(e.target.value)}
                  placeholder={`Soglia prezzo in ${currentInstrument.quoteCurrency}...`}
                  data-testid="quick-alert-input"
                  className="flex-1 rounded-xl border border-slate-300 bg-slate-50 px-3 py-2 text-xs dark:border-slate-700 dark:bg-anthracite-900 dark:text-white"
                />
                <button
                  type="submit"
                  data-testid="quick-alert-submit"
                  className="rounded-xl bg-brand-500 px-4 py-2 text-xs font-semibold text-anthracite-950 hover:bg-brand-400"
                >
                  Attiva Alert
                </button>
              </form>
              {alertFeedback && (
                <div className="mt-2 flex items-center gap-1 text-xs text-emerald-400">
                  <Info className="h-3.5 w-3.5" />
                  <span>{alertFeedback}</span>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
