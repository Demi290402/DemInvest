import React, { useState } from 'react';
import {
  Activity,
  Bell,
  CheckCircle2,
  KeyRound,
  Send,
  Settings,
  ShieldCheck,
  Smartphone,
  Trash2,
} from 'lucide-react';
import { useDemInvest } from '../context/DemInvestContext';
import { AlertRuleType, TimeHorizon } from '../types/domain';

export const NotificationsView: React.FC = () => {
  const {
    uiMode,
    instruments,
    alertRules,
    notifications,
    pushPermissionState,
    createAlertRule,
    toggleAlertRule,
    deleteAlertRule,
    subscribeBrowserWebPush,
    sendRealTestPushNotification,
    markAllNotificationsRead,
  } = useDemInvest();

  const [ruleInstId, setRuleInstId] = useState('INST_BTC_USD_SPOT');
  const [ruleType, setRuleType] = useState<AlertRuleType>('PRICE_ABOVE');
  const [ruleHorizon, setRuleHorizon] = useState<TimeHorizon>('BREVE');
  const [ruleThreshold, setRuleThreshold] = useState('90000');
  const [rulePriority, setRulePriority] = useState<'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'>('HIGH');
  const [ruleCooldown, setRuleCooldown] = useState('60');
  const [pushFeedback, setPushFeedback] = useState<string | null>(null);

  const handleCreateRule = async (e: React.FormEvent) => {
    e.preventDefault();
    await createAlertRule({
      instrumentId: ruleInstId,
      ruleType,
      horizon: ruleHorizon,
      thresholdValue: Number(ruleThreshold),
      priority: rulePriority,
      cooldownMinutes: Number(ruleCooldown),
    });
  };

  const handleEnablePush = async () => {
    const res = await subscribeBrowserWebPush();
    setPushFeedback(res.message);
  };

  const handleSendTestPush = async () => {
    const res = await sendRealTestPushNotification();
    setPushFeedback(res.message);
  };

  return (
    <div className="space-y-6">
      {/* Header Centro Notifiche & Controlli Web Push Server-Side */}
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-anthracite-850">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <Bell className="h-5 w-5 text-brand-500" />
              <h1 className="text-lg font-bold text-slate-900 dark:text-white">
                Centro Notifiche & Motore Web Push (VAPID RFC 8292)
              </h1>
            </div>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              Distinzione rigorosa tra notifiche interne in-app e notifiche Web Push inviate dal backend al Service Worker.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={handleEnablePush}
              data-testid="enable-web-push-btn"
              className="flex items-center gap-1.5 rounded-xl border border-brand-500/40 bg-brand-500/10 px-3.5 py-2 text-xs font-semibold text-brand-400 hover:bg-brand-500/20"
            >
              <Bell className="h-3.5 w-3.5" />
              Attiva Permesso Web Push ({pushPermissionState})
            </button>

            <button
              type="button"
              onClick={handleSendTestPush}
              data-testid="send-test-push-btn"
              className="flex items-center gap-1.5 rounded-xl bg-brand-500 px-3.5 py-2 text-xs font-semibold text-anthracite-950 hover:bg-brand-400"
            >
              <Send className="h-3.5 w-3.5" />
              Invia Notifica Push di Test Reale
            </button>

            <button
              type="button"
              onClick={markAllNotificationsRead}
              className="rounded-xl border border-slate-700 px-3 py-2 text-xs text-slate-300 hover:bg-slate-800"
            >
              Segna tutte lette
            </button>
          </div>
        </div>

        {pushFeedback && (
          <div className="mt-3 rounded-lg border border-brand-500/30 bg-brand-500/10 p-3 text-xs text-brand-300">
            {pushFeedback}
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Form Nuova Regola Alert & Guida iOS */}
        <div className="space-y-6">
          <form
            onSubmit={handleCreateRule}
            className="space-y-3 rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-anthracite-850"
          >
            <h3 className="text-sm font-bold text-slate-900 dark:text-white">
              Nuova Regola di Alert Deterministica
            </h3>

            <div>
              <label className="mb-1 block text-xs text-slate-400">Strumento</label>
              <select
                value={ruleInstId}
                onChange={(e) => setRuleInstId(e.target.value)}
                className="w-full rounded-lg border border-slate-700 bg-anthracite-900 px-3 py-2 text-xs text-white"
              >
                {instruments.map((inst) => (
                  <option key={inst.id} value={inst.id}>
                    {inst.ticker} — {inst.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="mb-1 block text-xs text-slate-400">Condizione Tecnica / Prezzo</label>
              <select
                value={ruleType}
                onChange={(e) => setRuleType(e.target.value as AlertRuleType)}
                className="w-full rounded-lg border border-slate-700 bg-anthracite-900 px-3 py-2 text-xs text-white"
              >
                <option value="PRICE_ABOVE">Prezzo Superiore a Soglia</option>
                <option value="PRICE_BELOW">Prezzo Inferiore a Soglia</option>
                <option value="PCT_CHANGE_24H">Variazione % 24h oltre Soglia</option>
                <option value="RSI_OVERSOLD">RSI(14) in Ipervenduto (&le; Soglia)</option>
                <option value="RSI_OVERBOUGHT">RSI(14) in Ipercomprato (&ge; Soglia)</option>
                <option value="VOLATILITY_SPIKE">Volatilità ATR% oltre Soglia</option>
              </select>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="mb-1 block text-xs text-slate-400">Valore Soglia</label>
                <input
                  type="number"
                  step="any"
                  required
                  value={ruleThreshold}
                  onChange={(e) => setRuleThreshold(e.target.value)}
                  className="w-full rounded-lg border border-slate-700 bg-anthracite-900 px-3 py-2 text-xs text-white"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs text-slate-400">Cooldown (minuti)</label>
                <input
                  type="number"
                  value={ruleCooldown}
                  onChange={(e) => setRuleCooldown(e.target.value)}
                  className="w-full rounded-lg border border-slate-700 bg-anthracite-900 px-3 py-2 text-xs text-white"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="mb-1 block text-xs text-slate-400">Orizzonte</label>
                <select
                  value={ruleHorizon}
                  onChange={(e) => setRuleHorizon(e.target.value as TimeHorizon)}
                  className="w-full rounded-lg border border-slate-700 bg-anthracite-900 px-3 py-2 text-xs text-white"
                >
                  <option value="BREVISSIMO">BREVISSIMO</option>
                  <option value="BREVE">BREVE</option>
                  <option value="MEDIO">MEDIO</option>
                  <option value="LUNGO">LUNGO</option>
                </select>
              </div>
              <div>
                <label className="mb-1 block text-xs text-slate-400">Priorità</label>
                <select
                  value={rulePriority}
                  onChange={(e) =>
                    setRulePriority(e.target.value as 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL')
                  }
                  className="w-full rounded-lg border border-slate-700 bg-anthracite-900 px-3 py-2 text-xs text-white"
                >
                  <option value="LOW">Bassa</option>
                  <option value="MEDIUM">Media</option>
                  <option value="HIGH">Alta</option>
                  <option value="CRITICAL">Critica</option>
                </select>
              </div>
            </div>

            <button
              type="submit"
              className="w-full rounded-xl bg-brand-500 py-2.5 text-xs font-bold text-anthracite-950 hover:bg-brand-400"
            >
              Salva Regola Alert
            </button>
          </form>

          {/* Istruzioni di Installazione PWA e Web Push per iOS / iPadOS (Sezione 12) */}
          <div className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-anthracite-850">
            <div className="flex items-center gap-2 text-xs font-bold uppercase text-brand-400">
              <Smartphone className="h-4 w-4" />
              <span>Istruzioni Installazione PWA & Web Push su iOS / iPadOS</span>
            </div>
            <ol className="mt-2.5 list-decimal space-y-1.5 pl-4 text-xs text-slate-400">
              <li>Apri DemInvest in <strong>Safari</strong> su iPhone o iPad (iOS 16.4 o successivo).</li>
              <li>Tocca il pulsante <strong>Condividi</strong> nella barra di navigazione inferiore.</li>
              <li>Seleziona <strong>"Aggiungi alla schermata Home"</strong> (modalità standalone).</li>
              <li>Apri l'app DemInvest direttamente dall'icona sulla Home e premi <strong>"Attiva Permesso Web Push"</strong> qui sopra.</li>
            </ol>
          </div>
        </div>

        {/* Elenco Regole Alert & Storico Notifiche */}
        <div className="space-y-6 lg:col-span-2">
          <div className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-anthracite-850">
            <h3 className="mb-3 text-sm font-bold text-slate-900 dark:text-white">
              Regole di Alert Configurate ({alertRules.length})
            </h3>
            <div className="space-y-2">
              {alertRules.map((rule) => (
                <div
                  key={rule.id}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-800 bg-anthracite-900 p-3 text-xs"
                >
                  <div>
                    <span className="font-bold text-white">{rule.instrumentTicker}</span> —{' '}
                    <span className="font-mono text-brand-400">
                      {rule.ruleType} ({rule.thresholdValue})
                    </span>
                    <div className="text-[10px] text-slate-500">
                      Orizzonte: {rule.horizon} • Priorità: {rule.priority} • Cooldown:{' '}
                      {rule.cooldownMinutes}m
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => toggleAlertRule(rule.id)}
                      className={`rounded px-2.5 py-1 text-[10px] font-bold ${
                        rule.isActive
                          ? 'bg-emerald-500/20 text-emerald-400'
                          : 'bg-slate-700 text-slate-400'
                      }`}
                    >
                      {rule.isActive ? 'ATTIVA' : 'PAUSA'}
                    </button>
                    <button
                      type="button"
                      onClick={() => deleteAlertRule(rule.id)}
                      className="text-slate-500 hover:text-red-400"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-anthracite-850">
            <h3 className="mb-3 text-sm font-bold text-slate-900 dark:text-white">
              Registro Storico Avvisi & Consegne Push ({notifications.length})
            </h3>
            {notifications.length === 0 ? (
              <p className="text-xs text-slate-500">
                Nessuna notifica ancora inviata. Premi "Invia Notifica Push di Test Reale" in alto per verificare il flusso.
              </p>
            ) : (
              <div className="space-y-3">
                {notifications.map((n) => (
                  <div
                    key={n.id}
                    className="rounded-xl border border-slate-800 bg-anthracite-900 p-4 text-xs"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="font-bold text-white">{n.title}</span>
                      <div className="flex items-center gap-2">
                        <span className="rounded bg-brand-500/15 px-2 py-0.5 font-mono text-[10px] text-brand-400">
                          {n.channel} • {n.deliveryStatus}
                        </span>
                        <span className="font-mono text-[10px] text-slate-500">
                          {n.sentAt.slice(0, 19).replace('T', ' ')} UTC
                        </span>
                      </div>
                    </div>
                    <p className="mt-1.5 text-slate-300">{n.body}</p>
                    <div className="mt-2 text-[10px] text-slate-500">
                      Fonte verificata: {n.providerSource} • Osservazione:{' '}
                      {n.observedTimestamp.slice(0, 19).replace('T', ' ')} UTC
                    </div>
                    {uiMode === 'PRO' && n.quantitativeDetails && (
                      <div className="mt-2 border-t border-slate-800 pt-2 font-mono text-[10px] text-slate-400">
                        Stato Segnale: {n.quantitativeDetails.signalStatus || 'N/A'} | Invalidazione:{' '}
                        {n.quantitativeDetails.invalidationLevel ?? 'N/A'}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export const SettingsView: React.FC = () => {
  const {
    user,
    uiMode,
    theme,
    dataExecutionMode,
    providersHealth,
    schedulerStatus,
    setUiMode,
    setTheme,
    setDataExecutionMode,
    saveBackendProviderKey,
    triggerSchedulerNow,
    logoutOwner,
  } = useDemInvest();

  const [selectedKeyName, setSelectedKeyName] = useState('TWELVE_DATA_API_KEY');
  const [secretInput, setSecretInput] = useState('');
  const [savedFeedback, setSavedFeedback] = useState<string | null>(null);

  const handleSaveKey = async (e: React.FormEvent) => {
    e.preventDefault();
    await saveBackendProviderKey(selectedKeyName, secretInput);
    setSecretInput('');
    setSavedFeedback(
      `Chiave ${selectedKeyName} salvata in modo sicuro sul backend (mai esposta al browser).`
    );
    setTimeout(() => setSavedFeedback(null), 4000);
  };

  return (
    <div className="space-y-6">
      {/* Preferenze Interfaccia, Modalità Dati e Sicurezza */}
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-anthracite-850">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <Settings className="h-5 w-5 text-brand-500" />
            <div>
              <h1 className="text-lg font-bold text-slate-900 dark:text-white">
                Impostazioni Sistema, Preferenze & Provider Health Dashboard
              </h1>
              <p className="text-xs text-slate-500">
                Proprietario registrato: <strong>{user?.email}</strong> (SINGLE_USER_MODE attiva)
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={logoutOwner}
            className="rounded-xl border border-red-500/40 bg-red-500/10 px-4 py-2 text-xs font-semibold text-red-300 hover:bg-red-500/20"
          >
            Disconnetti Sessione
          </button>
        </div>

        <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div className="rounded-xl border border-slate-800 bg-anthracite-900 p-4">
            <div className="text-xs font-bold text-white">Modalità Esperienza (Semplice / Pro)</div>
            <p className="mt-1 text-[11px] text-slate-400">
              Passa in qualsiasi momento tra panoramica guidata e vista quantitativa avanzata.
            </p>
            <div className="mt-3 flex gap-2">
              {(['SIMPLE', 'PRO'] as const).map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setUiMode(m)}
                  className={`flex-1 rounded-lg py-2 text-xs font-bold ${
                    uiMode === m
                      ? 'bg-brand-500 text-anthracite-950'
                      : 'bg-anthracite-850 text-slate-400'
                  }`}
                >
                  {m === 'SIMPLE' ? 'Semplice' : 'Pro'}
                </button>
              ))}
            </div>
          </div>

          <div className="rounded-xl border border-slate-800 bg-anthracite-900 p-4">
            <div className="text-xs font-bold text-white">Tema Visivo (Scuro / Chiaro)</div>
            <p className="mt-1 text-[11px] text-slate-400">
              Antracite e Verde Smeraldo per la modalità scura o Bianco neutro per la chiara.
            </p>
            <div className="mt-3 flex gap-2">
              {(['DARK', 'LIGHT'] as const).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setTheme(t)}
                  className={`flex-1 rounded-lg py-2 text-xs font-bold ${
                    theme === t
                      ? 'bg-brand-500 text-anthracite-950'
                      : 'bg-anthracite-850 text-slate-400'
                  }`}
                >
                  {t === 'DARK' ? 'Scuro (Dark)' : 'Chiaro (Light)'}
                </button>
              ))}
            </div>
          </div>

          <div className="rounded-xl border border-slate-800 bg-anthracite-900 p-4">
            <div className="text-xs font-bold text-white">
              Sorgente Dati (LIVE Reale vs DEMO Didattica)
            </div>
            <p className="mt-1 text-[11px] text-slate-400">
              In LIVE nessun prezzo viene mai inventato. DEMO usa dataset didattici esplicitamente separati.
            </p>
            <div className="mt-3 flex gap-2">
              {(['LIVE', 'DEMO'] as const).map((dm) => (
                <button
                  key={dm}
                  type="button"
                  onClick={() => setDataExecutionMode(dm)}
                  className={`flex-1 rounded-lg py-2 text-xs font-bold ${
                    dataExecutionMode === dm
                      ? dm === 'LIVE'
                        ? 'bg-brand-500 text-anthracite-950'
                        : 'bg-amber-500 text-anthracite-950'
                      : 'bg-anthracite-850 text-slate-400'
                  }`}
                >
                  {dm === 'LIVE' ? 'LIVE REALE' : 'DEMO DIDATTICA'}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Provider Health Dashboard (Sezione 23) */}
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-anthracite-850">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Activity className="h-5 w-5 text-brand-500" />
            <h2 className="text-sm font-bold uppercase tracking-wider text-slate-700 dark:text-slate-200">
              Provider Health Dashboard (Configurato vs Testato vs Operativo)
            </h2>
          </div>
          <span className="text-xs text-slate-500">
            Le chiavi segrete risiedono esclusivamente sul backend e non vengono mai esposte
          </span>
        </div>

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {providersHealth.map((p) => (
            <div
              key={p.id}
              className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-xs dark:border-slate-800 dark:bg-anthracite-900"
            >
              <div className="flex items-center justify-between">
                <span className="font-bold text-slate-900 dark:text-white">{p.displayName}</span>
                <span
                  className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold ${
                    p.status === 'OPERATIONAL'
                      ? 'bg-emerald-500/15 text-emerald-400'
                      : p.status === 'OPERATIONAL_SANDBOX' || p.status === 'CONFIGURED'
                        ? 'bg-sky-500/15 text-sky-400'
                        : 'bg-amber-500/15 text-amber-400'
                  }`}
                >
                  {p.status}
                </span>
              </div>

              <div className="mt-2 grid grid-cols-2 gap-2 text-[11px] text-slate-400">
                <div>
                  Credenziali:{' '}
                  <strong className="text-slate-200">
                    {p.hasCredentials ? 'Presenti (Backend)' : p.credentialsSource}
                  </strong>
                </div>
                <div>
                  Chiamate Oggi:{' '}
                  <strong className="num-mono text-slate-200">
                    {p.callsToday} / {p.dailyBudgetLimit}
                  </strong>
                </div>
                <div>
                  Ultima Riuscita:{' '}
                  <span className="font-mono">
                    {p.lastSuccessAt ? p.lastSuccessAt.slice(11, 19) + ' UTC' : 'In attesa'}
                  </span>
                </div>
                <div>
                  Qualità Dati: <strong>{p.dataQualityStatus}</strong>
                </div>
              </div>

              <div className="mt-2 text-[11px] text-slate-400">
                <strong>Limiti Noti:</strong> {p.knownRateLimits}
              </div>

              {p.availableFeatures.length > 0 && (
                <div className="mt-2">
                  <div className="text-[10px] font-bold uppercase text-emerald-400">
                    Funzioni Operative:
                  </div>
                  {p.availableFeatures.map((f, i) => (
                    <div key={i} className="mt-0.5 flex items-center gap-1 text-[11px] text-slate-300">
                      <CheckCircle2 className="h-3 w-3 text-emerald-400" />
                      <span>{f}</span>
                    </div>
                  ))}
                </div>
              )}

              {p.suspendedFeatures.length > 0 && (
                <div className="mt-2">
                  <div className="text-[10px] font-bold uppercase text-amber-400">
                    Funzioni Sospese in attesa di API Key:
                  </div>
                  {p.suspendedFeatures.map((sf, i) => (
                    <div key={i} className="mt-0.5 text-[11px] text-amber-300">
                      • {sf}
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Form Configurazione Chiavi API Backend-Only */}
        <form
          onSubmit={handleSaveKey}
          className="mt-6 rounded-xl border border-slate-800 bg-anthracite-900 p-4"
        >
          <div className="flex items-center gap-2 text-xs font-bold text-brand-400">
            <KeyRound className="h-4 w-4" />
            <span>Configura Chiave API nel Vault Server-Side (Mai Esposta al Browser)</span>
          </div>
          <div className="mt-3 flex flex-col gap-2 sm:flex-row">
            <select
              value={selectedKeyName}
              onChange={(e) => setSelectedKeyName(e.target.value)}
              className="rounded-lg border border-slate-700 bg-anthracite-950 px-3 py-2 text-xs text-white"
            >
              <option value="TWELVE_DATA_API_KEY">TWELVE_DATA_API_KEY (Twelve Data)</option>
              <option value="COINGECKO_API_KEY">COINGECKO_API_KEY (CoinGecko)</option>
              <option value="ALPHA_VANTAGE_API_KEY">ALPHA_VANTAGE_API_KEY (Alpha Vantage)</option>
              <option value="FRED_API_KEY">FRED_API_KEY (FRED Macro)</option>
              <option value="GEMINI_API_KEY">GEMINI_API_KEY (Google Gemini AI)</option>
            </select>
            <input
              type="password"
              value={secretInput}
              onChange={(e) => setSecretInput(e.target.value)}
              placeholder="Inserisci la chiave segreta (verrà salvata solo sul backend)..."
              className="flex-1 rounded-lg border border-slate-700 bg-anthracite-950 px-3 py-2 text-xs text-white"
            />
            <button
              type="submit"
              className="rounded-lg bg-brand-500 px-4 py-2 text-xs font-bold text-anthracite-950 hover:bg-brand-400"
            >
              Salva nel Backend
            </button>
          </div>
          {savedFeedback && (
            <div className="mt-2 flex items-center gap-1 text-xs text-emerald-400">
              <ShieldCheck className="h-3.5 w-3.5" />
              <span>{savedFeedback}</span>
            </div>
          )}
        </form>
      </div>

      {/* Stato Backend Scheduler & Esecuzioni Recenti */}
      {schedulerStatus && (
        <div className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-anthracite-850">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white">
              Registro Job Pianificati Backend (Scheduler Runs)
            </h3>
            <button
              type="button"
              onClick={triggerSchedulerNow}
              className="rounded-lg bg-brand-500/20 px-3 py-1.5 text-xs font-semibold text-brand-400 hover:bg-brand-500 hover:text-anthracite-950"
            >
              Avvia Ciclo Scheduler Ora
            </button>
          </div>

          {schedulerStatus.recentRuns.length === 0 ? (
            <p className="text-xs text-slate-500">Nessun job ancora eseguito in questa sessione.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-800 text-[11px] text-slate-400">
                    <th className="pb-2">ID Run</th>
                    <th className="pb-2">Avvio UTC</th>
                    <th className="pb-2">Stato</th>
                    <th className="pb-2 text-right">Strumenti</th>
                    <th className="pb-2 text-right">Segnali</th>
                    <th className="pb-2 text-right">Notifiche</th>
                    <th className="pb-2 text-right">Chiamate API</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {schedulerStatus.recentRuns.map((run) => (
                    <tr key={run.id}>
                      <td className="py-2 font-mono text-[11px]">{run.id}</td>
                      <td className="py-2 font-mono text-[11px]">
                        {run.startedAt.slice(0, 19).replace('T', ' ')}
                      </td>
                      <td className="py-2 font-bold text-emerald-400">{run.status}</td>
                      <td className="num-mono py-2 text-right">{run.instrumentsChecked}</td>
                      <td className="num-mono py-2 text-right">{run.signalsGenerated}</td>
                      <td className="num-mono py-2 text-right">{run.notificationsSent}</td>
                      <td className="num-mono py-2 text-right">{run.apiCallsUsed}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
