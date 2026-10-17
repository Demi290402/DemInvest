# DEMINVEST — DESIGN SYSTEM SPECIFICATION
## Component Architecture, UI Tokens, Accessibility & Responsive Guidelines
**Versione:** 1.0 (Fase 4 Release)  
**Stack UI:** React 18, Tailwind CSS, Lucide Icons, Recharts, Lightweight Charts

---

## 1. DESIGN TOKENS

### 1.1 Palette Cromatica (Tokens Tailwind)

```css
/* Core Colors */
--color-navy-950: #0A0F1D;       /* Ultra Deep Background */
--color-navy-900: #0F172A;       /* Deep Navy Base Surface */
--color-navy-850: #141E33;       /* Elevated Card Surface */
--color-navy-800: #1E293B;       /* Graphite Navy / Borders */

--color-brand-smart: #10B981;    /* Smart Green (Primary Brand) */
--color-brand-teal: #0F766E;     /* Emerald Teal (Refined Accent) */
--color-mist: #E2E8F0;           /* Soft Mist */
--color-clean: #F8FAFC;          /* Clean White */

/* Functional Colors */
--color-positive: #22C55E;       /* Bullish / Profit / Valid */
--color-warning: #F59E0B;        /* Warning / Delayed / Exit Warning */
--color-risk: #EF4444;           /* Invalidation / Drawdown / Stale */
--color-insight: #06B6D4;        /* AI Insights / Cyan Breakout */
```

### 1.2 Scala Tipografica

| Nome Token | Dimensione (px / rem) | Peso Font | Interlinea | Utilizzo Primario |
| :--- | :--- | :--- | :--- | :--- |
| **Display** | `32px / 2.0rem` | `800 (Extrabold)` | `1.15` | Saluto Dashboard, Valore Totale Portafoglio |
| **Heading 1** | `24px / 1.5rem` | `700 (Bold)` | `1.2` | Titolo Schermata, Prezzo Asset Scheda |
| **Heading 2** | `18px / 1.125rem` | `700 (Bold)` | `1.3` | Titolo Sezione, Modale, Drawer Header |
| **Section Title**| `14px / 0.875rem` | `700 (Bold)` | `1.4` | Intestazione Card, KPI Title, Nome Tab |
| **Body** | `13px / 0.8125rem` | `400 / 500` | `1.5` | Testo esplicativo, motivazioni quantitative |
| **Caption / Meta**| `11px / 0.6875rem` | `500 (Medium)` | `1.4` | Timestamp feed, etichette fonti, disclaimer |
| **Mono Numerical**| `12-24px` | `600 / 700 / 800` | `1.0` | Cifre prezzi, percentuali, R/R, ATR, ADX |

### 1.3 Spaziature e Raggio di Arrotondamento (Radii)

- **Border Radius:**
  - `rounded-2xl` (`16px`): Contenitori di primo livello, Card principali, Modali.
  - `rounded-xl` (`12px`): Input, Card interne, Bottoni primari, Selettori.
  - `rounded-lg` (`8px`): Badge, Chip di filtro, Pulsanti secondari, Tooltip.
  - `rounded-full` (`9999px`): Pill di stato, Indicatori di presenza, Avatar.
- **Elevation Shadows:**
  - `shadow-sm`: Ombreggiatura naturale in light mode (`rgba(0, 0, 0, 0.05)`).
  - `shadow-soft-glow`: Bagliore smeraldo discreto sul brand mark (`rgba(16, 185, 129, 0.15)`).
  - `shadow-card-elevated`: Elevazione per modali e drawer flottanti.

---

## 2. CATALOGO COMPONENTI FONDAMENTALI

### 2.1 Top Bar & Mobile Navigation
- **Desktop Header (`lg:flex`):** Include il brand logo, il menu orizzontale a 7 sezioni con barra attiva, il selettore rapido **Semplice vs PRO**, lo switch **LIVE vs DEMO**, il cambio tema Chiaro/Scuro e il pulsante per l'assistente AI.
- **Mobile Bottom Navigation (`lg:hidden`):** Barra ergonomica fissa a fondo schermo con 5 target tattili conformi (altezza minima 44px): Dashboard, Mercati, Opportunità, Portafoglio e Notifiche con contatore numerico.
- **Floating Action Button (FAB):** Tasto rapido flottante per DemInvest AI posizionato a portata di pollice sopra la barra inferiore.

