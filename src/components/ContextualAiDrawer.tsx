import React, { useEffect, useState } from 'react';
import {
  Bot,
  CheckCircle2,
  Database,
  Send,
  ShieldAlert,
  Sparkles,
  Terminal,
  X,
} from 'lucide-react';
import { useDemInvest } from '../context/DemInvestContext';

export const ContextualAiDrawer: React.FC = () => {
  const {
    isAiDrawerOpen,
    setIsAiDrawerOpen,
    selectedInstrumentId,
    instruments,
    quotes,
    activeHorizon,
    selectedBrokerCode,
    dataExecutionMode,
    aiMessages,
    aiToolLogs,
    sendAiMessage,
  } = useDemInvest();

  const [prompt, setPrompt] = useState('');
  const [sending, setSending] = useState(false);
  const [showToolLogs, setShowToolLogs] = useState(false);

  // Chiusura con tasto Escape
  useEffect(() => {
    if (!isAiDrawerOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsAiDrawerOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isAiDrawerOpen, setIsAiDrawerOpen]);

  if (!isAiDrawerOpen) return null;

  const currentInst =
    instruments.find((i) => i.id === selectedInstrumentId) || instruments[0];
  const currentQuote = quotes[selectedInstrumentId];

  const handleSend = async (textToSend?: string) => {
    const query = (textToSend ?? prompt).trim();
    if (!query || sending) return;
    setSending(true);
    setPrompt('');
    try {
      await sendAiMessage(query);
    } finally {
      setSending(false);
    }
  };

  const quickPrompts = [
    `Analizza lo strumento attivo (${currentInst?.ticker}) sull'orizzonte ${activeHorizon} e spiega i rischi.`,
    `Qual è la differenza tra acquistare ${currentInst?.ticker} Spot e negoziare un CFD su ${selectedBrokerCode}?`,
    `Valuta la concentrazione e l'esposizione valutaria del mio portafoglio manuale.`,
    `Simula gli scenari quantitativi basati sull'ATR(14) per ${currentInst?.ticker}.`,
  ];

  return (
    <div
      className="fixed inset-0 z-50 flex justify-end bg-black/60 backdrop-blur-sm transition-opacity duration-150"
      onClick={() => setIsAiDrawerOpen(false)}
      role="dialog"
      aria-modal="true"
      aria-labelledby="ai-drawer-title"
    >
      <div
        className="flex h-full w-full max-w-2xl flex-col border-l border-slate-200 bg-white text-slate-900 shadow-2xl transition-transform duration-200 dark:border-navy-800 dark:bg-navy-950 dark:text-slate-100"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header contestuale */}
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4 dark:border-navy-800">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-500/15 text-brand-400">
              <Bot className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-bold">DemInvest AI — Analista Contestuale</h3>
                <span className="rounded bg-brand-500/15 px-2 py-0.5 text-[10px] font-bold text-brand-400">
                  TOOL-VERIFIED
                </span>
              </div>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                Contesto attivo: <strong>{currentInst?.ticker}</strong> | Orizzonte:{' '}
                <strong>{activeHorizon}</strong> | Piattaforma:{' '}
                <strong>{selectedBrokerCode}</strong>
                {currentQuote?.observedAt
                  ? ` | Dato: ${currentQuote.observedAt.slice(11, 19)} UTC`
                  : ''}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setShowToolLogs(!showToolLogs)}
              className="flex items-center gap-1 rounded-lg border border-slate-300 px-2.5 py-1.5 text-xs font-medium hover:bg-slate-100 dark:border-slate-700 dark:hover:bg-slate-800"
            >
              <Terminal className="h-3.5 w-3.5 text-brand-400" />
              Tool Logs ({aiToolLogs.length})
            </button>
            <button
              type="button"
              onClick={() => setIsAiDrawerOpen(false)}
              className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-800 hover:text-white"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Banner regole anti-allucinazione */}
        <div className="border-b border-slate-200 bg-slate-50 px-5 py-2 text-[11px] text-slate-600 dark:border-slate-800 dark:bg-anthracite-850 dark:text-slate-400">
          <ShieldAlert className="mr-1.5 inline h-3.5 w-3.5 text-brand-400" />
          <strong>Presidio Anti-Allucinazione:</strong> L'assistente interroga esclusivamente tool backend autorizzati, distingue dati verificati da ipotesi e non può inviare ordini a nessun broker.
          {dataExecutionMode === 'DEMO' && (
            <span className="ml-2 font-bold text-amber-400">
              [MODALITÀ DEMO ATTIVA]
            </span>
          )}
        </div>

        {/* Vista opzionale Audit Log dei Tool Backend */}
        {showToolLogs && (
          <div className="max-h-56 overflow-y-auto border-b border-slate-800 bg-anthracite-950 p-4 font-mono text-[11px] text-slate-300">
            <div className="mb-2 font-bold text-brand-400">
              Registro Esecuzioni Tool Backend Autorizzati (ai_tool_execution_logs):
            </div>
            {aiToolLogs.length === 0 ? (
              <div className="text-slate-500">Nessun tool ancora invocato in questa sessione.</div>
            ) : (
              <div className="space-y-2">
                {aiToolLogs.slice(0, 10).map((log) => (
                  <div
                    key={log.id}
                    className="rounded border border-slate-800 bg-anthracite-900 p-2"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-emerald-400">{log.toolName}()</span>
                      <span className="text-slate-500">
                        {log.executionMs}ms — {log.status} — {log.executedAt.slice(11, 19)} UTC
                      </span>
                    </div>
                    <div className="mt-1 truncate text-slate-400">
                      Input: {JSON.stringify(log.inputParams)}
                    </div>
                    <div className="truncate text-slate-300">
                      Output: {JSON.stringify(log.outputSummary)}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Messaggi conversazione */}
        <div className="flex-1 space-y-4 overflow-y-auto p-5">
          {aiMessages.length === 0 && (
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-5 dark:border-slate-800 dark:bg-anthracite-850">
              <div className="flex items-center gap-2 text-sm font-semibold text-brand-500">
                <Sparkles className="h-4 w-4" />
                <span>Domande Contestuali Consigliate</span>
              </div>
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                Seleziona una richiesta per eseguire i tool quantitativi sullo strumento e sul portafoglio attivo:
              </p>
              <div className="mt-3 space-y-2">
                {quickPrompts.map((qp, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => handleSend(qp)}
                    className="block w-full rounded-lg border border-slate-200 bg-white px-3.5 py-2.5 text-left text-xs font-medium transition hover:border-brand-500 dark:border-slate-700/80 dark:bg-anthracite-900 dark:hover:border-brand-500"
                  >
                    {qp}
                  </button>
                ))}
              </div>
            </div>
          )}

          {aiMessages.map((msg) => (
            <div
              key={msg.id}
              className={`rounded-xl p-4 text-xs leading-relaxed ${
                msg.role === 'user'
                  ? 'ml-8 border border-brand-500/30 bg-brand-500/10 text-slate-900 dark:text-slate-100'
                  : 'mr-2 border border-slate-200 bg-slate-50 dark:border-slate-800 dark:bg-anthracite-850'
              }`}
            >
              <div className="mb-2 flex items-center justify-between text-[11px] font-semibold text-slate-400">
                <span>
                  {msg.role === 'user'
                    ? 'Tu (Proprietario)'
                    : `DemInvest AI (${
                        msg.engineMode === 'GEMINI_LLM_TOOL_VERIFIED'
                          ? 'Gemini API + Tool Verificati'
                          : 'Analista Deterministico Tool-Based'
                      })`}
                </span>
                <span>{msg.createdAt.slice(11, 19)} UTC</span>
              </div>

              {msg.structuredSections ? (
                <div className="space-y-3">
                  <div>
                    <div className="font-bold text-brand-400">1. Dati Verificati (Fonte & Timestamp):</div>
                    <ul className="mt-1 list-disc space-y-1 pl-4">
                      {msg.structuredSections.verifiedData.map((item, i) => (
                        <li key={i}>{item}</li>
                      ))}
                    </ul>
                  </div>

                  {msg.structuredSections.quantitativeCalculations.length > 0 && (
                    <div>
                      <div className="font-bold text-sky-400">2. Calcoli Quantitativi Deterministici:</div>
                      <ul className="mt-1 list-disc space-y-1 pl-4">
                        {msg.structuredSections.quantitativeCalculations.map((item, i) => (
                          <li key={i}>{item}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                  <div>
                    <div className="font-bold text-amber-400">3. Interpretazioni Tecniche:</div>
                    <ul className="mt-1 list-disc space-y-1 pl-4">
                      {msg.structuredSections.technicalInterpretations.map((item, i) => (
                        <li key={i}>{item}</li>
                      ))}
                    </ul>
                  </div>

                  <div>
                    <div className="font-bold text-purple-400">4. Ipotesi e Scenari di Rischio:</div>
                    <ul className="mt-1 list-disc space-y-1 pl-4">
                      {msg.structuredSections.hypothesesAndScenarios.map((item, i) => (
                        <li key={i}>{item}</li>
                      ))}
                    </ul>
                  </div>

                  <div className="border-t border-slate-200 pt-2 text-[11px] text-slate-500 dark:border-slate-800 dark:text-slate-400">
                    <div className="font-semibold">5. Limitazioni e Fonti Verificate:</div>
                    {msg.structuredSections.limitationsAndSources.map((item, i) => (
                      <div key={i}>• {item}</div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="whitespace-pre-wrap">{msg.content}</div>
              )}

              {msg.toolCalls && msg.toolCalls.length > 0 && (
                <div className="mt-3 flex flex-wrap items-center gap-1.5 border-t border-slate-200/60 pt-2 dark:border-slate-800">
                  <Database className="h-3.5 w-3.5 text-brand-400" />
                  <span className="text-[10px] text-slate-400">Tool eseguiti:</span>
                  {msg.toolCalls.map((tc) => (
                    <span
                      key={tc.id}
                      className="inline-flex items-center gap-1 rounded bg-slate-200 px-1.5 py-0.5 font-mono text-[10px] dark:bg-slate-800"
                    >
                      <CheckCircle2 className="h-2.5 w-2.5 text-brand-400" />
                      {tc.toolName}
                    </span>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Input form */}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSend();
          }}
          className="border-t border-slate-200 p-4 dark:border-slate-800"
        >
          <div className="flex gap-2">
            <input
              type="text"
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder={`Chiedi un'analisi verificata su ${currentInst?.ticker}, il portafoglio o uno scenario...`}
              data-testid="ai-chat-input"
              className="flex-1 rounded-xl border border-slate-300 bg-slate-50 px-3.5 py-2.5 text-xs focus:border-brand-500 focus:outline-none dark:border-slate-700 dark:bg-anthracite-850 dark:text-white"
            />
            <button
              type="submit"
              disabled={sending || !prompt.trim()}
              data-testid="ai-chat-send"
              className="flex items-center gap-1.5 rounded-xl bg-brand-500 px-4 py-2.5 text-xs font-semibold text-anthracite-950 transition hover:bg-brand-400 disabled:opacity-50"
            >
              <Send className="h-3.5 w-3.5" />
              {sending ? 'Analisi...' : 'Invia'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
