import React, { useState } from 'react';
import {
  CheckCircle2,
  Lock,
  ShieldCheck,
  Sparkles,
  TrendingUp,
  UserCheck,
} from 'lucide-react';
import { useDemInvest } from '../context/DemInvestContext';
import { AssetClass, TimeHorizon, UIMode } from '../types/domain';

export const AuthAndOnboardingView: React.FC = () => {
  const {
    singleUserMode,
    hasOwnerAccount,
    isAuthenticated,
    user,
    registerOwner,
    loginOwner,
    updateUserProfile,
    setUiMode,
  } = useDemInvest();

  const [email, setEmail] = useState('proprietario@deminvest.local');
  const [password, setPassword] = useState('DemInvest2026!');
  const [displayName, setDisplayName] = useState('Investitore Proprietario');
  const [authError, setAuthError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Onboarding state
  const [experienceLevel, setExperienceLevel] = useState<
    'BEGINNER' | 'INTERMEDIATE' | 'ADVANCED' | 'QUANT'
  >('INTERMEDIATE');
  const [riskTolerance, setRiskTolerance] = useState<
    'CONSERVATIVE' | 'MODERATE' | 'DYNAMIC'
  >('MODERATE');
  const [preferredCurrency, setPreferredCurrency] = useState<'EUR' | 'USD' | 'GBP' | 'CHF'>('EUR');
  const [selectedUiMode, setSelectedUiMode] = useState<UIMode>('SIMPLE');
  const [preferredHorizons, setPreferredHorizons] = useState<TimeHorizon[]>([
    'BREVE',
    'MEDIO',
    'LUNGO',
  ]);
  const [preferredMarkets, setPreferredMarkets] = useState<AssetClass[]>([
    'CRYPTO',
    'EQUITY',
    'ETF',
  ]);
  const [selectedBrokers, setSelectedBrokers] = useState<string[]>([
    'TRADE_REPUBLIC',
    'IBKR',
    'AVATRADE',
    'MT5',
  ]);

  const handleAuthSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError(null);
    setSubmitting(true);
    try {
      const res = hasOwnerAccount
        ? await loginOwner({ email, password })
        : await registerOwner({ email, password, displayName });
      if (!res.ok) {
        setAuthError(res.error || 'Autenticazione non riuscita');
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleCompleteOnboarding = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await setUiMode(selectedUiMode);
      await updateUserProfile({
        onboardingCompleted: true,
        experienceLevel,
        riskTolerance,
        preferredCurrency,
        uiMode: selectedUiMode,
        preferredHorizons,
        preferredMarkets,
        selectedBrokers,
      });
    } finally {
      setSubmitting(false);
    }
  };

  const toggleItem = <T extends string>(list: T[], val: T, setter: (v: T[]) => void) => {
    if (list.includes(val)) {
      if (list.length > 1) setter(list.filter((i) => i !== val));
    } else {
      setter([...list, val]);
    }
  };

  if (!isAuthenticated) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-anthracite-950 px-4 py-10 text-slate-100">
        <div className="w-full max-w-md rounded-2xl border border-slate-800 bg-anthracite-900 p-8 shadow-2xl">
          <div className="mb-6 flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-brand-500/15 text-brand-400 ring-1 ring-brand-500/30">
              <TrendingUp className="h-6 w-6" />
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-tight text-white">DemInvest</h1>
              <p className="text-xs font-medium text-brand-400">
                Personal Investment Intelligence
              </p>
            </div>
          </div>

          <div className="mb-6 rounded-xl border border-brand-500/25 bg-brand-500/5 p-3.5 text-xs text-slate-300">
            <div className="flex items-center gap-2 font-semibold text-brand-400">
              <ShieldCheck className="h-4 w-4 shrink-0" />
              <span>
                {singleUserMode
                  ? 'SINGLE_USER_MODE Attiva — Istanza Privata Protetta'
                  : 'Autenticazione Proprietaria'}
              </span>
            </div>
            <p className="mt-1 text-[11px] leading-relaxed text-slate-400">
              {hasOwnerAccount
                ? 'L\'account del proprietario è registrato. Le nuove registrazioni pubbliche sono bloccate. Effettua il login per accedere.'
                : 'Configura il primo e unico account proprietario autorizzato. Una volta registrato, eventuali registrazioni successive saranno bloccate.'}
            </p>
          </div>

          {authError && (
            <div className="mb-4 rounded-lg border border-red-500/40 bg-red-500/10 p-3 text-xs text-red-300">
              {authError}
            </div>
          )}

          <form onSubmit={handleAuthSubmit} className="space-y-4">
            {!hasOwnerAccount && (
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-300">
                  Nome o Identificativo Proprietario
                </label>
                <input
                  type="text"
                  required
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  className="w-full rounded-lg border border-slate-700 bg-anthracite-850 px-3.5 py-2.5 text-sm text-white focus:border-brand-500 focus:outline-none"
                />
              </div>
            )}

            <div>
              <label className="mb-1 block text-xs font-medium text-slate-300">
                Email Proprietario
              </label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full rounded-lg border border-slate-700 bg-anthracite-850 px-3.5 py-2.5 text-sm text-white focus:border-brand-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="mb-1 block text-xs font-medium text-slate-300">
                Password di Sicurezza (min. 8 caratteri)
              </label>
              <input
                type="password"
                required
                minLength={8}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full rounded-lg border border-slate-700 bg-anthracite-850 px-3.5 py-2.5 text-sm text-white focus:border-brand-500 focus:outline-none"
              />
            </div>

            <button
              type="submit"
              disabled={submitting}
              data-testid="auth-submit-button"
              className="flex w-full items-center justify-center gap-2 rounded-lg bg-brand-500 px-4 py-2.5 text-sm font-semibold text-anthracite-950 transition hover:bg-brand-400 disabled:opacity-50"
            >
              <Lock className="h-4 w-4" />
              {submitting
                ? 'Verifica crittografica in corso...'
                : hasOwnerAccount
                  ? 'Accedi a DemInvest'
                  : 'Registra Account Proprietario'}
            </button>
          </form>

          <p className="mt-5 text-center text-[11px] text-slate-500">
            DemInvest non richiede mai credenziali dei tuoi broker e non esegue ordini automatici.
          </p>
        </div>
      </div>
    );
  }

  // Se l'utente è autenticato ma non ha ancora completato l'onboarding
  if (user && !user.onboardingCompleted) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-anthracite-950 px-4 py-10 text-slate-100">
        <div className="w-full max-w-2xl rounded-2xl border border-slate-800 bg-anthracite-900 p-8 shadow-2xl">
          <div className="mb-6 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-500/15 text-brand-400">
                <UserCheck className="h-5 w-5" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-white">
                  Configurazione Profilo di Ricerca — Onboarding
                </h2>
                <p className="text-xs text-slate-400">
                  Personalizza modalità interfaccia, orizzonti, valuta e piattaforme dichiarate.
                </p>
              </div>
            </div>
            <span className="rounded-full bg-brand-500/15 px-3 py-1 text-xs font-semibold text-brand-400">
              Proprietario Verificato
            </span>
          </div>

          <form onSubmit={handleCompleteOnboarding} className="space-y-5">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-slate-400">
                  Modalità Interfaccia Iniziale
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {(['SIMPLE', 'PRO'] as UIMode[]).map((m) => (
                    <button
                      type="button"
                      key={m}
                      onClick={() => setSelectedUiMode(m)}
                      className={`rounded-lg border p-3 text-left text-xs transition ${
                        selectedUiMode === m
                          ? 'border-brand-500 bg-brand-500/15 text-white'
                          : 'border-slate-800 bg-anthracite-850 text-slate-400'
                      }`}
                    >
                      <div className="font-bold">
                        {m === 'SIMPLE' ? 'Modalità Semplice' : 'Modalità Pro'}
                      </div>
                      <div className="mt-0.5 text-[11px] opacity-80">
                        {m === 'SIMPLE'
                          ? 'Panoramica guidata e spiegazioni chiare'
                          : 'OHLCV, Screener, Multi-Timeframe e Quant'}
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-slate-400">
                  Esperienza Finanziaria & Valuta Base
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <select
                    value={experienceLevel}
                    onChange={(e) =>
                      setExperienceLevel(
                        e.target.value as 'BEGINNER' | 'INTERMEDIATE' | 'ADVANCED' | 'QUANT'
                      )
                    }
                    className="rounded-lg border border-slate-700 bg-anthracite-850 px-3 py-2 text-xs text-white"
                  >
                    <option value="BEGINNER">Base / Iniziale</option>
                    <option value="INTERMEDIATE">Intermedio</option>
                    <option value="ADVANCED">Avanzato</option>
                    <option value="QUANT">Quantitativo / Pro</option>
                  </select>

                  <select
                    value={preferredCurrency}
                    onChange={(e) =>
                      setPreferredCurrency(e.target.value as 'EUR' | 'USD' | 'GBP' | 'CHF')
                    }
                    className="rounded-lg border border-slate-700 bg-anthracite-850 px-3 py-2 text-xs text-white"
                  >
                    <option value="EUR">EUR (€) — Euro</option>
                    <option value="USD">USD ($) — US Dollar</option>
                    <option value="GBP">GBP (£) — Sterlina</option>
                    <option value="CHF">CHF (Fr) — Franco Svizzero</option>
                  </select>
                </div>

                <label className="mt-3 mb-1 block text-xs font-semibold uppercase tracking-wider text-slate-400">
                  Tolleranza Indicativa al Rischio
                </label>
                <select
                  value={riskTolerance}
                  onChange={(e) =>
                    setRiskTolerance(
                      e.target.value as 'CONSERVATIVE' | 'MODERATE' | 'DYNAMIC'
                    )
                  }
                  className="w-full rounded-lg border border-slate-700 bg-anthracite-850 px-3 py-2 text-xs text-white"
                >
                  <option value="CONSERVATIVE">Prudente (Focus conservazione e bassa volatilità)</option>
                  <option value="MODERATE">Equilibrata (Crescita con controllo drawdown)</option>
                  <option value="DYNAMIC">Dinamica (Accetta volatilità elevata su asset ciclici)</option>
                </select>
              </div>
            </div>

            <div>
              <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-slate-400">
                Orizzonti Temporali di Interesse
              </label>
              <div className="flex flex-wrap gap-2">
                {(['BREVISSIMO', 'BREVE', 'MEDIO', 'LUNGO'] as TimeHorizon[]).map((h) => (
                  <button
                    type="button"
                    key={h}
                    onClick={() =>
                      toggleItem(preferredHorizons, h, setPreferredHorizons)
                    }
                    className={`rounded-lg border px-3 py-1.5 text-xs font-medium transition ${
                      preferredHorizons.includes(h)
                        ? 'border-brand-500 bg-brand-500/15 text-brand-300'
                        : 'border-slate-800 bg-anthracite-850 text-slate-400'
                    }`}
                  >
                    {h}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-slate-400">
                Piattaforme e Broker Utilizzati (per Nomenclatura e Mapping Strumenti)
              </label>
              <div className="flex flex-wrap gap-2">
                {[
                  { code: 'TRADE_REPUBLIC', label: 'Trade Republic' },
                  { code: 'IBKR', label: 'Interactive Brokers' },
                  { code: 'AVATRADE', label: 'AvaTrade (CFD)' },
                  { code: 'MT4', label: 'MetaTrader 4' },
                  { code: 'MT5', label: 'MetaTrader 5' },
                ].map((b) => (
                  <button
                    type="button"
                    key={b.code}
                    onClick={() =>
                      toggleItem(selectedBrokers, b.code, setSelectedBrokers)
                    }
                    className={`rounded-lg border px-3 py-1.5 text-xs font-medium transition ${
                      selectedBrokers.includes(b.code)
                        ? 'border-brand-500 bg-brand-500/15 text-brand-300'
                        : 'border-slate-800 bg-anthracite-850 text-slate-400'
                    }`}
                  >
                    {b.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="rounded-lg border border-slate-800 bg-anthracite-850 p-3 text-[11px] text-slate-400">
              <Sparkles className="mr-1 inline h-3.5 w-3.5 text-brand-400" />
              Queste preferenze personalizzano filtri, spiegazioni e orizzonti nell'interfaccia, senza sostituire una valutazione professionale di adeguatezza finanziaria.
            </div>

            <button
              type="submit"
              disabled={submitting}
              data-testid="complete-onboarding-button"
              className="flex w-full items-center justify-center gap-2 rounded-lg bg-brand-500 px-4 py-3 text-sm font-semibold text-anthracite-950 transition hover:bg-brand-400"
            >
              <CheckCircle2 className="h-4 w-4" />
              Salva Configurazione e Apri Dashboard DemInvest
            </button>
          </form>
        </div>
      </div>
    );
  }

  return null;
};
