import React, { useEffect, useState } from 'react';
import {
  CheckCircle2,
  Lock,
  LogIn,
  ShieldCheck,
  Sparkles,
  UserCheck,
  UserPlus,
} from 'lucide-react';
import { useDemInvest } from '../context/DemInvestContext';
import { AssetClass, TimeHorizon, UIMode } from '../types/domain';

export const AuthAndOnboardingView: React.FC = () => {
  const {
    hasOwnerAccount,
    isAuthenticated,
    user,
    registerOwner,
    loginOwner,
    updateUserProfile,
    setUiMode,
  } = useDemInvest();

  const [authMode, setAuthMode] = useState<'LOGIN' | 'REGISTER'>(() =>
    hasOwnerAccount ? 'LOGIN' : 'REGISTER'
  );
  const [email, setEmail] = useState('investitore@deminvest.com');
  const [password, setPassword] = useState('DemInvest2026!');
  const [displayName, setDisplayName] = useState('Investitore Proprietario');
  const [authError, setAuthError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (hasOwnerAccount) {
      setAuthMode('LOGIN');
    }
  }, [hasOwnerAccount]);

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
      const res =
        authMode === 'LOGIN'
          ? await loginOwner({ email, password })
          : await registerOwner({ email, password, displayName });
      if (!res.ok) {
        setAuthError(res.error || 'Credenziali non valide o accesso non autorizzato.');
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
      <div className="flex min-h-screen flex-col items-center justify-center bg-navy-950 px-4 py-12 text-slate-100 antialiased selection:bg-brand-500/30 selection:text-brand-300">
        <div className="w-full max-w-md rounded-3xl border border-slate-800/80 bg-navy-900/90 p-8 shadow-2xl backdrop-blur-xl sm:p-9">
          {/* Header Brand */}
          <div className="mb-7 flex items-center gap-3.5">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-500/10 p-1.5 ring-1 ring-brand-500/25 shadow-soft-glow">
              <img
                src="/Logo_no_sfondo.png"
                alt="DemInvest"
                className="h-9 w-9 object-contain"
              />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <h1 className="text-xl font-extrabold tracking-tight text-white">DemInvest</h1>
                <span className="rounded-md bg-brand-500/15 px-1.5 py-0.5 font-mono text-[9px] font-bold text-brand-smart">
                  v1.0
                </span>
              </div>
              <p className="text-xs font-medium text-slate-400">
                Personal Investment Intelligence
              </p>
            </div>
          </div>

          {/* Selettore Elegante Modalità: Accedi vs Primo Accesso */}
          <div className="mb-6 grid grid-cols-2 gap-1.5 rounded-2xl border border-slate-800 bg-navy-950/90 p-1.5">
            <button
              type="button"
              data-testid="auth-mode-login"
              onClick={() => {
                setAuthMode('LOGIN');
                setAuthError(null);
              }}
              className={`flex items-center justify-center gap-2 rounded-xl py-2.5 text-xs font-semibold transition ${
                authMode === 'LOGIN'
                  ? 'bg-brand-500 font-bold text-anthracite-950 shadow-md'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <LogIn className="h-4 w-4" />
              <span>Accedi</span>
            </button>
            <button
              type="button"
              data-testid="auth-mode-register"
              onClick={() => {
                setAuthMode('REGISTER');
                setAuthError(null);
              }}
              className={`flex items-center justify-center gap-2 rounded-xl py-2.5 text-xs font-semibold transition ${
                authMode === 'REGISTER'
                  ? 'bg-brand-500 font-bold text-anthracite-950 shadow-md'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <UserPlus className="h-4 w-4" />
              <span>Primo Accesso</span>
            </button>
          </div>

          {/* Badge Informativo Istituzionale Sereno */}
          <div className="mb-5 flex items-start gap-2.5 rounded-xl border border-brand-500/20 bg-brand-500/5 p-3 text-xs text-slate-300">
            <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-brand-smart" />
            <div className="text-[11px] leading-relaxed text-slate-300">
              {authMode === 'LOGIN'
                ? 'Area riservata protetta. Inserisci le tue credenziali per visualizzare mercati, watchlist e portafoglio.'
                : 'Configura il tuo account personale esclusivo. I dati di calcolo e le preferenze rimangono sotto il tuo pieno controllo.'}
            </div>
          </div>

          {authError && (
            <div className="mb-5 rounded-xl border border-red-500/40 bg-red-500/10 p-3 text-xs text-red-300">
              {authError}
            </div>
          )}

          <form onSubmit={handleAuthSubmit} className="space-y-4">
            {authMode === 'REGISTER' && (
              <div>
                <label className="mb-1.5 block text-xs font-medium text-slate-300">
                  Nome Completo
                </label>
                <input
                  type="text"
                  required
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  placeholder="es. Marco Rossi"
                  className="w-full rounded-xl border border-slate-700/80 bg-navy-950/80 px-3.5 py-2.5 text-sm text-white placeholder-slate-500 transition focus-ring focus:border-brand-500"
                />
              </div>
            )}

            <div>
              <label className="mb-1.5 block text-xs font-medium text-slate-300">
                Email
              </label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="es. investitore@deminvest.com"
                className="w-full rounded-xl border border-slate-700/80 bg-navy-950/80 px-3.5 py-2.5 text-sm text-white placeholder-slate-500 transition focus-ring focus:border-brand-500"
              />
            </div>

            <div>
              <label className="mb-1.5 block text-xs font-medium text-slate-300">
                Password
              </label>
              <input
                type="password"
                required
                minLength={8}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Almeno 8 caratteri"
                className="w-full rounded-xl border border-slate-700/80 bg-navy-950/80 px-3.5 py-2.5 text-sm text-white placeholder-slate-500 transition focus-ring focus:border-brand-500"
              />
            </div>

            <button
              type="submit"
              disabled={submitting}
              data-testid="auth-submit-button"
              className="mt-2 flex w-full items-center justify-center gap-2 rounded-xl bg-brand-500 py-3 text-sm font-bold text-anthracite-950 transition hover:bg-brand-400 active:scale-[0.99] disabled:opacity-50 shadow-soft-glow"
            >
              <Lock className="h-4 w-4" />
              <span>
                {submitting
                  ? 'Accesso in corso...'
                  : authMode === 'LOGIN'
                    ? 'Accedi a DemInvest'
                    : 'Attiva Account Proprietario'}
              </span>
            </button>
          </form>

          <div className="mt-6 border-t border-slate-800/80 pt-4 text-center">
            <p className="text-[11px] text-slate-500">
              Piattaforma di supporto analitico alle decisioni • Crittografia end-to-end
            </p>
          </div>
        </div>
      </div>
    );
  }

  // Se l'utente è autenticato ma deve completare il primo setup (onboarding)
  if (user && !user.onboardingCompleted) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-navy-950 px-4 py-10 text-slate-100">
        <div className="w-full max-w-2xl rounded-3xl border border-slate-800/80 bg-navy-900/90 p-8 shadow-2xl backdrop-blur-xl sm:p-9">
          <div className="mb-6 flex items-center justify-between border-b border-slate-800/80 pb-5">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-brand-500/15 text-brand-smart ring-1 ring-brand-500/25">
                <UserCheck className="h-5 w-5" />
              </div>
              <div>
                <h2 className="text-lg font-extrabold text-white">
                  Personalizza la tua Esperienza
                </h2>
                <p className="text-xs text-slate-400">
                  Imposta il tuo stile operativo, i mercati preferiti e la valuta di riferimento.
                </p>
              </div>
            </div>
            <span className="hidden sm:inline-flex rounded-full bg-brand-500/15 px-3 py-1 text-xs font-semibold text-brand-smart">
              Account Personale Attivo
            </span>
          </div>

          <form onSubmit={handleCompleteOnboarding} className="space-y-6">
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
              <div>
                <label className="mb-2 block text-xs font-semibold text-slate-300">
                  Stile dell'Interfaccia
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {(['SIMPLE', 'PRO'] as UIMode[]).map((m) => (
                    <button
                      type="button"
                      key={m}
                      onClick={() => setSelectedUiMode(m)}
                      className={`rounded-xl border p-3 text-left transition ${
                        selectedUiMode === m
                          ? 'border-brand-500 bg-brand-500/15 text-white shadow-soft-glow'
                          : 'border-slate-800 bg-navy-950/70 text-slate-400 hover:border-slate-700'
                      }`}
                    >
                      <div className="text-xs font-bold">
                        {m === 'SIMPLE' ? 'Semplice' : 'Professionale'}
                      </div>
                      <div className="mt-1 text-[11px] leading-tight opacity-75">
                        {m === 'SIMPLE'
                          ? 'Sintesi chiare e layout guidato'
                          : 'Grafici OHLCV e metriche quantitative'}
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="mb-2 block text-xs font-semibold text-slate-300">
                  Valuta Principale di Conto
                </label>
                <select
                  value={preferredCurrency}
                  onChange={(e) =>
                    setPreferredCurrency(e.target.value as 'EUR' | 'USD' | 'GBP' | 'CHF')
                  }
                  className="w-full rounded-xl border border-slate-700/80 bg-navy-950/80 px-3.5 py-2.5 text-xs text-white focus-ring"
                >
                  <option value="EUR">Euro (€ EUR) — Valuta Ufficiale BCE</option>
                  <option value="USD">Dollaro Statunitense ($ USD)</option>
                  <option value="GBP">Sterlina Britannica (£ GBP)</option>
                  <option value="CHF">Franco Svizzero (CHF)</option>
                </select>

                <label className="mt-4 mb-2 block text-xs font-semibold text-slate-300">
                  Profilo di Rischio Indicativo
                </label>
                <select
                  value={riskTolerance}
                  onChange={(e) =>
                    setRiskTolerance(
                      e.target.value as 'CONSERVATIVE' | 'MODERATE' | 'DYNAMIC'
                    )
                  }
                  className="w-full rounded-xl border border-slate-700/80 bg-navy-950/80 px-3.5 py-2.5 text-xs text-white focus-ring"
                >
                  <option value="CONSERVATIVE">Prudente (Focus conservazione del capitale)</option>
                  <option value="MODERATE">Bilanciato (Crescita con controllo drawdown)</option>
                  <option value="DYNAMIC">Dinamico (Forte orientamento ai trend di mercato)</option>
                </select>
              </div>
            </div>

            <div>
              <label className="mb-2 block text-xs font-semibold text-slate-300">
                Orizzonti Temporali d'Interesse
              </label>
              <div className="flex flex-wrap gap-2">
                {[
                  { id: 'BREVISSIMO', label: 'Brevissimo (Intraday)' },
                  { id: 'BREVE', label: 'Breve (Swing 1-5gg)' },
                  { id: 'MEDIO', label: 'Medio (Multi-settimana)' },
                  { id: 'LUNGO', label: 'Lungo (Investimento)' },
                ].map((h) => (
                  <button
                    type="button"
                    key={h.id}
                    onClick={() =>
                      toggleItem(preferredHorizons, h.id as TimeHorizon, setPreferredHorizons)
                    }
                    className={`rounded-xl border px-3.5 py-2 text-xs font-medium transition ${
                      preferredHorizons.includes(h.id as TimeHorizon)
                        ? 'border-brand-500 bg-brand-500/15 text-brand-smart font-semibold'
                        : 'border-slate-800 bg-navy-950/60 text-slate-400 hover:border-slate-700'
                    }`}
                  >
                    {h.label}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="mb-2 block text-xs font-semibold text-slate-300">
                Piattaforme e Broker di Riferimento (per Nomenclatura e Mapping)
              </label>
              <div className="flex flex-wrap gap-2">
                {[
                  { code: 'TRADE_REPUBLIC', label: 'Trade Republic' },
                  { code: 'IBKR', label: 'Interactive Brokers' },
                  { code: 'AVATRADE', label: 'AvaTrade' },
                  { code: 'MT4', label: 'MetaTrader 4' },
                  { code: 'MT5', label: 'MetaTrader 5' },
                ].map((b) => (
                  <button
                    type="button"
                    key={b.code}
                    onClick={() =>
                      toggleItem(selectedBrokers, b.code, setSelectedBrokers)
                    }
                    className={`rounded-xl border px-3.5 py-2 text-xs font-medium transition ${
                      selectedBrokers.includes(b.code)
                        ? 'border-brand-500 bg-brand-500/15 text-brand-smart font-semibold'
                        : 'border-slate-800 bg-navy-950/60 text-slate-400 hover:border-slate-700'
                    }`}
                  >
                    {b.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex items-center gap-2 rounded-xl border border-slate-800 bg-navy-950/60 p-3 text-[11px] text-slate-400">
              <Sparkles className="h-4 w-4 shrink-0 text-brand-smart" />
              <span>
                Puoi modificare queste preferenze e cambiare modalità di vista in ogni momento dalle Impostazioni.
              </span>
            </div>

            <button
              type="submit"
              disabled={submitting}
              data-testid="complete-onboarding-button"
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-brand-500 py-3.5 text-sm font-bold text-anthracite-950 transition hover:bg-brand-400 active:scale-[0.99] shadow-soft-glow"
            >
              <CheckCircle2 className="h-4 w-4" />
              <span>Salva e Avvia DemInvest</span>
            </button>
          </form>
        </div>
      </div>
    );
  }

  return null;
};
