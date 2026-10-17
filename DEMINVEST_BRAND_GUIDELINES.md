# DEMINVEST — BRAND GUIDELINES
## Manuale Ufficiale di Identità Visiva, Brand Strategy e Tone of Voice
**Versione:** 1.0 (Fase 4 Release)  
**Applicazione:** DemInvest — Personal Investment Intelligence PWA

---

## 1. VISIONE E POSIZIONAMENTO DEL BRAND

### 1.1 Il Brand Claim
> **“Una guida intelligente, chiara e disciplinata per orientarsi nei mercati.”**

DemInvest è una Progressive Web App privata progettata per trasformare la complessità caotica dei mercati finanziari globali in un flusso ordinato, trasparente e matematicamente rigoroso di supporto decisionale.

### 1.2 La Nostra Promessa
- **Zero Illusioni:** Nessuna promessa di rendimento garantito o previsione dogmatica del futuro.
- **Disciplina Analitica:** Separazione rigorosa tra calcoli quantitativi deterministici ed elaborazioni sintetiche dell'AI.
- **Controllo e Trasparenza:** Ogni quotazione, indicatore, segnale e calcolo di rischio espone la propria fonte ufficiale, il timestamp UTC di rilevamento e la latenza (tempo reale vs differito vs End-of-Day).
- **Protezione Totale:** L'applicazione non richiede e non gestisce credenziali dispositive dei broker dell'utente; nessun ordine automatico può essere immesso a mercato.

---

## 2. PERSONALITÀ DEL BRAND

DemInvest comunica con una personalità definita da 10 tratti cardine:

1. **Affidabile:** Dati verificabili, fonti ufficiali e fail-safe trasparente.
2. **Intelligente:** Sintesi contestuale delle relazioni tra strumenti, macroeconomia e portafoglio.
3. **Disciplinata:** Regole scritte, gestione del rischio prima del profitto, controllo drawdown.
4. **Calma:** Interfacce sobrie, senza allarmismi o grafiche frenetiche da trading floor.
5. **Moderna:** Architettura PWA nativa, grafica edge-to-edge, supporto touch ergonomico.
6. **Chiara:** Gerarchie visive immediate; complessità svelata progressivamente (Progressive Disclosure).
7. **Strategica:** Visione d'insieme del patrimonio, correlazioni settoriali e diversificazione.
8. **Elegante:** Palette fintech istituzionale (Deep Navy, Graphite, Emerald Teal, Smart Green).
9. **Tecnologica:** Motore di calcolo su edge worker Cloudflare, TypeScript e modelli quantitativi V3.
10. **Accessibile:** Contrasto WCAG 2.1 AA, numeri tabellari a larghezza fissa, comprensibilità per tutti i livelli.

---

## 3. TONE OF VOICE (IL LINGUAGGIO DELL'INTERFACCIA)

Il tono di voce di DemInvest è professionale, autorevole, rassicurante e orientato alla comprensione.

### 3.1 Glossario di Espressioni: Cosa Usare vs Cosa Evitare

| ❌ DA EVITARE ASSOLUTAMENTE | ✅ DA UTILIZZARE IN DEMINVEST |
| :--- | :--- |
| "Guadagno sicuro / Rendimento garantito" | "Rapporto Rischio/Rendimento calcolato" |
| "Opportunità imperdibile / Compra ora!" | "Configurazione quantitativa rilevata da valutare" |
| "Previsione certa / Il mercato salirà" | "Scenario statistico basato su trend e volatilità storica" |
| "Allerta crollo imminente!" | "Alert di rischio volatilità / rottura supporto dinamico" |
| "Fai trading a leva e moltiplica i profitti" | "I CFD sono strumenti derivati OTC con costi di mantenimento (swap)" |
| "Dato in tempo reale" (se differito) | "Dato differito di 15 min dal feed ufficiale" |
| "Compra al meglio" | "Zona di ingresso indicativa / Livello di invalidazione" |

---

## 4. SISTEMA CROMATICO UFFICIALE (PALETTE FINTECH)

