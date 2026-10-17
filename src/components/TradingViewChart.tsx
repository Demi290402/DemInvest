import React, { useEffect, useRef } from 'react';
import {
  ColorType,
  CrosshairMode,
  createChart,
  IChartApi,
  UTCTimestamp,
} from 'lightweight-charts';
import { AlertTriangle, BarChart3, ShieldAlert } from 'lucide-react';
import {
  HistoricalCandle,
  QuantitativeIndicatorsSnapshot,
  ThemeMode,
  UIMode,
} from '../types/domain';
import { sanitizeClosedCandles } from '../engines/quantitativeEngine';

interface TradingViewChartProps {
  candles: HistoricalCandle[];
  indicators: QuantitativeIndicatorsSnapshot | null;
  uiMode: UIMode;
  theme: ThemeMode;
  ticker: string;
  currency: string;
  providerName: string;
  isDemoData: boolean;
}

export const TradingViewChart: React.FC<TradingViewChartProps> = ({
  candles,
  indicators,
  uiMode,
  theme,
  ticker,
  currency,
  providerName,
  isDemoData,
}) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const chartInstanceRef = useRef<IChartApi | null>(null);

  const validCandles = sanitizeClosedCandles(candles);

  useEffect(() => {
    const container = containerRef.current;
    if (!container || validCandles.length === 0) return;

    const isDark = theme === 'DARK';
    const chart = createChart(container, {
      width: container.clientWidth,
      height: uiMode === 'PRO' ? 390 : 290,
      layout: {
        background: {
          type: ColorType.Solid,
          color: isDark ? '#121519' : '#ffffff',
        },
        textColor: isDark ? '#94a3b8' : '#475569',
      },
      grid: {
        vertLines: { color: isDark ? 'rgba(51, 65, 85, 0.25)' : 'rgba(226, 232, 240, 0.8)' },
        horzLines: { color: isDark ? 'rgba(51, 65, 85, 0.25)' : 'rgba(226, 232, 240, 0.8)' },
      },
      crosshair: {
        mode: CrosshairMode.Normal,
      },
      rightPriceScale: {
        borderColor: isDark ? '#1e293b' : '#cbd5e1',
      },
      timeScale: {
        borderColor: isDark ? '#1e293b' : '#cbd5e1',
        timeVisible: true,
      },
    });

    chartInstanceRef.current = chart;

    if (uiMode === 'PRO') {
      // Serie a Candele OHLC in Modalità PRO
      const candleSeries = chart.addCandlestickSeries({
        upColor: '#10b981',
        downColor: '#ef4444',
        borderUpColor: '#10b981',
        borderDownColor: '#ef4444',
        wickUpColor: '#10b981',
        wickDownColor: '#ef4444',
      });

      candleSeries.setData(
        validCandles.map((c) => ({
          time: c.time as UTCTimestamp,
          open: c.open,
          high: c.high,
          low: c.low,
          close: c.close,
        }))
      );

      // Sovrapposizione SMA(20)
      if (validCandles.length >= 20) {
        const sma20Series = chart.addLineSeries({
          color: '#38bdf8',
          lineWidth: 2,
          title: 'SMA 20',
        });
        const smaData: { time: UTCTimestamp; value: number }[] = [];
        for (let i = 19; i < validCandles.length; i++) {
          const slice = validCandles.slice(i - 19, i + 1);
          const avg = slice.reduce((a, b) => a + b.close, 0) / 20;
          smaData.push({
            time: validCandles[i].time as UTCTimestamp,
            value: +avg.toFixed(4),
          });
        }
        sma20Series.setData(smaData);
      }

      // Livelli di Supporto e Resistenza deterministici
      if (indicators) {
        for (const sup of indicators.supports.slice(0, 2)) {
          candleSeries.createPriceLine({
            price: sup.price,
            color: '#10b981',
            lineWidth: 1,
            lineStyle: 2,
            axisLabelVisible: true,
            title: `SUP (${sup.touches}x)`,
          });
        }
        for (const res of indicators.resistances.slice(0, 2)) {
          candleSeries.createPriceLine({
            price: res.price,
            color: '#f59e0b',
            lineWidth: 1,
            lineStyle: 2,
            axisLabelVisible: true,
            title: `RES (${res.touches}x)`,
          });
        }
      }
    } else {
      // Serie Area Semplificata in Modalità SEMPLICE
      const areaSeries = chart.addAreaSeries({
        lineColor: '#10b981',
        topColor: 'rgba(16, 185, 129, 0.28)',
        bottomColor: 'rgba(16, 185, 129, 0.02)',
        lineWidth: 2,
      });

      areaSeries.setData(
        validCandles.map((c) => ({
          time: c.time as UTCTimestamp,
          value: c.close,
        }))
      );
    }

    chart.timeScale().fitContent();

    const handleResize = () => {
      if (container && chartInstanceRef.current) {
        chartInstanceRef.current.applyOptions({ width: container.clientWidth });
      }
    };

    window.addEventListener('resize', handleResize);
    return () => {
      window.removeEventListener('resize', handleResize);
      chart.remove();
      chartInstanceRef.current = null;
    };
  }, [validCandles, indicators, uiMode, theme]);

  if (validCandles.length === 0) {
    return (
      <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-6 text-center">
        <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-amber-500/15 text-amber-400">
          <AlertTriangle className="h-6 w-6" />
        </div>
        <h4 className="text-sm font-semibold text-slate-800 dark:text-slate-100">
          Serie Storica Non Disponibile per {ticker} in Modalità LIVE
        </h4>
        <p className="mx-auto mt-1 max-w-xl text-xs leading-relaxed text-slate-600 dark:text-slate-400">
          Per la regola rigorosa di integrità dati (Sezione 29.2), DemInvest non genera mai grafici con dati inventati in modalità reale. Configura la chiave API del provider in{' '}
          <span className="font-semibold text-brand-500">Impostazioni &gt; Provider</span> oppure attiva esplicitamente la{' '}
          <span className="font-semibold text-amber-400">Modalità DEMO Didattica</span> nella barra superiore.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-anthracite-850">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <BarChart3 className="h-4 w-4 text-brand-500" />
          <span className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
            {uiMode === 'PRO'
              ? `Grafico Candele OHLC + SMA(20) + Frattali S/R — ${ticker} (${currency})`
              : `Andamento Storico Semplificato — ${ticker} (${currency})`}
          </span>
        </div>
        <div className="flex items-center gap-2 text-xs">
          {isDemoData && (
            <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/15 px-2.5 py-0.5 font-semibold text-amber-400">
              <ShieldAlert className="h-3.5 w-3.5" />
              DATI DEMO SIMULATI
            </span>
          )}
          <span className="rounded bg-slate-100 px-2 py-0.5 font-mono text-[11px] text-slate-600 dark:bg-slate-800 dark:text-slate-300">
            Fonte: {providerName} ({validCandles.length} barre chiuse)
          </span>
        </div>
      </div>

      <div ref={containerRef} className="w-full overflow-hidden rounded-lg" data-testid="tv-lightweight-chart" />

      {uiMode === 'PRO' && indicators && (
        <div className="mt-2 flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 pt-2 text-[11px] text-slate-500 dark:border-slate-800/80 dark:text-slate-400">
          <span>
            Algoritmo Supporti/Resistenze:{' '}
            <strong className="text-slate-700 dark:text-slate-300">
              PIVOT_FRACTAL_ATR_CLUSTER_V1
            </strong>
          </span>
          <span>
            Solo candele chiuse verificate (escluse candele parziali in corso)
          </span>
        </div>
      )}
    </div>
  );
};
