import React, { useState } from 'react';
import {
  AlertTriangle,
  Download,
  PieChart as PieChartIcon,
  Plus,
  Trash2,
  Upload,
  Wallet,
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
              Portfolio Tracker Manuale & Analisi Rischio
            </h1>
          </div>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            Contabilità multi-valuta precisa con conversioni ufficiali BCE (Frankfurter API). Nessuna connessione automatica non autorizzata ai tuoi conti broker.
          </p>
        </div>

        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setShowCsvImport(!showCsvImport)}
            className="flex items-center gap-1.5 rounded-xl border border-slate-300 bg-white px-3.5 py-2 text-xs font-semibold dark:border-slate-700 dark:bg-anthracite-900"
          >
            <Upload className="h-3.5 w-3.5 text-brand-400" />
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
        <div className="rounded-xl border border-amber-500/40 bg-amber-500/10 p-4 text-xs text-amber-300">
          <div className="flex items-center gap-2 font-bold">
            <AlertTriangle className="h-4 w-4 shrink-0" />
            <span>
              Avvisi di Rischio Portafoglio & Completezza Valutazione (Stato:{' '}
              {portfolioAnalytics.isValuationComplete ? 'COMPLETA' : 'VALUTAZIONE INCOMPLETA'})
            </span>
          </div>
          <ul className="mt-1.5 list-disc space-y-1 pl-5">
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
          className="rounded-2xl border border-slate-700 bg-anthracite-900 p-4 text-xs"
        >
          <div className="mb-2 font-bold text-brand-400">
            Importa Transazioni Portafoglio da CSV:
          </div>
          <textarea
            rows={3}
            value={csvContent}
            onChange={(e) => setCsvContent(e.target.value)}
            className="w-full rounded border border-slate-700 bg-anthracite-950 p-2 font-mono text-[11px] text-slate-200"
          />
          <div className="mt-2 flex items-center justify-between">
            <button
              type="submit"
              className="rounded-lg bg-brand-500 px-4 py-1.5 font-semibold text-anthracite-950"
            >
              Conferma Importazione CSV
            </button>
            {csvFeedback && <span className="text-emerald-400">{csvFeedback}</span>}
          </div>
        </form>
      )}

      {/* KPI Riepilogativi Portafoglio */}
      {portfolioAnalytics && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
          <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-anthracite-850">
            <div className="text-xs text-slate-400">Capitale Investito a Costo</div>
            <div className="num-mono mt-1 text-xl font-bold text-white">
              {portfolioAnalytics.totalInvestedCostInBase.toFixed(2)}{' '}
              {portfolioAnalytics.baseCurrency}
            </div>
            <div className="mt-1 text-[11px] text-slate-500">
              Liquidità: {portfolioAnalytics.cashBalanceInBase.toFixed(2)}{' '}
              {portfolioAnalytics.baseCurrency}
            </div>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-anthracite-850">
            <div className="text-xs text-slate-400">Controvalore Mercato Stimato</div>
            <div className="num-mono mt-1 text-xl font-bold text-brand-400">
              {portfolioAnalytics.estimatedMarketValueInBase.toFixed(2)}{' '}
              {portfolioAnalytics.baseCurrency}
            </div>
            <div className="mt-1 text-[11px] text-slate-500">
              Stato: {portfolioAnalytics.isValuationComplete ? 'Prezzi Verificati' : 'Parziale'}
            </div>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-anthracite-850">
            <div className="text-xs text-slate-400">P&L Non Realizzato</div>
            <div
              className={`num-mono mt-1 text-xl font-bold ${
                portfolioAnalytics.unrealizedPnlInBase >= 0
                  ? 'text-emerald-400'
                  : 'text-red-400'
              }`}
            >
              {portfolioAnalytics.unrealizedPnlInBase >= 0 ? '+' : ''}
              {portfolioAnalytics.unrealizedPnlInBase.toFixed(2)}{' '}
              {portfolioAnalytics.baseCurrency} ({portfolioAnalytics.unrealizedPnlPct.toFixed(2)}%)
            </div>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-anthracite-850">
            <div className="text-xs text-slate-400">P&L Realizzato & Dividendi</div>
            <div className="num-mono mt-1 text-sm font-bold text-white">
              Realizzato: {portfolioAnalytics.realizedPnlInBase.toFixed(2)}{' '}
              {portfolioAnalytics.baseCurrency}
            </div>
            <div className="num-mono mt-1 text-xs text-emerald-400">
              Dividendi/Cedole: +{portfolioAnalytics.totalDividendsInBase.toFixed(2)} | Costi:{' '}
              -{portfolioAnalytics.totalFeesPaidInBase.toFixed(2)}
            </div>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-anthracite-850">
            <div className="text-xs text-slate-400">Rischio Concentrazione (HHI)</div>
            <div className="num-mono mt-1 text-lg font-bold text-amber-400">
              {portfolioAnalytics.concentrationRisk.concentrationLevel}
            </div>
            <div className="mt-1 text-[11px] text-slate-500">
              HHI: {portfolioAnalytics.concentrationRisk.herfindahlIndex}/10000 (Top:{' '}
              {portfolioAnalytics.concentrationRisk.topPositionWeightPct}%)
            </div>
          </div>
        </div>
      )}

      {/* Registrazione Operazione Manuale & Posizioni */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <form
          onSubmit={handleAddTx}
          className="space-y-3 rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-anthracite-850"
        >
          <div className="flex items-center gap-2">
            <Plus className="h-4 w-4 text-brand-400" />
            <h3 className="text-sm font-bold text-slate-900 dark:text-white">
              Registra Operazione Manuale
            </h3>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="mb-1 block text-[11px] text-slate-400">Tipo Operazione</label>
              <select
                value={txType}
                onChange={(e) => setTxType(e.target.value as PortfolioTransactionType)}
                className="w-full rounded-lg border border-slate-700 bg-anthracite-900 px-2.5 py-2 text-xs text-white"
              >
                <option value="BUY">ACQUISTO (BUY)</option>
                <option value="SELL">VENDITA (SELL)</option>
                <option value="DIVIDEND">DIVIDENDO</option>
                <option value="COUPON">CEDOLA</option>
                <option value="FEE">COMMISSIONE</option>
                <option value="DEPOSIT">DEPOSITO LIQUIDITÀ</option>
                <option value="WITHDRAWAL">PRELIEVO LIQUIDITÀ</option>
              </select>
            </div>

            <div>
              <label className="mb-1 block text-[11px] text-slate-400">Broker Dichiarato</label>
              <select
                value={txBroker}
                onChange={(e) => setTxBroker(e.target.value)}
                className="w-full rounded-lg border border-slate-700 bg-anthracite-900 px-2.5 py-2 text-xs text-white"
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
              <label className="mb-1 block text-[11px] text-slate-400">Strumento</label>
              <select
                value={txInstrumentId}
                onChange={(e) => setTxInstrumentId(e.target.value)}
                className="w-full rounded-lg border border-slate-700 bg-anthracite-900 px-2.5 py-2 text-xs text-white"
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
              <label className="mb-1 block text-[11px] text-slate-400">Quantità</label>
              <input
                type="number"
                step="any"
                required
                value={txQuantity}
                onChange={(e) => setTxQuantity(e.target.value)}
                data-testid="portfolio-qty-input"
                className="w-full rounded-lg border border-slate-700 bg-anthracite-900 px-2.5 py-2 text-xs text-white"
              />
            </div>

            <div>
              <label className="mb-1 block text-[11px] text-slate-400">
                Prezzo / Importo
              </label>
              <input
                type="number"
                step="any"
                required
                value={txPrice}
                onChange={(e) => setTxPrice(e.target.value)}
                data-testid="portfolio-price-input"
                className="w-full rounded-lg border border-slate-700 bg-anthracite-900 px-2.5 py-2 text-xs text-white"
              />
            </div>

            <div>
              <label className="mb-1 block text-[11px] text-slate-400">Valuta</label>
              <select
                value={txCurrency}
                onChange={(e) => setTxCurrency(e.target.value)}
                className="w-full rounded-lg border border-slate-700 bg-anthracite-900 px-2 py-2 text-xs text-white"
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
              <label className="mb-1 block text-[11px] text-slate-400">
                Commissioni ({txCurrency})
              </label>
              <input
                type="number"
                step="any"
                value={txFees}
                onChange={(e) => setTxFees(e.target.value)}
                className="w-full rounded-lg border border-slate-700 bg-anthracite-900 px-2.5 py-2 text-xs text-white"
              />
            </div>
            <div>
              <label className="mb-1 block text-[11px] text-slate-400">Note</label>
              <input
                type="text"
                value={txNotes}
                onChange={(e) => setTxNotes(e.target.value)}
                placeholder="Opzionale..."
                className="w-full rounded-lg border border-slate-700 bg-anthracite-900 px-2.5 py-2 text-xs text-white"
              />
            </div>
          </div>

          <button
            type="submit"
            data-testid="portfolio-submit-tx-btn"
            className="w-full rounded-xl bg-brand-500 py-2.5 text-xs font-bold text-anthracite-950 hover:bg-brand-400"
          >
            Registra Operazione nel Portafoglio
          </button>
        </form>

        {/* Posizioni Attive & Allocazione */}
        <div className="space-y-6 lg:col-span-2">
          <div className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-anthracite-850">
            <h3 className="mb-3 text-sm font-bold text-slate-900 dark:text-white">
              Posizioni in Portafoglio & Conversioni Valutarie BCE
            </h3>

            {portfolioAnalytics && portfolioAnalytics.positions.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-slate-800 text-[11px] text-slate-400">
                      <th className="pb-2">Strumento / Broker</th>
                      <th className="pb-2 text-right">Q.tà</th>
                      <th className="pb-2 text-right">PMC Carico</th>
                      <th className="pb-2 text-right">Prezzo Attuale</th>
                      <th className="pb-2 text-right">Valore (EUR)</th>
                      <th className="pb-2 text-right">P&L (EUR)</th>
                      <th className="pb-2 text-right">Peso %</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60">
                    {portfolioAnalytics.positions.map((pos) => (
                      <tr key={`${pos.instrumentId}_${pos.declaredBrokerCode}`}>
                        <td className="py-2.5">
                          <div className="font-bold text-white">{pos.ticker}</div>
                          <div className="text-[10px] text-slate-500">
                            {pos.declaredBrokerCode} • FX: {pos.fxRateToBase} ({pos.fxSource})
                          </div>
                        </td>
                        <td className="num-mono py-2.5 text-right">{pos.quantity}</td>
                        <td className="num-mono py-2.5 text-right">
                          {pos.averageCostPrice} {pos.costCurrency}
                        </td>
                        <td className="num-mono py-2.5 text-right">
                          {pos.currentMarketPrice !== null
                            ? `${pos.currentMarketPrice} ${pos.quoteCurrency}`
                            : 'Non disp.'}
                        </td>
                        <td className="num-mono py-2.5 text-right font-semibold text-white">
                          {pos.estimatedMarketValueInBase !== null
                            ? `${pos.estimatedMarketValueInBase.toFixed(2)} €`
                            : 'Incompleto'}
                        </td>
                        <td
                          className={`num-mono py-2.5 text-right font-bold ${
                            (pos.unrealizedPnlInBase ?? 0) >= 0
                              ? 'text-emerald-400'
                              : 'text-red-400'
                          }`}
                        >
                          {pos.unrealizedPnlInBase !== null
                            ? `${pos.unrealizedPnlInBase >= 0 ? '+' : ''}${pos.unrealizedPnlInBase.toFixed(2)} € (${pos.unrealizedPnlPct?.toFixed(2)}%)`
                            : '—'}
                        </td>
                        <td className="num-mono py-2.5 text-right">
                          {pos.allocationWeightPct}%
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="text-xs text-slate-500">Nessuna posizione attiva.</p>
            )}
          </div>

          {/* Grafico Allocazione per Asset Class e Valuta */}
          {portfolioAnalytics && portfolioAnalytics.assetClassAllocation.length > 0 && (
            <div className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-anthracite-850">
              <div className="mb-3 flex items-center gap-2">
                <PieChartIcon className="h-4 w-4 text-brand-400" />
                <h4 className="text-xs font-bold uppercase text-slate-300">
                  Allocazione per Classe d'Investimento & Esposizione Valutaria
                </h4>
              </div>
              <div className="h-48 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={portfolioAnalytics.assetClassAllocation}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                    <XAxis dataKey="assetClass" stroke="#94a3b8" fontSize={11} />
                    <YAxis stroke="#94a3b8" fontSize={11} />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: '#0d0f12',
                        borderColor: '#1e293b',
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
      <div className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-anthracite-850">
        <h3 className="mb-3 text-sm font-bold text-slate-900 dark:text-white">
          Storico Movimenti Contabili ({portfolioTransactions.length})
        </h3>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-slate-800 text-[11px] text-slate-400">
                <th className="pb-2">Data</th>
                <th className="pb-2">Tipo</th>
                <th className="pb-2">Strumento</th>
                <th className="pb-2 text-right">Quantità</th>
                <th className="pb-2 text-right">Prezzo Unitario</th>
                <th className="pb-2 text-right">Commissioni</th>
                <th className="pb-2">Broker</th>
                <th className="pb-2 text-right">Azioni</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {portfolioTransactions.map((tx) => (
                <tr key={tx.id}>
                  <td className="py-2 font-mono text-[11px] text-slate-400">
                    {tx.executedAt.slice(0, 10)}
                  </td>
                  <td className="py-2 font-bold text-brand-400">{tx.transactionType}</td>
                  <td className="py-2">{tx.instrumentTicker || 'Liquidità'}</td>
                  <td className="num-mono py-2 text-right">{tx.quantity}</td>
                  <td className="num-mono py-2 text-right">
                    {tx.unitPrice} {tx.currency}
                  </td>
                  <td className="num-mono py-2 text-right">
                    {tx.fees} {tx.currency}
                  </td>
                  <td className="py-2 text-slate-400">{tx.declaredBrokerCode}</td>
                  <td className="py-2 text-right">
                    <button
                      type="button"
                      onClick={() => deletePortfolioTransaction(tx.id)}
                      className="text-slate-500 hover:text-red-400"
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
