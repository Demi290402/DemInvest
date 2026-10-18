# DemInvest — Architettura dell'Informazione (Release 5)
## Navigazione Ergonomica, Gerarchia dei Moduli & Flussi Utente

**Progetto:** DemInvest  
**Versione:** 5.0.0  
**Ruolo:** Principal UX Architect & Financial Information Architect  

---

## 1. Mappa Concettuale dell'Applicazione

DemInvest è strutturata secondo una gerarchia intuitiva che separa le attività operative primarie (monitoraggio quotidiano e ricerca di opportunità) dagli strumenti di laboratorio analitico e configurazione di sistema.

```
+-----------------------------------------------------------------------------------+
|                                DEMINVEST PWA CORE                                 |
+-----------------------------------------------------------------------------------+
                                         |
     +-----------------------------------+-----------------------------------+
     |                                                                       |
[NAVIGAZIONE PRIMARIA - TOP TIER]                         [ACCESSO CONTESTUALE GLOBALE]
     |                                                                       |
     +--> 1. Home (Dashboard)                                                +--> Assistente DemInvest AI
     +--> 2. Mercati (Grafici & Schede)                                      +--> Switch Modalità (Semplice / PRO)
     +--> 3. Opportunità (Screener & Scanner)                                +--> Switch Tema (Dark / Light)
     +--> 4. Portafoglio (Tracker & Rischio HHI)                             +--> Selettore Orizzonte (Breve / Medio)
     +--> 5. Altro (Hub Funzioni Avanzate)
               |
               +--> Trading Lab (Paper Trading & Backtesting)
               +--> Notifiche (Storico & Impostazioni Push VAPID)
               +--> Impostazioni & Diagnostica Supabase Cloud
```

---

## 2. Architettura di Navigazione Mobile vs Desktop

### 2.1 Schema Desktop (Display & Laptop &ge; 1024px)
Su schermi ampi l'utente gode di una visione d'insieme completa:
- **Header Orizzontale Fissa:**
  - Sinistra: Logo brand (`Logo_no_sfondo.png`), nome `DemInvest` e versione `v1.0`.
  - Centro: Barra di navigazione a 7 pulsanti con indicatori visivi di stato e badge notifiche.
  - Destra: Selettore orizzonte temporale (`1D`, `4H`, `1H`), selettore broker (`Trade Republic`, `IBKR`, `Scalable`), toggle modalità (`Semplice / PRO`), toggle tema (`Dark / Light`), avatar utente e pulsante primario `DemInvest AI`.
- **Layout Contenuto:** Griglie fluide da 2 a 5 colonne con tabelle finanziarie estese a larghezza intera.

### 2.2 Schema Mobile (Smartphone & Tablet &lt; 1024px)
Su dispositivi mobili la navigazione è ottimizzata per l'uso con il pollice secondo la regola dei **5 nodi primari** (Mobile Thumb-Zone Pattern):
- **Header Superiore Essenziale:** Logo compatto, selettore orizzonte e pulsante `DemInvest AI`.
- **Bottom Navigation Bar Ergonomica Fissa (5 icone fisse):**
  1. `Home`: Panoramica, KPI portafoglio, watchlist e sessioni mondiali.
  2. `Mercati`: Selettore ticker, quotazione live e grafici TradingView.
  3. `Opportunità`: Screener quantitativo e simulatore posizione.
  4. `Portafoglio`: Transazioni, composizione e indice di concentrazione HHI.
  5. `Altro`: Hub di accesso rapido a Trading Lab, Notifiche e Impostazioni.
- **Flusso "Altro" con Breadcrumb:** Quando l'utente seleziona un sottomodulo (es. Trading Lab o Notifiche), viene mostrata una barra contestuale superiore con pulsante `← Torna a Altro`, garantendo chiarezza di navigazione e zero disorientamento.

---

## 3. Struttura delle Singole Viste

### 3.1 Vista Home (Dashboard)
1. **Intestazione con Benvenuto:** Saluto personalizzato all'investitore e indicazione chiara della modalità attiva (Semplice vs PRO).
2. **Snapshot Rapido Portafoglio:** Valore totale stimato, plus/minusvalenza non realizzata (con badge verde/rosso), indice HHI e numero di alert attivi.
3. **"Da tenere d'occhio oggi":** Massimo 3 card prioritarie con segnali freschi o notifiche urgenti.
4. **Watchlist Personale:**
   - In modalità Semplice: card compatte con prezzo, variazione %, indicatore di freschezza e link rapido alla scheda tecnica.
   - In modalità PRO: tabella completa con prezzi bid/ask, timestamp UTC esatti, fornitore di dati e volumi.
