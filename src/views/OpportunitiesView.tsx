import React, { useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  Filter,
  ShieldAlert,
  Sparkles,
  Zap,
} from 'lucide-react';
import { useDemInvest } from '../context/DemInvestContext';
import { AssetClass, TimeHorizon } from '../types/domain';

interface OpportunitiesViewProps {
  onOpenInstrument: (instrumentId: string) => void;
}

export const OpportunitiesView: React.FC<OpportunitiesViewProps> = ({
  onOpenInstrument,
}) => {
  const {
    instruments,
    quotes,
    brokerMappings,
    watchlistInstrumentIds,
    generatedSignals,
    triggerSchedulerNow,
  } = useDemInvest();

  const [filterClass, setFilterClass] = useState<AssetClass | 'ALL'>('ALL');
  const [filterHorizon, setFilterHorizon] = useState<TimeHorizon | 'ALL'>('ALL');
  const [filterBroker, setFilterBroker] = useState<string>('ALL');
  const [filterFreshness, setFilterFreshness] = useState<string>('ALL');
  const [onlyWatchlist, setOnlyWatchlist] = useState(false);
  const [hideNoTrade, setHideNoTrade] = useState(false);
  const [scanning, setScanning] = useState(false);

  const handleRunScan = async () => {
    setScanning(true);
    try {
      await triggerSchedulerNow();
    } finally {
      setScanning(false);
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
                className="rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-anthracite-900"
              >
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-bold text-slate-900 dark:text-white">
                      {sig.instrumentName} ({sig.instrumentTicker})
                    </span>
                    <span
                      className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${
                        sig.signalType === 'BUY_SETUP' || sig.signalType === 'BREAKOUT_ALERT'
                          ? 'bg-emerald-500/15 text-emerald-400'
                          : sig.signalType === 'NO_TRADE'
                            ? 'bg-slate-500/20 text-slate-300'
                            : 'bg-amber-500/15 text-amber-400'
                      }`}
                    >
                      {sig.signalType}
                    </span>
                    <span className="rounded bg-slate-200 px-2 py-0.5 font-mono text-[11px] font-semibold dark:bg-slate-800">
                      Stato: {sig.status}
                    </span>
                    <span className="rounded bg-brand-500/10 px-2 py-0.5 text-[11px] font-semibold text-brand-400">
                      Orizzonte: {sig.horizon} ({sig.timeframe})
                    </span>
                  </div>

                  <div className="flex items-center gap-3">
                    <div className="text-right">
                      <div className="num-mono text-sm font-bold text-brand-400">
                        Punteggio Euristico: {sig.heuristicScore}/100
                      </div>
                      <div className="text-[10px] text-slate-500">
                        Trend {sig.scoreBreakdown.trendScore} • Mom{' '}
                        {sig.scoreBreakdown.momentumScore} • Vol{' '}
                        {sig.scoreBreakdown.volatilityRiskScore} • Qualità{' '}
                        {sig.scoreBreakdown.dataQualityScore}
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => onOpenInstrument(sig.instrumentId)}
                      className="rounded-lg bg-brand-500 px-3 py-1.5 text-xs font-semibold text-anthracite-950 hover:bg-brand-400"
                    >
                      Apri Grafico
                    </button>
                  </div>
                </div>

                <p className="mt-2.5 text-xs leading-relaxed text-slate-700 dark:text-slate-300">
                  {sig.quantitativeRationale}
                </p>

                <div className="mt-3 grid grid-cols-1 gap-3 border-t border-slate-200/70 pt-3 text-[11px] dark:border-slate-800 sm:grid-cols-3">
                  <div>
                    <div className="font-semibold text-emerald-400">Condizioni Soddisfatte:</div>
                    {sig.conditionsMet.map((c, idx) => (
                      <div key={idx} className="mt-0.5 flex items-start gap-1 text-slate-400">
                        <CheckCircle2 className="mt-0.5 h-3 w-3 shrink-0 text-emerald-400" />
                        <span>{c}</span>
                      </div>
                    ))}
                  </div>

                  <div>
                    <div className="font-semibold text-amber-400">
                      Condizioni Non Soddisfatte / Esclusioni:
                    </div>
                    {sig.conditionsUnmet.length === 0 ? (
                      <div className="mt-0.5 text-slate-500">Tutte le condizioni primarie verificate.</div>
                    ) : (
                      sig.conditionsUnmet.map((u, idx) => (
                        <div key={idx} className="mt-0.5 flex items-start gap-1 text-slate-400">
                          <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0 text-amber-400" />
                          <span>{u}</span>
                        </div>
                      ))
                    )}
                  </div>

                  <div>
                    <div className="font-semibold text-red-400">Livelli & Rischi Principali:</div>
                    <div className="num-mono mt-0.5 text-slate-300">
                      Prezzo Osservato: {sig.observedPrice} {sig.currency} | Invalidazione:{' '}
                      {sig.invalidationLevel ?? 'N/A'}
                    </div>
                    {sig.keyRisks.map((r, idx) => (
                      <div key={idx} className="mt-0.5 flex items-start gap-1 text-slate-400">
                        <ShieldAlert className="mt-0.5 h-3 w-3 shrink-0 text-red-400" />
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
