# DemInvest — Linee Guida Mobile UX (Release 5)
## Standard Ergonomici per PWA Finanziaria Mobile-First

**Progetto:** DemInvest  
**Versione:** 5.0.0  
**Ruolo:** Mobile UX Engineer & Human-Computer Interaction Specialist  

---

## 1. Filosofia Mobile-First

DemInvest è concepita principalmente per l'utilizzo in mobilità: un investitore deve poter verificare le quotazioni, controllare il rischio del portafoglio e consultare l'assistente AI in pochi secondi, con una sola mano e in qualsiasi condizione di luce.

---

## 2. Principi Ergonomici Fondamentali

### 2.1 The Thumb Zone (Zona di Raggiungibilità del Pollice)
Il 75% delle interazioni con lo smartphone avviene tramite l'uso del pollice della mano dominante:
- **Zona Naturale (Basso dello schermo):** Riservata alla navigazione primaria a 5 tab (`Home`, `Mercati`, `Opportunità`, `Portafoglio`, `Altro`) e ai bottoni di conferma primaria.
- **Zona di Portata Facile (Centro dello schermo):** Destinata a scroll di schede, grafici interattivi e selezione strumenti.
- **Zona Difficile (Alto dello schermo):** Riservata a informazioni passive, breadcrumb di ritorno, orario e indicatori di stato (batteria/connessione).

### 2.2 Dimensione Minima dei Bersagli Tattili (Touch Targets)
In conformità con le linee guida Apple Human Interface Guidelines (HIG) e Google Material Design:
- **Tutti gli elementi interattivi (bottoni, tab, checkbox, toggle) hanno una dimensione minima di tocco di 44×44px** (implementata tramite la classe di utilità `.touch-target` o `min-h-[44px]`).
- Spaziatura minima tra due target interattivi adiacenti: almeno **8px** per evitare tocchi accidentali.

---

## 3. Gestione della Safe Area e Home Indicator

Su dispositivi moderni (iPhone con Dynamic Island / Home Indicator e smartphone Android edge-to-edge):
- La barra inferiore include il padding per la Safe Area:
  ```html
  <nav className="... pb-[env(safe-area-inset-bottom,0px)]">
  ```
- Il contenitore principale dell'applicazione adotta un padding inferiore di compensazione:
  ```html
  <main className="... pb-24 lg:pb-8">
  ```
  Questo previene l'occlusione degli ultimi elementi delle tabelle o dei form da parte della navigation bar fissa.

---

## 4. Pattern di Interfaccia Mobile

### 4.1 Modali vs Drawer Bottom Sheet
- Su **desktop**, i pannelli contestuali (come DemInvest AI o le schede broker) si aprono come drawer laterali scivolanti da destra (`max-w-2xl`).
- Su **mobile**, il drawer occupa il 100% della larghezza e dell'altezza, trasformandosi in una vista dedicata a schermo intero con pulsante di chiusura (`X`) facilmente raggiungibile in alto a destra e supporto per la gesture o tasto "Esc/Indietro".

### 4.2 Tabelle Finanziarie Responsive
Le tabelle a molte colonne (es. Watchlist PRO e Transazioni Portafoglio) causano problemi di leggibilità su mobile se forzate:
- **Modalità Semplice:** Le tabelle complesse sono sostituite da **Card Compatte verticali** con le 3 metriche chiave (Ticker, Prezzo, Variazione %) immediatamente visibili.
- **Modalità PRO:** Le tabelle estese sono racchiuse in contenitori a scorrimento orizzontale esplicito (`overflow-x-auto`), con la colonna dello strumento fissa e numeri tabulari leggibili.

---

## 5. Feedback Tattile e Stati di Pressione

- **Feedback Visivo Immediato:** Al tocco di un pulsante o elemento della lista, la classe `active:scale-[0.98]` e la transizione di opacità forniscono la sensazione fisica di pressione.
- **Prevenzione del Doppio Tap Zoom:** Disabilitato lo zoom accidentale su doppio tap nei pulsanti della UI (`touch-action: manipulation`).
- **Focus Rings Visibili:** Per utenti che utilizzano tastiere esterne su tablet o dispositivi di accessibilità, ogni elemento interattivo mostra un anello di focus ad alto contrasto (`focus-ring`).

---

## 6. Prestazioni e Caricamento Mobile

- **Zero Layout Shift (CLS):** Le altezze minime delle sezioni grafiche sono prefissate (es. altezza fissa per il canvas del grafico) per evitare scatti durante il caricamento dei dati di mercato.
- **Risparmio Dati & Batteria:** I grafici di trading disattivano il rendering di animazioni pesanti su schermi con refresh ridotto o modalità a basso consumo.
- **Integrazione PWA:** Supporto per installazione diretta su Home Screen con icona ad alta risoluzione (`Logo_no_sfondo.png`), splash screen a sfondo navy e avvio standalone istantaneo senza barre del browser.