5. **Market Pulse (Stato Principali Borse):** Stato di apertura (Aperta / Chiusa / Pre-Market) dei principali hub mondiali (XNYS, XNAS, XETR, XMIL, XPAR) con indicazione dei fusi orari locali.

### 3.2 Vista Mercati
1. **Selettore Strumento & Switch Timeframe:** Selezione rapida tra Azioni, ETF, Crypto e Indici.
2. **Pannello Regime di Mercato (Market Regime Panel):**
   - In modalità Semplice: barra visiva con traduzione semantica (es. "Mercato laterale con volatilità moderata").
   - In modalità PRO: deviazioni standard, valori numerici ATR, ADX e range di oscillazione.
3. **Grafico Candlestick Avanzato:** Grafico TradingView Lightweight Charts con sovrapposizione di medie mobili e livelli di supporto/resistenza.
4. **Scheda Broker & Nomenclatura:** Mappatura tra ticker reale e simbologia specifica dell'intermediario selezionato (Trade Republic, IBKR, Scalable Capital, Binance), con spiegazione del tipo di esecuzione (Spot vs Derivato/CFD).

### 3.3 Vista Opportunità & Screener
1. **Controlli di Ricerca & Filtri:** Filtri per classe di asset, orizzonte temporale e classificazione del segnale.
2. **Simulatore Posizione (Position Simulator):**
   - Calcolo del capitale da impiegare, dimensionamento della posizione (Position Sizing) in base alla percentuale di rischio accettata (es. 1% del portafoglio) e rapporto Rischio/Rendimento (R:R).
3. **Smart Scanner V3:** Elenco deterministico delle configurazioni confermate dal motore quantitativo, ordinate per punteggio di affidabilità.

### 3.4 Vista Portafoglio & Gestione Rischio
1. **KPI Patrimoniali:** Capitale a Costo, Valore di Mercato, P&L Totale, Indice di Concentrazione HHI e Liquidità residua.
2. **Grafico di Allocazione per Asset Class:** Istogramma o grafico a barre della ripartizione percentuale del capitale.
3. **Modulo Inserimento Operazioni:** Form intuitivo per registrare acquisti, vendite, dividendi e depositi/prelievi, con conversione multi-valuta automatica (EUR, USD, GBP, CHF).
4. **Tabella Posizioni Aperte:** Visualizzazione dettagliata con prezzo medio di carico (PMC), prezzo attuale, peso percentuale sul totale e rendimento.
5. **Import/Export CSV:** Possibilità di esportare l'intero storico o importare file CSV compatibili.

### 3.5 Vista "Altro" (Hub Sottomoduli)
Un hub moderno e pulito che raggruppa in modo ordinato:
- **Trading Lab:** Ambiente simulato (Paper Trading) con capitale virtuale e motore di Backtesting storico deterministico su serie storiche.
- **Notifiche:** Storico alert ricevuti, invio test Web Push e gestione autorizzazioni del browser.
- **Impostazioni & Diagnostica:** Stato di salute dei provider esterni (Finnhub, CoinGecko, Frankfurter, Binance), sincronizzazione cloud Supabase e preferenze di sistema.

---

## 4. Flusso Dati e Aggiornamento Continuo

DemInvest implementa un ciclo di sincronizzazione deterministico non bloccante:
1. **Avvio / Service Worker:** Verifica disponibilità della cache offline PWA e registrazione al push manager VAPID.
2. **Background Quote Polling:** Polling regolare dei prezzi di mercato per gli asset in watchlist e portafoglio.
3. **Event-Driven Signal Evaluation:** Ogni variazione di prezzo o trigger temporale esegue i motori analitici locali; se viene rilevata una condizione critica, viene generata una notifica push e sincronizzata con Supabase.
4. **Contextual AI Invocation:** L'assistente AI interroga i dati di mercato già convalidati nel contesto React senza mai inventare cifre o eseguire ordini all'insaputa dell'utente.
