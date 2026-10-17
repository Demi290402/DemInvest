# AI_ENGINE.md — DemInvest AI, Tool-Calling Autorizzato e Regole Anti-Allucinazione

## 1. Architettura e Sicurezza

L'assistente **DemInvest AI** è implementato lato backend in `server/backendEngine.ts` (`processContextualAiChat`) ed è accessibile da qualsiasi schermata tramite il drawer contestuale (`src/components/ContextualAiDrawer.tsx`).

### Principi Fondamentali
1. **Chiamate Backend-Only**: La chiave `GEMINI_API_KEY` non è mai accessibile al browser.
2. **Esecuzione Esclusiva di Tool Autorizzati**:
   - `get_asset_metadata`
   - `get_market_quote`
   - `get_historical_candles`
   - `calculate_technical_indicators`
   - `get_portfolio_summary`
   - `calculate_scenario`
3. **Audit Logging**: Ogni esecuzione di tool viene registrata con input, output sintetico, latenza in millisecondi e stato in `ai_tool_execution_logs` (consultabile direttamente nell'interfaccia tramite il pulsante **Tool Logs**).
4. **Doppia Modalità Operativa**:
   - **Con `GEMINI_API_KEY` configurata**: Invoca `gemini-2.5-flash` vincolando rigorosamente il modello ai soli dati JSON restituiti dai tool appena eseguiti.
   - **Senza `GEMINI_API_KEY`**: Opera in modalità **Analista Deterministico Tool-Based** producendo il report strutturato verificato.

---

## 2. Struttura Obbligatoria delle Risposte (5 Sezioni)

Ogni risposta di DemInvest AI separa in modo netto:
1. **Dati Verificati** (prezzo, valuta, provider, timestamp UTC, stato freschezza e stato mappatura broker).
2. **Calcoli Quantitativi Deterministici** (SMA, EMA, RSI, MACD, ATR, Volatilità, Max Drawdown, Supporti/Resistenze frattali, HHI portafoglio).
3. **Interpretazioni Tecniche** sull'orizzonte attivo (`BREVISSIMO`, `BREVE`, `MEDIO`, `LUNGO`).
4. **Ipotesi e Scenari di Rischio** (proiezioni parametriche basate su multipli di $\text{ATR}_{14}$).
5. **Limitazioni e Fonti**.

---

## 3. Protezione da Prompt Injection e Divieto di Esecuzione Ordini
La funzione `sanitizeUserPromptAndGuardOrders()` rimuove tag malevoli, filtra istruzioni di override di sistema e blocca tassativamente qualsiasi richiesta di inviare o eseguire ordini sui broker.