### 2.2 Card e KPI Card
- **`FintechCard`:** Superficie bianca con bordo morbido in Light Mode e superficie `navy-900` con bordo `navy-800` in Dark Mode.
- **`KpiCard`:** Mostra titolo semantico, valore tabellare grande, badge di stato, variazione percentuale formattata e sottotitolo o tooltip contestuale.

### 2.3 Sistema di Badge Semantici (`Badge.tsx`)
1. **`SignalBadge`:** Distingue visivamente `Setup Rialzista`, `Breakout Confermato`, `Uscita Posizione`, `Segnale Ribassista`, `Allerta Volatilità` e `Nessun Setup Attivo`.
2. **`RiskBadge`:** Segnala la fascia di rischio (`Rischio Contenuto`, `Rischio Moderato`, `Rischio Elevato`, `Rischio Alto`) con punteggio sintetico da 0 a 100.
3. **`DataQualityBadge`:** Indica lo stato del Fail-Safe Layer dei dati (`Dati Verificati`, `Differito`, `Obsoleto`, `Invalido`).
4. **`RegimeBadge`:** Combina il regime direzionale (`BULLISH_TREND`, `BEARISH_TREND`, `SIDEWAYS`, `UNCERTAIN`) con la volatilità (`Alta`, `Normale`, `Bassa`, `Squeeze`).
5. **`HorizonBadge`:** Orizzonte temporale dichiarato con icona orologio.

### 2.4 Tooltip Finanziario Accessibile (`Tooltip.tsx`)
Pulsante iconografico a basso ingombro visivo che espone al tocco o al passaggio del cursore la definizione e il significato pratico di concetti quali:
- **ADX (Average Directional Index):** Misura la forza del trend a prescindere dalla direzione.
- **ATR (Average True Range):** Volatilità media per candela utilizzata per dimensionare stop e target.
- **Pivot Confermati:** Massimi e minimi di swing verificati dopo N candele di chiusura per evitare look-ahead bias.
- **Collinearità:** Presenza di più opportunità nello stesso settore o con forte correlazione statistica.

### 2.5 Empty States & Error Boundaries (`EmptyState.tsx`)
Fornisce orientamento calmo, testo rassicurante e un bottone di azione diretta in caso di liste vuote, filtri troppo restrittivi o assenza temporanea di connessione.

---

## 3. STATI VISIVI DEI COMPONENTI (UI STATES)

Tutti i componenti interattivi dell'applicazione implementano 10 stati formali:

1. **Default:** Superficie pulita, bordi geometrici soft, testo contrastato.
2. **Hover:** Bordo leggermente illuminato (`hover:border-brand-500/50`) e transizione di 150ms.
3. **Active:** Leggera contrazione scalare (`active:scale-[0.98]`).
4. **Focus-Visible:** Anello di focus ad alto contrasto conforme a WCAG (`focus-ring`: ring-2 ring-brand-500 ring-offset-2).
5. **Disabled:** Opacità al 50%, cursore non consentito (`cursor-not-allowed`).
6. **Loading:** Animazione pulsante con skeleton loader o indicatore di progresso.
7. **Success:** Bordo e accento smeraldo `#10B981` con icona `CheckCircle2`.
8. **Warning:** Bordo e accento ambra `#F59E0B` con icona `AlertTriangle`.
9. **Error / Invalidation:** Bordo e accento corallo `#EF4444` con icona `AlertCircle`.
10. **Empty:** Card tratteggiata (`border-dashed`) con icona esplicativa e invito all'azione.

---

## 4. ACCESSIBILITÀ E DESIGN INCLUSIVO (WCAG 2.1 AA)

- **Touch Targets Minimi:** Tutti i bottoni primari e i tab della navigazione mobile hanno una dimensione minima di `44 x 44 px` per prevenire tocchi accidentali.
- **Color Independence:** Nessun segnale finanziario è comunicato unicamente attraverso il colore; ogni badge contiene iconografia e testo in chiaro.
- **Screen Reader Support:** Attributi `aria-label`, `role="dialog"`, `role="tab"`, `aria-hidden="true"` su icone decorative e testi alternativi.
- **Navigazione da Tastiera:** Tutti i menu, modali e form sono navigabili sequenzialmente tramite tasto `Tab` e chiudibili tramite tasto `Escape`.
