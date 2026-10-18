import React from 'react';
import {
  Activity,
  Bell,
  BookOpen,
  FlaskConical,
  HelpCircle,
  Server,
  Settings,
  ShieldCheck,
  Sliders,
} from 'lucide-react';
import { useDemInvest } from '../context/DemInvestContext';

interface MoreViewProps {
  onNavigateTab: (tab: string) => void;
}

export const MoreView: React.FC<MoreViewProps> = ({ onNavigateTab }) => {
  const { notifications, schedulerStatus, providersHealth } = useDemInvest();
  const unreadCount = notifications.filter((n) => n.deliveryStatus !== 'READ').length;

  const sections = [
    {
      id: 'lab',
      testId: 'nav-lab',
      title: 'Trading Lab & Ricerca',
      description: 'Simulatore paper trading, backtest storico di strategie e diario operativo con revisione emotiva.',
      icon: FlaskConical,
      badgeText: 'Simulazione isolata',
      badgeClass: 'bg-teal-500/10 text-teal-600 dark:text-teal-400',
    },
    {
      id: 'notifications',
      testId: 'nav-notifications',
      title: 'Centro Notifiche & Alert',
      description: 'Regole personalizzate di avviso su prezzi e regimi, sottoscrizioni Web Push VAPID e storico eventi.',
      icon: Bell,
      badgeText: unreadCount > 0 ? `${unreadCount} non lette` : undefined,
      badgeClass: 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 font-bold',
    },
    {
      id: 'settings',
      testId: 'nav-settings',
      title: 'Impostazioni & Profilo',
      description: 'Preferenze visive (Semplice/PRO, tema), valuta di conto, mappature broker e credenziali riservate.',
      icon: Settings,
    },
  ];

  return (
    <div className="space-y-6">
      {/* Header Sezione Altro */}
      <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-slate-900 dark:text-white sm:text-2xl">
            Altre Risorse & Strumenti
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Laboratorio quantitativo, gestione avvisi, preferenze personali e stato dei servizi.
          </p>
        </div>
      </div>

      {/* Grid delle aree secondarie */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {sections.map((sec) => {
          const Icon = sec.icon;
          return (
            <button
              key={sec.id}
              type="button"
              data-testid={sec.testId}
              onClick={() => onNavigateTab(sec.id)}
              className="group flex flex-col justify-between rounded-2xl border border-slate-200/90 bg-white p-5 text-left shadow-sm transition hover:border-teal-500/50 hover:shadow-md dark:border-navy-800/80 dark:bg-navy-900/90 dark:hover:border-teal-500/40"
            >
              <div>
                <div className="flex items-center justify-between">
                  <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-teal-500/10 text-teal-600 transition group-hover:scale-105 dark:bg-teal-500/15 dark:text-teal-400">
                    <Icon className="h-5 w-5" aria-hidden="true" />
                  </div>
                  {sec.badgeText && (
                    <span className={`rounded-full px-2.5 py-0.5 text-[11px] ${sec.badgeClass}`}>
                      {sec.badgeText}
                    </span>
                  )}
                </div>
                <h2 className="mt-4 text-base font-bold text-slate-900 group-hover:text-teal-600 dark:text-white dark:group-hover:text-teal-400">
                  {sec.title}
                </h2>
                <p className="mt-1.5 text-xs leading-relaxed text-slate-500 dark:text-slate-400">
                  {sec.description}
                </p>
              </div>
              <div className="mt-4 flex items-center gap-1 text-xs font-semibold text-teal-600 dark:text-teal-400">
                <span>Accedi</span>
                <span className="transition-transform group-hover:translate-x-1">&rarr;</span>
              </div>
            </button>
          );
        })}
      </div>

      {/* Scheda Diagnostica Provider & Stato Servizi */}
      <div className="rounded-2xl border border-slate-200/90 bg-white p-5 shadow-sm dark:border-navy-800/80 dark:bg-navy-900/90">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-100 text-slate-600 dark:bg-navy-850 dark:text-slate-300">
              <Server className="h-4 w-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-slate-900 dark:text-white">
                Stato Connessioni & Provider Finanziari
              </h2>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                Audit automatico continuo su CoinGecko, Yahoo Finance, Frankfurter e VAPID Web Push.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => onNavigateTab('settings')}
            className="text-xs font-semibold text-teal-600 hover:underline dark:text-teal-400"
          >
            Gestisci credenziali &rarr;
          </button>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div className="rounded-xl border border-slate-200/80 bg-slate-50/70 p-3 dark:border-navy-800/70 dark:bg-navy-850/60">
            <div className="text-[11px] font-medium text-slate-500">Scheduler Backend</div>
            <div className="mt-1 flex items-center gap-1.5 text-xs font-bold text-slate-900 dark:text-white">
              <span className={`h-2 w-2 rounded-full ${schedulerStatus?.mode === 'ACTIVE_BACKEND_CRON' ? 'bg-emerald-500 animate-pulse' : 'bg-slate-400'}`} />
              {schedulerStatus?.mode === 'ACTIVE_BACKEND_CRON' ? 'Operativo' : 'Sospeso'}
            </div>
          </div>

          <div className="rounded-xl border border-slate-200/80 bg-slate-50/70 p-3 dark:border-navy-800/70 dark:bg-navy-850/60">
            <div className="text-[11px] font-medium text-slate-500">Budget Chiamate API</div>
            <div className="mt-1 text-xs font-bold text-slate-900 dark:text-white">
              {schedulerStatus?.dailyApiCallsUsed ?? 0} / {schedulerStatus?.dailyApiBudget ?? 500}
            </div>
          </div>

          <div className="rounded-xl border border-slate-200/80 bg-slate-50/70 p-3 dark:border-navy-800/70 dark:bg-navy-850/60">
            <div className="text-[11px] font-medium text-slate-500">Feed Crypto Spot</div>
            <div className="mt-1 text-xs font-bold text-emerald-600 dark:text-emerald-400">
              CoinGecko API (Attivo)
            </div>
          </div>

          <div className="rounded-xl border border-slate-200/80 bg-slate-50/70 p-3 dark:border-navy-800/70 dark:bg-navy-850/60">
            <div className="text-[11px] font-medium text-slate-500">Tassi di Cambio Valute</div>
            <div className="mt-1 text-xs font-bold text-emerald-600 dark:text-emerald-400">
              BCE / Frankfurter (Sincronizzato)
            </div>
          </div>
        </div>
      </div>

      {/* Principi Fondamentali & Sicurezza */}
      <div className="rounded-2xl border border-slate-200/90 bg-slate-50/70 p-5 dark:border-navy-800/80 dark:bg-navy-850/40">
        <div className="flex items-start gap-3">
          <ShieldCheck className="h-5 w-5 shrink-0 text-teal-600 dark:text-teal-400" />
          <div className="text-xs leading-relaxed text-slate-600 dark:text-slate-300">
            <div className="font-bold text-slate-900 dark:text-white">
              Garanzia di Trasparenza DemInvest
            </div>
            <p className="mt-1">
              DemInvest non è una piattaforma di trading automatizzato e non riceve né trasmette ordini verso intermediari. Tutte le decisioni operative restano sotto il controllo manuale e consapevole dell'investitore.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
