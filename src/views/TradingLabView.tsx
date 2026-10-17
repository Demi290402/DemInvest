import React, { useState } from 'react';
import {
  BookOpen,
  CheckCircle2,
  FlaskConical,
  Play,
  RotateCcw,
  ShieldAlert,
  TrendingUp,
} from 'lucide-react';
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { useDemInvest } from '../context/DemInvestContext';
import { VERSIONED_STRATEGIES } from '../engines/paperAndBacktestEngine';
import { BacktestResult } from '../types/domain';

export const TradingLabView: React.FC = () => {
  const {
    dataExecutionMode,
    instruments,
    quotes,
    paperAccount,
    journalEntries,
    executePaperOrder,
    resetPaperAccount,
    addJournalEntry,
  } = useDemInvest();

  const [activeTab, setActiveTab] = useState<'PAPER' | 'BACKTEST' | 'JOURNAL'>('PAPER');

  // Paper Trading state
  const [paperInstId, setPaperInstId] = useState('INST_BTC_USD_SPOT');
  const [paperSide, setPaperSide] = useState<'BUY' | 'SELL'>('BUY');
  const [paperQty, setPaperQty] = useState('0.1');
  const [paperSpreadBps, setPaperSpreadBps] = useState('12');
  const [paperSlippageBps, setPaperSlippageBps] = useState('8');
  const [paperCommissionPct, setPaperCommissionPct] = useState('0.10');
  const [paperNotes, setPaperNotes] = useState('');
  const [paperFeedback, setPaperFeedback] = useState<string | null>(null);

  // Backtesting state
  const [btStrategyId, setBtStrategyId] = useState(VERSIONED_STRATEGIES[0].id);
  const [btInstrumentId, setBtInstrumentId] = useState('INST_BTC_USD_SPOT');
  const [btInitialCapital, setBtInitialCapital] = useState('10000');
  const [btCommissionPct, setBtCommissionPct] = useState('0.10');
  const [btSpreadBps, setBtSpreadBps] = useState('12');
  const [btSlippageBps, setBtSlippageBps] = useState('8');
  const [btMaxRiskPct, setBtMaxRiskPct] = useState('2.0');
  const [btResult, setBtResult] = useState<BacktestResult | null>(null);
  const [btError, setBtError] = useState<string | null>(null);
  const [runningBt, setRunningBt] = useState(false);

  // Journal state
  const [jTitle, setJTitle] = useState('');
  const [jHypothesis, setJHypothesis] = useState('');
  const [jOutcome, setJOutcome] = useState('');
  const [jEmotion, setJEmotion] = useState('Disciplinato / Razionale');
  const [jLessons, setJLessons] = useState('');

  const handlePaperSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setPaperFeedback(null);
    const res = await executePaperOrder({
      instrumentId: paperInstId,
      side: paperSide,
      quantity: Number(paperQty),
      spreadBps: Number(paperSpreadBps),
      slippageBps: Number(paperSlippageBps),
      commissionPct: Number(paperCommissionPct),
      rationaleNotes: paperNotes,
    });
    if (!res.ok) {
      setPaperFeedback(`Errore: ${res.error}`);
    } else {
      setPaperFeedback('Ordine simulato registrato con calcolo esplicito di spread, slippage e commissione.');
      setPaperNotes('');
    }
  };

  const handleRunBacktest = async (e: React.FormEvent) => {
    e.preventDefault();
    setBtError(null);
    setRunningBt(true);
    try {
      const res = await fetch('/api/lab/backtest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          strategyId: btStrategyId,
          instrumentId: btInstrumentId,
          timeframe: '1d',
          mode: dataExecutionMode,
          initialCapital: Number(btInitialCapital),
          commissionPct: Number(btCommissionPct),
          spreadBps: Number(btSpreadBps),
          slippageBps: Number(btSlippageBps),
          maxRiskPerTradePct: Number(btMaxRiskPct),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setBtError(data.error || 'Errore esecuzione backtest');
      } else {
        setBtResult(data.backtestResult);
      }
    } finally {
      setRunningBt(false);
    }
  };

  const handleAddJournal = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!jTitle.trim() || !jHypothesis.trim()) return;
    await addJournalEntry({
      instrumentId: paperInstId,
      title: jTitle,
      hypothesis: jHypothesis,
      outcomeReview: jOutcome,
      emotionalState: jEmotion,
      lessonsLearned: jLessons,
    });
    setJTitle('');
    setJHypothesis('');
    setJOutcome('');
    setJLessons('');
  };

  const selectedPaperQuote = quotes[paperInstId];

  return (
    <div className="space-y-6">
      {/* Header Trading Lab & Selettore Modulo */}
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-anthracite-850">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <FlaskConical className="h-5 w-5 text-brand-500" />
              <h1 className="text-lg font-bold text-slate-900 dark:text-white">
                Trading Lab — Simulazione, Backtesting & Trading Journal
              </h1>
            </div>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              Ambiente di ricerca rigorosamente separato dal patrimonio reale. Nessun ordine viene mai inviato a broker esterni.
            </p>
          </div>

          <div className="flex gap-2">
            {[
              { id: 'PAPER', label: '1. Paper Trading (Conto Virtuale)' },
              { id: 'BACKTEST', label: '2. Strategy Backtesting' },
              { id: 'JOURNAL', label: '3. Trading Journal' },
            ].map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id as 'PAPER' | 'BACKTEST' | 'JOURNAL')}
                data-testid={`lab-tab-${tab.id.toLowerCase()}`}
                className={`rounded-xl px-3.5 py-2 text-xs font-semibold transition ${
                  activeTab === tab.id
                    ? 'bg-brand-500 text-anthracite-950'
                    : 'bg-slate-100 text-slate-600 dark:bg-anthracite-900 dark:text-slate-300'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* TAB 1: PAPER TRADING */}
      {activeTab === 'PAPER' && paperAccount && (
        <div className="space-y-6">
          <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-3.5 text-xs text-amber-300">
            <ShieldAlert className="mr-1.5 inline h-4 w-4" />
            <strong>Avviso Trasparenza Simulazione:</strong> Tutte le esecuzioni in Paper Trading sono simulate su capitale virtuale aplicando spread, slippage parametrico e commissioni. I prezzi simulati non costituiscono ordini reali eseguiti sul mercato.
          </div>

          {/* KPI Conto Virtuale */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-4">
            <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-anthracite-850">
              <div className="text-xs text-slate-400">Equity Totale Virtuale</div>
              <div className="num-mono mt-1 text-xl font-bold text-white">
                {paperAccount.totalEquity.toFixed(2)} {paperAccount.baseCurrency}
              </div>
              <div className="mt-1 text-[11px] text-slate-500">
                Capitale iniziale: {paperAccount.initialCapital.toFixed(2)}{' '}
                {paperAccount.baseCurrency}
              </div>
            </div>

            <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-anthracite-850">
              <div className="text-xs text-slate-400">Liquidità Virtuale Disponibile</div>
              <div className="num-mono mt-1 text-xl font-bold text-brand-400">
                {paperAccount.cashBalance.toFixed(2)} {paperAccount.baseCurrency}
              </div>
            </div>

            <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-anthracite-850">
              <div className="text-xs text-slate-400">P&L Realizzato / Non Realizzato</div>
              <div className="num-mono mt-1 text-sm font-bold text-white">
                Real: {paperAccount.realizedPnlTotal >= 0 ? '+' : ''}
                {paperAccount.realizedPnlTotal.toFixed(2)} | Unreal:{' '}
                {paperAccount.unrealizedPnlTotal >= 0 ? '+' : ''}
                {paperAccount.unrealizedPnlTotal.toFixed(2)}
              </div>
            </div>

            <div className="flex flex-col justify-between rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-anthracite-850">
              <div>
                <div className="text-xs text-slate-400">Max Drawdown Simulato</div>
                <div className="num-mono mt-1 text-lg font-bold text-red-400">
                  -{paperAccount.maxDrawdownPct.toFixed(2)}%
                </div>
              </div>
              <button
                type="button"
                onClick={() => resetPaperAccount(25000)}
                className="mt-2 inline-flex items-center gap-1 text-[11px] text-slate-400 hover:text-white"
              >
                <RotateCcw className="h-3 w-3" /> Ripristina Conto (25.000 USD)
              </button>
            </div>
          </div>

          {/* Form Esecuzione Ordine Simulato & Posizioni */}
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
            <form
              onSubmit={handlePaperSubmit}
              className="space-y-3 rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-anthracite-850"
            >
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                Nuova Operazione Simulata (Paper Order)
              </h3>

              <div>
                <label className="mb-1 block text-xs text-slate-400">Strumento</label>
                <select
                  value={paperInstId}
                  onChange={(e) => setPaperInstId(e.target.value)}
                  className="w-full rounded-lg border border-slate-700 bg-anthracite-900 px-3 py-2 text-xs text-white"
                >
                  {instruments.map((inst) => (
                    <option key={inst.id} value={inst.id}>
                      {inst.ticker} — {inst.name}
                    </option>
                  ))}
                </select>
                {selectedPaperQuote && selectedPaperQuote.validity === 'VALID' && (
                  <div className="num-mono mt-1 text-[11px] text-brand-400">
                    Prezzo di riferimento verificato: {selectedPaperQuote.price}{' '}
                    {selectedPaperQuote.currency} ({selectedPaperQuote.providerName})
                  </div>
                )}
              </div>

              <div className="grid grid-cols-2 gap-2">
                {(['BUY', 'SELL'] as const).map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => setPaperSide(s)}
                    className={`rounded-lg py-2 text-xs font-bold ${
                      paperSide === s
                        ? s === 'BUY'
                          ? 'bg-emerald-500 text-anthracite-950'
                          : 'bg-red-500 text-white'
                        : 'bg-anthracite-900 text-slate-400'
                    }`}
                  >
                    {s === 'BUY' ? 'ACQUISTO SIMULATO (BUY)' : 'VENDITA SIMULATA (SELL)'}
                  </button>
                ))}
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="mb-1 block text-[11px] text-slate-400">Quantità</label>
                  <input
                    type="number"
                    step="any"
                    required
                    value={paperQty}
                    onChange={(e) => setPaperQty(e.target.value)}
                    data-testid="paper-qty-input"
                    className="w-full rounded-lg border border-slate-700 bg-anthracite-900 px-3 py-2 text-xs text-white"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-[11px] text-slate-400">
                    Commissione (%)
                  </label>
                  <input
                    type="number"
                    step="any"
                    value={paperCommissionPct}
                    onChange={(e) => setPaperCommissionPct(e.target.value)}
                    className="w-full rounded-lg border border-slate-700 bg-anthracite-900 px-3 py-2 text-xs text-white"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="mb-1 block text-[11px] text-slate-400">
                    Spread Simulato (bps)
                  </label>
                  <input
                    type="number"
                    step="any"
                    value={paperSpreadBps}
                    onChange={(e) => setPaperSpreadBps(e.target.value)}
                    className="w-full rounded-lg border border-slate-700 bg-anthracite-900 px-3 py-2 text-xs text-white"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-[11px] text-slate-400">
                    Slippage Parametrico (bps)
                  </label>
                  <input
                    type="number"
                    step="any"
                    value={paperSlippageBps}
                    onChange={(e) => setPaperSlippageBps(e.target.value)}
                    className="w-full rounded-lg border border-slate-700 bg-anthracite-900 px-3 py-2 text-xs text-white"
                  />
                </div>
              </div>

              <div>
                <label className="mb-1 block text-[11px] text-slate-400">
                  Motivazione / Ipotesi Operativa
                </label>
                <input
                  type="text"
                  value={paperNotes}
                  onChange={(e) => setPaperNotes(e.target.value)}
                  placeholder="Es. Test ingresso pullback su SMA20..."
                  className="w-full rounded-lg border border-slate-700 bg-anthracite-900 px-3 py-2 text-xs text-white"
                />
              </div>

              <button
                type="submit"
                data-testid="paper-submit-btn"
                className="w-full rounded-xl bg-brand-500 py-2.5 text-xs font-bold text-anthracite-950 hover:bg-brand-400"
              >
                Simula Ordine in Paper Trading
              </button>

              {paperFeedback && (
                <div className="rounded-lg bg-slate-800 p-2.5 text-[11px] text-emerald-300">
                  {paperFeedback}
                </div>
              )}
            </form>

            {/* Posizioni Aperte e Storico Ordini Simulati */}
            <div className="space-y-6 lg:col-span-2">
              <div className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-anthracite-850">
                <h3 className="mb-3 text-sm font-bold text-slate-900 dark:text-white">
                  Posizioni Virtuali Aperte ({paperAccount.positions.length})
                </h3>
                {paperAccount.positions.length === 0 ? (
                  <p className="text-xs text-slate-500">
                    Nessuna posizione simulata aperta. Usa il modulo a sinistra per simulare un'operazione.
                  </p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead>
                        <tr className="border-b border-slate-800 text-[11px] text-slate-400">
                          <th className="pb-2">Strumento</th>
                          <th className="pb-2 text-right">Quantità</th>
                          <th className="pb-2 text-right">Prezzo Carico Sim.</th>
                          <th className="pb-2 text-right">Prezzo Riferimento</th>
                          <th className="pb-2 text-right">P&L Non Realizzato</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800/60">
                        {paperAccount.positions.map((p) => (
                          <tr key={p.instrumentId}>
                            <td className="py-2.5 font-bold text-white">{p.ticker}</td>
                            <td className="num-mono py-2.5 text-right">{p.quantity}</td>
                            <td className="num-mono py-2.5 text-right">
                              {p.averageEntryPrice} {p.currency}
                            </td>
                            <td className="num-mono py-2.5 text-right">
                              {p.currentPrice ?? p.averageEntryPrice} {p.currency}
                            </td>
                            <td
                              className={`num-mono py-2.5 text-right font-bold ${
                                (p.unrealizedPnl ?? 0) >= 0 ? 'text-emerald-400' : 'text-red-400'
                              }`}
                            >
                              {p.unrealizedPnl ?? 0} {p.currency} ({p.unrealizedPnlPct ?? 0}%)
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              <div className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-anthracite-850">
                <h3 className="mb-3 text-sm font-bold text-slate-900 dark:text-white">
                  Storico Ordini Simulati & Costi di Frizione ({paperAccount.orders.length})
                </h3>
                {paperAccount.orders.length === 0 ? (
                  <p className="text-xs text-slate-500">Nessun ordine simulato nello storico.</p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead>
                        <tr className="border-b border-slate-800 text-[11px] text-slate-400">
                          <th className="pb-2">Data / Ora</th>
                          <th className="pb-2">Lato / Ticker</th>
                          <th className="pb-2 text-right">Q.tà</th>
                          <th className="pb-2 text-right">Prezzo Mercato</th>
                          <th className="pb-2 text-right">Prezzo Sim. (con Spread/Slip)</th>
                          <th className="pb-2 text-right">Costi Frizione</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800/60">
                        {paperAccount.orders.map((o) => (
                          <tr key={o.id}>
                            <td className="py-2 font-mono text-[10px] text-slate-400">
                              {o.executedAt.slice(0, 19).replace('T', ' ')}
                            </td>
                            <td className="py-2 font-bold">
                              <span
                                className={
                                  o.side === 'BUY' ? 'text-emerald-400' : 'text-red-400'
                                }
                              >
                                {o.side}
                              </span>{' '}
                              {o.ticker}
                            </td>
                            <td className="num-mono py-2 text-right">{o.quantity}</td>
                            <td className="num-mono py-2 text-right">
                              {o.referenceMarketPrice} {o.currency}
                            </td>
                            <td className="num-mono py-2 text-right font-semibold text-white">
                              {o.simulatedExecutionPrice} {o.currency}
                            </td>
                            <td className="num-mono py-2 text-right text-[11px] text-amber-400">
                              Spread: {o.simulatedSpreadCost} + Slip: {o.simulatedSlippageCost} +
                              Comm: {o.simulatedCommission}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: STRATEGY BACKTESTING */}
      {activeTab === 'BACKTEST' && (
        <div className="space-y-6">
          <form
            onSubmit={handleRunBacktest}
            className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-anthracite-850"
          >
            <h3 className="mb-3 text-sm font-bold text-slate-900 dark:text-white">
              Configurazione Strategy Backtesting (Senza Look-Ahead Bias)
            </h3>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3 lg:grid-cols-6">
              <div className="sm:col-span-2">
                <label className="mb-1 block text-[11px] text-slate-400">
                  Strategia Versionata
                </label>
                <select
                  value={btStrategyId}
                  onChange={(e) => setBtStrategyId(e.target.value)}
                  className="w-full rounded-lg border border-slate-700 bg-anthracite-900 px-3 py-2 text-xs text-white"
                >
                  {VERSIONED_STRATEGIES.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name} (v{s.version})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="mb-1 block text-[11px] text-slate-400">Strumento</label>
                <select
                  value={btInstrumentId}
                  onChange={(e) => setBtInstrumentId(e.target.value)}
                  className="w-full rounded-lg border border-slate-700 bg-anthracite-900 px-3 py-2 text-xs text-white"
                >
                  {instruments.map((inst) => (
                    <option key={inst.id} value={inst.id}>
                      {inst.ticker}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="mb-1 block text-[11px] text-slate-400">
                  Capitale Iniziale
                </label>
                <input
                  type="number"
                  value={btInitialCapital}
                  onChange={(e) => setBtInitialCapital(e.target.value)}
                  className="w-full rounded-lg border border-slate-700 bg-anthracite-900 px-3 py-2 text-xs text-white"
                />
              </div>

              <div>
                <label className="mb-1 block text-[11px] text-slate-400">
                  Spread + Slip (bps)
                </label>
                <div className="flex gap-1">
                  <input
                    type="number"
                    value={btSpreadBps}
                    onChange={(e) => setBtSpreadBps(e.target.value)}
                    className="w-1/2 rounded-lg border border-slate-700 bg-anthracite-900 px-2 py-2 text-xs text-white"
                  />
                  <input
                    type="number"
                    value={btSlippageBps}
                    onChange={(e) => setBtSlippageBps(e.target.value)}
                    className="w-1/2 rounded-lg border border-slate-700 bg-anthracite-900 px-2 py-2 text-xs text-white"
                  />
                </div>
              </div>

              <div className="flex items-end">
                <button
                  type="submit"
                  disabled={runningBt}
                  data-testid="run-backtest-btn"
                  className="flex w-full items-center justify-center gap-1.5 rounded-xl bg-brand-500 py-2 text-xs font-bold text-anthracite-950 hover:bg-brand-400"
                >
                  <Play className="h-3.5 w-3.5" />
                  {runningBt ? 'Calcolo...' : 'Esegui Backtest'}
                </button>
              </div>
            </div>

            {btError && (
              <div className="mt-3 rounded-lg bg-red-500/10 p-3 text-xs text-red-300">
                {btError}
              </div>
            )}
          </form>

          {btResult && (
            <div className="space-y-6">
              {/* Metriche e Presidi Anti-Bias */}
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-4 lg:grid-cols-7">
                <div className="rounded-xl border border-slate-800 bg-anthracite-850 p-3.5">
                  <div className="text-[10px] uppercase text-slate-400">Rendimento Strategia</div>
                  <div
                    className={`num-mono mt-1 text-lg font-bold ${
                      btResult.totalReturnPct >= 0 ? 'text-emerald-400' : 'text-red-400'
                    }`}
                  >
                    {btResult.totalReturnPct >= 0 ? '+' : ''}
                    {btResult.totalReturnPct}%
                  </div>
                </div>

                <div className="rounded-xl border border-slate-800 bg-anthracite-850 p-3.5">
                  <div className="text-[10px] uppercase text-slate-400">Benchmark Buy&Hold</div>
                  <div className="num-mono mt-1 text-lg font-bold text-sky-400">
                    {btResult.benchmarkBuyHoldReturnPct >= 0 ? '+' : ''}
                    {btResult.benchmarkBuyHoldReturnPct}%
                  </div>
                </div>

                <div className="rounded-xl border border-slate-800 bg-anthracite-850 p-3.5">
                  <div className="text-[10px] uppercase text-slate-400">Operazioni & Win Rate</div>
                  <div className="num-mono mt-1 text-lg font-bold text-white">
                    {btResult.totalTrades} ({btResult.winRatePct}%)
                  </div>
                </div>

                <div className="rounded-xl border border-slate-800 bg-anthracite-850 p-3.5">
                  <div className="text-[10px] uppercase text-slate-400">Profit Factor & R/R</div>
                  <div className="num-mono mt-1 text-lg font-bold text-white">
                    PF: {btResult.profitFactor} | R/R: {btResult.riskRewardRatio}
                  </div>
                </div>

                <div className="rounded-xl border border-slate-800 bg-anthracite-850 p-3.5">
                  <div className="text-[10px] uppercase text-slate-400">Max Drawdown</div>
                  <div className="num-mono mt-1 text-lg font-bold text-red-400">
                    -{btResult.maxDrawdownPct}%
                  </div>
                </div>

                <div className="rounded-xl border border-slate-800 bg-anthracite-850 p-3.5">
                  <div className="text-[10px] uppercase text-slate-400">In-Sample (70%)</div>
                  <div className="num-mono mt-1 text-lg font-bold text-slate-200">
                    {btResult.inSampleReturnPct}%
                  </div>
                </div>

                <div className="rounded-xl border border-slate-800 bg-anthracite-850 p-3.5">
                  <div className="text-[10px] uppercase text-slate-400">Out-Of-Sample (30%)</div>
                  <div className="num-mono mt-1 text-lg font-bold text-brand-400">
                    {btResult.outOfSampleReturnPct}%
                  </div>
                </div>
              </div>

              {/* Grafico Equity Curve vs Benchmark */}
              <div className="rounded-2xl border border-slate-800 bg-anthracite-850 p-5">
                <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <TrendingUp className="h-4 w-4 text-brand-400" />
                    <h4 className="text-xs font-bold uppercase text-slate-200">
                      Curva di Equity Strategia vs Benchmark Buy & Hold (Split OOS:{' '}
                      {btResult.inSampleSplitDate.slice(0, 10)})
                    </h4>
                  </div>
                  <div className="flex flex-wrap gap-2 text-[11px] text-emerald-400">
                    <span className="inline-flex items-center gap-1">
                      <CheckCircle2 className="h-3.5 w-3.5" /> Zero Look-Ahead (Esecuzione a Open t+1)
                    </span>
                    <span className="inline-flex items-center gap-1">
                      <CheckCircle2 className="h-3.5 w-3.5" /> Solo Candele Chiuse ({btResult.candlesCount})
                    </span>
                  </div>
                </div>

                <div className="h-72 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={btResult.equityCurve}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                      <XAxis dataKey="time" stroke="#64748b" fontSize={11} />
                      <YAxis stroke="#64748b" fontSize={11} domain={['auto', 'auto']} />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: '#0d0f12',
                          borderColor: '#1e293b',
                          fontSize: '12px',
                        }}
                      />
                      <Legend />
                      <Line
                        type="monotone"
                        dataKey="strategyEquity"
                        name="Strategia (Netto Costi)"
                        stroke="#10b981"
                        strokeWidth={2}
                        dot={false}
                      />
                      <Line
                        type="monotone"
                        dataKey="benchmarkEquity"
                        name="Benchmark Buy & Hold"
                        stroke="#38bdf8"
                        strokeWidth={1.5}
                        dot={false}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* TAB 3: TRADING JOURNAL */}
      {activeTab === 'JOURNAL' && (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          <form
            onSubmit={handleAddJournal}
            className="space-y-3 rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-anthracite-850"
          >
            <div className="flex items-center gap-2">
              <BookOpen className="h-4 w-4 text-brand-400" />
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                Nuova Annotazione nel Trading Journal
              </h3>
            </div>

            <div>
              <label className="mb-1 block text-xs text-slate-400">Titolo Annotazione</label>
              <input
                type="text"
                required
                value={jTitle}
                onChange={(e) => setJTitle(e.target.value)}
                placeholder="Es. Analisi post-operazione su AAPL..."
                className="w-full rounded-lg border border-slate-700 bg-anthracite-900 px-3 py-2 text-xs text-white"
              />
            </div>

            <div>
              <label className="mb-1 block text-xs text-slate-400">Ipotesi Iniziale & Setup</label>
              <textarea
                rows={3}
                required
                value={jHypothesis}
                onChange={(e) => setJHypothesis(e.target.value)}
                placeholder="Quali condizioni quantitative giustificavano lo scenario?"
                className="w-full rounded-lg border border-slate-700 bg-anthracite-900 p-2.5 text-xs text-white"
              />
            </div>

            <div>
              <label className="mb-1 block text-xs text-slate-400">Esito & Revisione</label>
              <textarea
                rows={2}
                value={jOutcome}
                onChange={(e) => setJOutcome(e.target.value)}
                placeholder="Come si è comportato il mercato rispetto all'invalidazione?"
                className="w-full rounded-lg border border-slate-700 bg-anthracite-900 p-2.5 text-xs text-white"
              />
            </div>

            <div>
              <label className="mb-1 block text-xs text-slate-400">Lezioni Apprese</label>
              <input
                type="text"
                value={jLessons}
                onChange={(e) => setJLessons(e.target.value)}
                placeholder="Regola da mantenere per le prossime analisi..."
                className="w-full rounded-lg border border-slate-700 bg-anthracite-900 px-3 py-2 text-xs text-white"
              />
            </div>

            <button
              type="submit"
              className="w-full rounded-xl bg-brand-500 py-2.5 text-xs font-bold text-anthracite-950 hover:bg-brand-400"
            >
              Registra nel Diario di Ricerca
            </button>
          </form>

          <div className="space-y-3 lg:col-span-2">
            {journalEntries.map((entry) => (
              <div
                key={entry.id}
                className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-anthracite-850"
              >
                <div className="flex items-center justify-between">
                  <h4 className="text-sm font-bold text-slate-900 dark:text-white">
                    {entry.title}
                  </h4>
                  <span className="font-mono text-[11px] text-slate-500">
                    {entry.createdAt.slice(0, 10)}
                  </span>
                </div>
                <p className="mt-2 text-xs text-slate-300">
                  <strong>Ipotesi:</strong> {entry.hypothesis}
                </p>
                {entry.outcomeReview && (
                  <p className="mt-1 text-xs text-slate-400">
                    <strong>Revisione:</strong> {entry.outcomeReview}
                  </p>
                )}
                {entry.lessonsLearned && (
                  <p className="mt-1 text-xs text-brand-400">
                    <strong>Lezione:</strong> {entry.lessonsLearned}
                  </p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