La palette colori è studiata per garantire calma visiva, autorevolezza istituzionale e massimo contrasto in Dark Mode e Light Mode.

### 4.1 Colori Core Fondamentali

| Colore | HEX Code | Ruolo Primario nell'Interfaccia |
| :--- | :--- | :--- |
| **Deep Navy** | `#0F172A` | Sfondo primario dark mode, card header, cornici istituzionali |
| **Graphite** | `#1E293B` | Superfici secondarie, card contenitive, bordi elevati |
| **Emerald Teal** | `#0F766E` | Brand accent istituzionale, intestazioni e dettagli di pregio |
| **Smart Green** | `#10B981` | Brand primario, indicatori di trend costruttivo, pulsanti primari |
| **Soft Mist** | `#E2E8F0` | Bordi leggeri light mode, testi secondari su sfondi scuri |
| **Clean White** | `#F8FAFC` | Sfondo pulito light mode, testi ad alto contrasto dark mode |

### 4.2 Colori Funzionali & Segnaletici

| Colore | HEX Code | Semantica Funzionale |
| :--- | :--- | :--- |
| **Positive / Growth** | `#22C55E` | Trend rialzista, profitto non realizzato, verifiche superate |
| **Warning / Attention** | `#F59E0B` | Alert di alleggerimento, volatilità anomala, feed differiti, demo mode |
| **Risk / Invalidation** | `#EF4444` | Prezzo di invalidazione, perdite, stop loss superati, errori di feed |
| **Insight / Info AI** | `#06B6D4` | Assistenza contestuale DemInvest AI, breakout confermati |

---

## 5. REGOLE D'USO DEL COLORE E ACCESSIBILITÀ

1. **Mai affidarsi solo al colore:** Qualsiasi variazione positiva o negativa, stato di rischio o allarme deve essere sempre affiancato da un'icona semantica (`TrendingUp`, `AlertTriangle`, `CheckCircle2`) e da un'etichetta testuale esplicita.
2. **Rosso confinato al Rischio:** Il colore rosso `#EF4444` non deve essere usato per elementi decorativi; è riservato esclusivamente a livelli di invalidazione, superamento di budget di perdita o errori di sistema.
3. **Contrasto WCAG 2.1 AA:** Tutti i testi primari e secondari superano il rapporto di contrasto minimo di 4.5:1 contro i rispettivi sfondi (`#0F172A` in dark mode e `#F8FAFC` in light mode).

---

## 6. TIPOGRAFIA ISTITUZIONALE

- **Carattere Primario Display & Body:** `Inter`, `system-ui`, `-apple-system`, `sans-serif`.  
  Carattere pulito, geometrico ed estremamente leggibile su schermi ad alta densità (Retina/OLED).
- **Carattere Numerico Finanziario:** `JetBrains Mono`, `Fira Code`, `ui-monospace`.  
  Utilizzato con la classe CSS `.num-mono` (`tabular-nums`) per garantire che tutte le cifre, decimali e percentuali abbiano larghezza identica, facilitando la scansione visiva verticale di tabelle e KPI.

---

## 7. ARCHITETTURA DEL LOGO E BRAND MARK

Il marchio grafico ufficiale di DemInvest:
- Combina un poligono protettivo / esagono ad anello e una curva di crescita dinamica verde smeraldo con freccia ascendente, a simboleggiare protezione patrimoniale e intelligenza analitica.
- **Asset Primario:** `/public/Logo_no_sfondo.png` (PNG trasparente a 32-bit ad alta risoluzione).
- **Varianti e Favicon Distribuite:**
  - `index.html`: `<link rel="icon" type="image/png" href="/Logo_no_sfondo.png">` e `<link rel="apple-touch-icon" href="/Logo_no_sfondo.png">`
  - Fallback legacy: `/public/favicon.ico` e `/public/favicon.png`
  - PWA Manifest: `/public/manifest.webmanifest` con icona PNG 397×403 e SVG vettoriali mascherabili
  - Service Worker: precache in `STATIC_ASSETS` per operatività offline e caricamento immediato
- Il payoff istituzionale fisso è: **"Personal Investment Intelligence"**.
