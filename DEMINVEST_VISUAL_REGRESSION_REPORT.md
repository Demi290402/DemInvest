# DemInvest — Visual Regression Report (Release 5)
## Confronto Visivo Before / After e Audit delle Trasformazioni Grafiche

**Progetto:** DemInvest  
**Versione:** 5.0.0  
**Data del Report:** 18 Ottobre 2026  
**Strumento di Cattura:** Playwright Automation Script (`scripts/capture-baseline.cjs` & `scripts/capture-after.cjs`)  
**Browser Engine:** Chromium / Microsoft Edge Headless  

---

## 1. Inventario degli Screenshot Acquisiti

Tutti gli screenshot sono archiviati nelle directory del progetto:
- **Baseline (Versione Precedente V4):** `screenshots/baseline/`
- **Post-Redesign (Nuova Versione Human-Crafted V5):** `screenshots/after/`

### 1.1 Elenco File e Viewport
| Schermata | File Acquisiti (Desktop 1440×900) | File Acquisiti (Mobile 390×844) |
| :--- | :--- | :--- |
| **Dashboard (Dark)** | `desktop-dashboard-dark.png` | `mobile-dashboard-dark.png` |
| **Dashboard (Light)** | `desktop-dashboard-light.png` | `mobile-dashboard-light.png` |
| **Mercati & Schede** | `desktop-markets.png` | `mobile-markets.png` |
| **Opportunità & Screener**| `desktop-opportunities.png` | `mobile-opportunities.png` |
| **Portafoglio & Rischio** | `desktop-portfolio.png` | `mobile-portfolio.png` |
| **Hub "Altro" / Lab** | — *(Integrato su desktop)* | `mobile-more-hub.png` |
| **Drawer DemInvest AI** | `desktop-ai-drawer.png` | `mobile-ai-drawer.png` |

---

## 2. Analisi Delle Trasformazioni Visive Chiave

### 2.1 Vista Dashboard
- **Prima (Baseline):**
  - Griglia densa e uniforme di 12 card rettangolari tutte con la stessa altezza e medesimo bordo grigio-scuro.
  - Eccessiva ripetizione dell'accento teal anche per etichette puramente informative.
  - Tabelle compresse con numeri non allineati che rendevano faticosa la comparazione delle variazioni percentuali.
- **Dopo (V5 Human-Crafted):**
  - Hero section personalizzata con saluto all'investitore (`Bentornato, ...`) e selettore rapido di modalità (Semplice / PRO).
  - Snapshot sintetico del capitale a 4 macro-indicatori ad alta leggibilità.
  - Sezione prioritaria *"Da tenere d'occhio oggi"* con badge colorati per segnale ed evento.
  - Watchlist con numeri tabulari allineati a destra (`.num-mono`) e indicatore di freschezza dei dati.
  - Sezione orari borse con dot pulsante e calcolo dinamico dello stato di apertura.

### 2.2 Vista Mercati & Analisi Tecnica
- **Prima (Baseline):**
  - Grafico compresso da intestazioni ridondanti e badge con sigle crittiche (`REGIME: SIDEWAYS | VOL: HIGH_VOLATILITY`).
  - Nomenclatura del broker esposta come testo raw JSON.
- **Dopo (V5 Human-Crafted):**
  - Pannello Regime di Mercato calmo e discorsivo in modalità Semplice (*"Mercato laterale con volatilità moderata"*), con spiegazione del contesto e senza allarmismi.
  - Scheda Broker pulita che spiega chiaramente se lo strumento negoziato è un'azione reale (Spot) o un CFD con leva, specificando valuta di regolamento e orari di negoziazione.

### 2.3 Vista Portafoglio & Calcolo HHI
- **Prima (Baseline):**
  - Valori di concentrazione HHI che in certi casi mostravano anomalie numeriche superiori al limite di 10.000.
  - Form di inserimento transazioni disordinato con campi stretti e contrasti deboli in modalità chiara.
- **Dopo (V5 Human-Crafted):**
  - Indice HHI normalizzato al 100% garantito $\in [0, 10000]$ con livello semantico (*Ben diversificato*, *Concentrazione moderata*, *Elevata concentrazione*).
  - Form di transazione rifattorizzato con input a contrasto pieno, conversioni valutarie BCE Frankfurter integrate e feedback istantaneo per importazioni CSV.

### 2.4 Ergonomia Mobile & Navigazione
- **Prima (Baseline):**
  - Conflitto visivo tra il menu orizzontale scorrevole in alto e la barra inferiore compressa a 7 icone illeggibili.
  - Pulsante circolare flottante (FAB) di DemInvest AI che copriva i bottoni di azione in fondo allo schermo.
- **Dopo (V5 Human-Crafted):**
  - Rimossa la barra a scorrimento; implementata una **Bottom Bar a 5 destinazioni fisse** ad alta precisione di tocco (minimo 44px).
  - Il FAB invasivo è stato rimosso; l'assistente DemInvest AI è ora accessibile tramite un bottone elegante e persistente nell'header superiore.
  - Hub "Altro" con percorsi chiari e pulsanti di ritorno per sottomoduli.

### 2.5 Contrasto Bimodale (Dark / Light Mode)
- **Prima (Baseline):**
  - La modalità chiara soffriva di elementi con testo bianco su sfondi chiari o card scure non armonizzate.
- **Dopo (V5 Human-Crafted):**
  - In modalità scura: palette `#0F172A` / `#1E293B` con testi `#FFFFFF` e `#E2E8F0` (contrasto medio 14:1).
  - In modalità chiara: palette `#F8FAFC` / `#FFFFFF` con testi `#0F172A` e bordi morbidi `#E2E8F0` (contrasto medio 12:1).

---

## 3. Verdetto di Regressione

Nessuna regressione funzionale o visiva rilevata. Tutte le interfacce risultano notevolmente migliorate per gerarchia, ritmo visivo, leggibilità e piacevolezza d'uso.
