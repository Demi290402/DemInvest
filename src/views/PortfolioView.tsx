import React, { useState } from 'react';
import {
  AlertTriangle,
  Download,
  PieChart as PieChartIcon,
  Plus,
  Trash2,
  Upload,
  Wallet,
  CheckCircle2,
  Info,
} from 'lucide-react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { useDemInvest } from '../context/DemInvestContext';
import { exportPortfolioTransactionsCsv } from '../engines/portfolioEngine';
import { PortfolioTransactionType } from '../types/domain';
import {
  formatFinancialCurrency,
  formatFinancialPercent,
  translateConcentrationLevel,
} from '../lib/financialSemantics';

export const PortfolioView: React.FC = () => {
  const {
    instruments,
    portfolioTransactions,
    portfolioAnalytics,
    addPortfolioTransaction,
    deletePortfolioTransaction,
    importPortfolioCsv,
  } = useDemInvest();

  const [txType, setTxType] = useState<PortfolioTransactionType>('BUY');
  const [txInstrumentId, setTxInstrumentId] = useState('INST_BTC_USD_SPOT');
  const [txQuantity, setTxQuantity] = useState('1');
  const [txPrice, setTxPrice] = useState('100');
  const [txFees, setTxFees] = useState('1.00');
  const [txCurrency, setTxCurrency] = useState('EUR');
  const [txBroker, setTxBroker] = useState('TRADE_REPUBLIC');
  const [txNotes, setTxNotes] = useState('');

  const [showCsvImport, setShowCsvImport] = useState(false);
  const [csvContent, setCsvContent] = useState(
    'id,instrument_id,ticker,transaction_type,quantity,unit_price,fees,currency,fx_rate_to_base,fx_source,declared_broker_code,executed_at,notes\nTX_CSV_1,INST_IBM_XNYS_EQ,IBM,BUY,5,230.00,1.00,USD,0.89,BCE_FRANKFURTER,IBKR,2026-10-10T14:30:00Z,"Acquisto IBM da CSV"'
  );
  const [csvFeedback, setCsvFeedback] = useState<string | null>(null);

  const handleAddTx = async (e: React.FormEvent) => {
    e.preventDefault();
    const isCashOnly = txType === 'DEPOSIT' || txType === 'WITHDRAWAL';
    await addPortfolioTransaction({
      instrumentId: isCashOnly ? undefined : txInstrumentId,
      transactionType: txType,
      quantity: isCashOnly ? 1 : Number(txQuantity),
      unitPrice: Number(txPrice),
      fees: Number(txFees || 0),
      currency: txCurrency,
      declaredBrokerCode: txBroker,
      executedAt: new Date().toISOString(),
      notes: txNotes,
    });
    setTxNotes('');
  };

  const handleDownloadCsv = () => {
    const csv = exportPortfolioTransactionsCsv(portfolioTransactions);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `deminvest-portfolio-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImportCsv = async (e: React.FormEvent) => {
    e.preventDefault();
    const res = await importPortfolioCsv(csvContent);
    if (res.errors.length > 0) {
      setCsvFeedback(`Importate: ${res.importedCount}. Errori: ${res.errors.join('; ')}`);
    } else {
      setCsvFeedback(`Importate con successo ${res.importedCount} operazioni.`);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header Portafoglio & Azioni CSV */}
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-anthracite-850">
        <div>
          <div className="flex items-center gap-2">
            <Wallet className="h-5 w-5 text-brand-500" />
            <h1 className="text-lg font-bold text-slate-900 dark:text-white">
              Portfolio Tracker Manuale & Rischio
            </h1>
          </div>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            Contabilità multi-valuta con conversioni ufficiali BCE (Frankfurter API). I tuoi dati rimangono riservati e memorizzati solo nel tuo account protetto.
          </p>
        </div>

        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setShowCsvImport(!showCsvImport)}
            className="flex items-center gap-1.5 rounded-xl border border-slate-300 bg-slate-50 px-3.5 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:bg-anthracite-900 dark:text-slate-200 dark:hover:bg-anthracite-800"
          >
            <Upload className="h-3.5 w-3.5 text-brand-500" />
            Importa CSV
          </button>
          <button
            type="button"
            onClick={handleDownloadCsv}
            className="flex items-center gap-1.5 rounded-xl bg-brand-500 px-3.5 py-2 text-xs font-semibold text-anthracite-950 hover:bg-brand-400"
          >
            <Download className="h-3.5 w-3.5" />
            Esporta CSV
          </button>
        </div>
      </div>

      {/* Avviso Valutazione Incompleta o Concentrazione */}
      {portfolioAnalytics && portfolioAnalytics.concentrationRisk.warnings.length > 0 && (
        <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 text-xs text-amber-800 dark:text-amber-300">
          <div className="flex items-center gap-2 font-bold">
            <AlertTriangle className="h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" />
            <span>
              {portfolioAnalytics.isValuationComplete
                ? 'Avvisi sul Profilo di Rischio e Concentrazione'
                : 'Valutazione Parziale delle Posizioni in Portafoglio'}
            </span>
          </div>
          <ul className="mt-1.5 list-disc space-y-1 pl-5 text-slate-700 dark:text-slate-300">
            {portfolioAnalytics.concentrationRisk.warnings.map((w, i) => (
              <li key={i}>{w}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Box Importazione CSV Portafoglio */}
      {showCsvImport && (
        <form
          onSubmit={handleImportCsv}
          className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-xs dark:border-slate-700 dark:bg-anthracite-900"
        >
          <div className="mb-2 font-bold text-brand-500">
            Importa Transazioni Portafoglio da CSV:
          </div>
          <textarea
            rows={3}
            value={csvContent}
            onChange={(e) => setCsvContent(e.target.value)}
            className="w-full rounded border border-slate-300 bg-white p-2 font-mono text-[11px] text-slate-900 dark:border-slate-700 dark:bg-anthracite-950 dark:text-slate-200"
          />
          <div className="mt-2 flex items-center justify-between">
            <button
              type="submit"
              className="rounded-lg bg-brand-500 px-4 py-1.5 font-semibold text-anthracite-950 hover:bg-brand-400"
            >
              Conferma Importazione CSV
            </button>
            {csvFeedback && <span className="text-emerald-600 dark:text-emerald-400 font-medium">{csvFeedback}</span>}
          </div>
        </form>
      )}

      {/* KPI Riepilogativi Portafoglio */}
      {portfolioAnalytics && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
          <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-anthracite-850">
            <div className="text-xs text-slate-500 dark:text-slate-400">Capitale a Costo</div>
            <div className="num-mono mt-1 text-xl font-bold text-slate-900 dark:text-white">
              {formatFinancialCurrency(portfolioAnalytics.totalInvestedCostInBase, portfolioAnalytics.baseCurrency)}
            </div>
            <div className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">
              Liquidità: {formatFinancialCurrency(portfolioAnalytics.cashBalanceInBase, portfolioAnalytics.baseCurrency)}
            </div>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-anthracite-850">
            <div className="text-xs text-slate-500 dark:text-slate-400">Controvalore Stimato</div>
            <div className="num-mono mt-1 text-xl font-bold text-brand-600 dark:text-brand-400">
              {formatFinancialCurrency(portfolioAnalytics.estimatedMarketValueInBase, portfolioAnalytics.baseCurrency)}
            </div>
            <div className="mt-1 flex items-center gap-1 text-[11px] text-slate-500 dark:text-slate-400">
              {portfolioAnalytics.isValuationComplete ? (
                <span className="inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-400">
                  <CheckCircle2 className="h-3 w-3" /> Quotazioni verificate
                </span>
              ) : (
                <span className="text-amber-600 dark:text-amber-400">
                  Parziale (prezzi di carico inclusi)
                </span>
              )}
            </div>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-anthracite-850">
            <div className="text-xs text-slate-500 dark:text-slate-400">P&L Non Realizzato</div>
            <div
              className={`num-mono mt-1 text-xl font-bold ${
                portfolioAnalytics.unrealizedPnlInBase >= 0
                  ? 'text-emerald-600 dark:text-emerald-400'
                  : 'text-rose-600 dark:text-red-400'
              }`}
            >
              {formatFinancialCurrency(portfolioAnalytics.unrealizedPnlInBase, portfolioAnalytics.baseCurrency, { showPlus: true })}
              <span className="text-xs font-semibold ml-1">
                ({formatFinancialPercent(portfolioAnalytics.unrealizedPnlPct, { showPlus: true })})
              </span>
            </div>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-anthracite-850">
            <div className="text-xs text-slate-500 dark:text-slate-400">P&L Realizzato & Flussi</div>
            <div className="num-mono mt-1 text-sm font-bold text-slate-900 dark:text-white">
              Realizzato: {formatFinancialCurrency(portfolioAnalytics.realizedPnlInBase, portfolioAnalytics.baseCurrency, { showPlus: true })}
            </div>
            <div className="num-mono mt-1 text-xs text-emerald-600 dark:text-emerald-400">
              Cedole: +{formatFinancialCurrency(portfolioAnalytics.totalDividendsInBase, portfolioAnalytics.baseCurrency)}
            </div>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-anthracite-850">
            <div className="text-xs text-slate-500 dark:text-slate-400">Concentrazione (HHI)</div>
            <div className="mt-1 flex items-center gap-1.5">
              {(() => {
                const tr = translateConcentrationLevel(portfolioAnalytics.concentrationRisk.concentrationLevel);
                return (
                  <span className={`inline-block rounded px-2 py-0.5 text-xs font-bold ${tr.className}`}>
                    {tr.label}
                  </span>
                );
              })()}
            </div>
            <div className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">
              Indice HHI: {portfolioAnalytics.concentrationRisk.herfindahlIndex} / 10.000 (Top: {portfolioAnalytics.concentrationRisk.topPositionWeightPct}%)
            </div>
          </div>
        </div>
      )}

      {/* Registrazione Operazione Manuale & Posizioni */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <form
          onSubmit={handleAddTx}
          className="space-y-3 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-anthracite-850"
        >
          <div className="flex items-center gap-2">
            <Plus className="h-4 w-4 text-brand-500" />
            <h3 className="text-sm font-bold text-slate-900 dark:text-white">
              Registra Operazione Manuale
            </h3>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="mb-1 block text-[11px] font-medium text-slate-500 dark:text-slate-400">Tipo Operazione</label>
              <select
                value={txType}
                onChange={(e) => setTxType(e.target.value as PortfolioTransactionType)}
                className="w-full rounded-lg border border-slate-300 bg-slate-50 px-2.5 py-2 text-xs text-slate-900 dark:border-slate-700 dark:bg-anthracite-900 dark:text-white"
              >
                <option value="BUY">Acquisto (Buy)</option>
                <option value="SELL">Vendita (Sell)</option>
                <option value="DIVIDEND">Dividendo</option>
                <option value="COUPON">Cedola</option>
                <option value="FEE">Commissione</option>
                <option value="DEPOSIT">Deposito liquidità</option>
                <option value="WITHDRAWAL">Prelievo liquidità</option>
              </select>
            </div>

            <div>
              <label className="mb-1 block text-[11px] font-medium text-slate-500 dark:text-slate-400">Intermediario</label>
              <select
                value={txBroker}
                onChange={(e) => setTxBroker(e.target.value)}
                className="w-full rounded-lg border border-slate-300 bg-slate-50 px-2.5 py-2 text-xs text-slate-900 dark:border-slate-700 dark:bg-anthracite-900 dark:text-white"
              >
                <option value="TRADE_REPUBLIC">Trade Republic</option>
                <option value="IBKR">Interactive Brokers</option>
                <option value="AVATRADE">AvaTrade</option>
                <option value="MT5">MetaTrader 5</option>
              </select>
            </div>
          </div>

          {txType !== 'DEPOSIT' && txType !== 'WITHDRAWAL' && (
            <div>
              <label className="mb-1 block text-[11px] font-medium text-slate-500 dark:text-slate-400">Strumento</label>
              <select
                value={txInstrumentId}
                onChange={(e) => setTxInstrumentId(e.target.value)}
                className="w-full rounded-lg border border-slate-300 bg-slate-50 px-2.5 py-2 text-xs text-slate-900 dark:border-slate-700 dark:bg-anthracite-900 dark:text-white"
              >
                {instruments.map((inst) => (
                  <option key={inst.id} value={inst.id}>
                    {inst.ticker} — {inst.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div className="grid grid-cols-3 gap-2">
            <div>
              <label className="mb-1 block text-[11px] font-medium text-slate-500 dark:text-slate-400">Quantità</label>
              <input
                type="number"
                step="any"
                required
                value={txQuantity}
                onChange={(e) => setTxQuantity(e.target.value)}
                data-testid="portfolio-qty-input"
                className="w-full rounded-lg border border-slate-300 bg-slate-50 px-2.5 py-2 text-xs text-slate-900 dark:border-slate-700 dark:bg-anthracite-900 dark:text-white"
              />
            </div>

            <div>
              <label className="mb-1 block text-[11px] font-medium text-slate-500 dark:text-slate-400">
                Prezzo unitario
              </label>
              <input
                type="number"
                step="any"
                required
                value={txPrice}
                onChange={(e) => setTxPrice(e.target.value)}
                data-testid="portfolio-price-input"
                className="w-full rounded-lg border border-slate-300 bg-slate-50 px-2.5 py-2 text-xs text-slate-900 dark:border-slate-700 dark:bg-anthracite-900 dark:text-white"
              />
            </div>

            <div>
              <label className="mb-1 block text-[11px] font-medium text-slate-500 dark:text-slate-400">Valuta</label>
              <select
                value={txCurrency}
                onChange={(e) => setTxCurrency(e.target.value)}
                className="w-full rounded-lg border border-slate-300 bg-slate-50 px-2 py-2 text-xs text-slate-900 dark:border-slate-700 dark:bg-anthracite-900 dark:text-white"
              >
                <option value="EUR">EUR</option>
                <option value="USD">USD</option>
                <option value="GBP">GBP</option>
                <option value="CHF">CHF</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="mb-1 block text-[11px] font-medium text-slate-500 dark:text-slate-400">
                Commissioni ({txCurrency})
              </label>
              <input
                type="number"
                step="any"
                value={txFees}
                onChange={(e) => setTxFees(e.target.value)}
                className="w-full rounded-lg border border-slate-300 bg-slate-50 px-2.5 py-2 text-xs text-slate-900 dark:border-slate-700 dark:bg-anthracite-900 dark:text-white"
              />
            </div>
            <div>
              <label className="mb-1 block text-[11px] font-medium text-slate-500 dark:text-slate-400">Note</label>
              <input
                type="text"
                value={txNotes}
                onChange={(e) => setTxNotes(e.target.value)}
                placeholder="Es. Accumulo periodico..."
                className="w-full rounded-lg border border-slate-300 bg-slate-50 px-2.5 py-2 text-xs text-slate-900 dark:border-slate-700 dark:bg-anthracite-900 dark:text-white"
              />
            </div>
          </div>

          <button
            type="submit"
            data-testid="portfolio-submit-tx-btn"
            className="w-full rounded-xl bg-brand-500 py-2.5 text-xs font-bold text-anthracite-950 transition hover:bg-brand-400"
          >
            Registra operazione
          </button>
        </form>

        {/* Posizioni Attive & Allocazione */}
        <div className="space-y-6 lg:col-span-2">
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-anthracite-850">
            <h3 className="mb-3 text-sm font-bold text-slate-900 dark:text-white">
              Posizioni in Portafoglio
            </h3>

            {portfolioAnalytics && portfolioAnalytics.positions.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-slate-200 text-[11px] text-slate-500 dark:border-slate-800 dark:text-slate-400">
                      <th className="pb-2">Strumento</th>
                      <th className="pb-2 text-right">Q.tà</th>
                      <th className="pb-2 text-right">Prezzo medio</th>
                      <th className="pb-2 text-right">Prezzo live</th>
                      <th className="pb-2 text-right">Controvalore</th>
                      <th className="pb-2 text-right">P&L</th>
                      <th className="pb-2 text-right">Peso %</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
                    {portfolioAnalytics.positions.map((pos) => (
                      <tr key={`${pos.instrumentId}_${pos.declaredBrokerCode}`}>
                        <td className="py-2.5">
                          <div className="font-bold text-slate-900 dark:text-white">{pos.ticker}</div>
                          <div className="text-[10px] text-slate-500 dark:text-slate-400">
                            {pos.declaredBrokerCode} • Tasso BCE: {pos.fxRateToBase}
                          </div>
                        </td>
                        <td className="num-mono py-2.5 text-right font-medium text-slate-700 dark:text-slate-300">{pos.quantity}</td>
                        <td className="num-mono py-2.5 text-right text-slate-700 dark:text-slate-300">
                          {pos.averageCostPrice} {pos.costCurrency}
                        </td>
                        <td className="num-mono py-2.5 text-right text-slate-700 dark:text-slate-300">
                          {pos.currentMarketPrice !== null
                            ? `${pos.currentMarketPrice} ${pos.quoteCurrency}`
                            : 'Non disp.'}
                        </td>
                        <td className="num-mono py-2.5 text-right font-semibold text-slate-900 dark:text-white">
                          {pos.estimatedMarketValueInBase !== null
                            ? `${pos.estimatedMarketValueInBase.toFixed(2)} €`
                            : 'Incompleto'}
                        </td>
                        <td
                          className={`num-mono py-2.5 text-right font-bold ${
                            (pos.unrealizedPnlInBase ?? 0) >= 0
                              ? 'text-emerald-600 dark:text-emerald-400'
                              : 'text-rose-600 dark:text-red-400'
                          }`}
                        >
                          {pos.unrealizedPnlInBase !== null
                            ? `${pos.unrealizedPnlInBase >= 0 ? '+' : ''}${pos.unrealizedPnlInBase.toFixed(2)} € (${pos.unrealizedPnlPct?.toFixed(2)}%)`
                            : '—'}
                        </td>
                        <td className="num-mono py-2.5 text-right font-medium text-slate-700 dark:text-slate-300">
                          {pos.allocationWeightPct}%
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="text-xs text-slate-500 dark:text-slate-400">Nessuna posizione registrata. Inserisci una prima operazione con il modulo a sinistra.</p>
            )}
          </div>

          {/* Grafico Allocazione per Asset Class e Valuta */}
          {portfolioAnalytics && portfolioAnalytics.assetClassAllocation.length > 0 && (
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-anthracite-850">
              <div className="mb-3 flex items-center gap-2">
                <PieChartIcon className="h-4 w-4 text-brand-500" />
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                  Allocazione per Classe d'Investimento
                </h4>
              </div>
              <div className="h-48 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={portfolioAnalytics.assetClassAllocation}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#94a3b8" opacity={0.2} />
                    <XAxis dataKey="assetClass" stroke="#94a3b8" fontSize={11} />
                    <YAxis stroke="#94a3b8" fontSize={11} />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: '#0f172a',
                        borderColor: '#334155',
                        color: '#f8fafc',
                        borderRadius: '8px',
                        fontSize: '12px',
                      }}
                    />
                    <Bar dataKey="valueInBase" name="Controvalore (EUR)" fill="#10b981" radius={[6, 6, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Registro Storico Transazioni */}
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-anthracite-850">
        <h3 className="mb-3 text-sm font-bold text-slate-900 dark:text-white">
          Storico Movimenti ({portfolioTransactions.length})
        </h3>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-slate-200 text-[11px] text-slate-500 dark:border-slate-800 dark:text-slate-400">
                <th className="pb-2">Data</th>
                <th className="pb-2">Tipo</th>
                <th className="pb-2">Strumento</th>
                <th className="pb-2 text-right">Quantità</th>
                <th className="pb-2 text-right">Prezzo Unitario</th>
                <th className="pb-2 text-right">Commissioni</th>
                <th className="pb-2">Intermediario</th>
                <th className="pb-2 text-right">Azioni</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
              {portfolioTransactions.map((tx) => (
                <tr key={tx.id}>
                  <td className="py-2 font-mono text-[11px] text-slate-500 dark:text-slate-400">
                    {tx.executedAt.slice(0, 10)}
                  </td>
                  <td className="py-2 font-bold text-brand-600 dark:text-brand-400">{tx.transactionType}</td>
                  <td className="py-2 font-medium text-slate-900 dark:text-slate-200">{tx.instrumentTicker || 'Liquidità'}</td>
                  <td className="num-mono py-2 text-right text-slate-700 dark:text-slate-300">{tx.quantity}</td>
                  <td className="num-mono py-2 text-right text-slate-700 dark:text-slate-300">
                    {tx.unitPrice} {tx.currency}
                  </td>
                  <td className="num-mono py-2 text-right text-slate-700 dark:text-slate-300">
                    {tx.fees} {tx.currency}
                  </td>
                  <td className="py-2 text-slate-500 dark:text-slate-400">{tx.declaredBrokerCode}</td>
                  <td className="py-2 text-right">
                    <button
                      type="button"
                      onClick={() => deletePortfolioTransaction(tx.id)}
                      className="text-slate-400 hover:text-rose-500 transition"
                      title="Elimina movimento"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
