# DemInvest — Pattern di UX Finanziaria (Release 5)
## Standard di Comunicazione, Traduzione Semantica e Formattazione dei Dati

**Progetto:** DemInvest  
**Versione:** 5.0.0  
**Ruolo:** Financial Data UX Specialist & Fintech Product Expert  

---

## 1. Principi della Comunicazione Finanziaria in DemInvest

La finanza e il trading quantitativo sono ricchi di gergo tecnico, acronimi e convenzioni matematiche che spesso creano barriere cognitive per l'investitore o generano un senso di finto controllo.

DemInvest persegue tre regole auree di comunicazione:
1. **La Verità Prima dell'Azione:** Nessun segnale viene presentato come certezza o consiglio di acquisto ("Buy Now"). Ogni configurazione è descritta come uno scenario probabilistico verificabile con precise condizioni di invalidazione.
2. **Numeri Senza Trucchi:** Tutte le cifre sono calcolate in modo deterministico, con tassi di cambio ufficiali BCE e timestamp espliciti.
3. **Semantica Umana in Modalità Semplice, Precisione Scientifica in Modalità PRO:** La modalità semplice offre spiegazioni discorsive e rassicuranti; la modalità pro consente di esplorare le deviazioni statistiche e i raw log.

---

## 2. Matrice di Traduzione Semantica

Il modulo `src/lib/financialSemantics.ts` centralizza la conversione dei codici di backend in linguaggio comprensibile:

| Codice Motore Interno | Modalità Semplice (Human Copy) | Descrizione Operativa per l'Utente | Modalità PRO (Dati Tecnici) |
| :--- | :--- | :--- | :--- |
| `BULLISH_TREND` | **Trend Rialzista** | Il prezzo si muove stabilmente sopra le medie mobili principali. | `SMA(20) > SMA(50) > SMA(200)` |
| `BEARISH_TREND` | **Trend Ribassista** | Pressione di vendita con massimi e minimi decrescenti. | `SMA(20) < SMA(50) < SMA(200)` |
| `SIDEWAYS` | **Mercato Laterale** | Fase di consolidamento senza una direzione dominante chiara. | `ADX < 20`, oscillazione in canale ATR |
| `HIGH_VOLATILITY` | **Volatilità Elevata** | Movimenti di prezzo ampi e repentini; rischio aumentato. | `ATR(14) > 1.5 * EMA(ATR, 50)` |
| `LOW_VOLATILITY` | **Volatilità Bassa / Compressione** | Prezzo compresso in range ristretto; potenziale breakout futuro. | `ATR(14) < 0.7 * EMA(ATR, 50)` |
| `NO_TRADE` | **Nessuna Configurazione Confermata** | I parametri tecnici e il rapporto rischio/rendimento non soddisfano i requisiti di ingresso. | Criteri filtro non soddisfatti |
| `UNCONFIRMED_BY_HIGHER_TF` | **Trend non confermato su timeframe superiore** | Il segnale di breve periodo contrasta con la tendenza su timeframe più ampio (es. 1H vs 1D). | Disallineamento multi-timeframe |
| `HIGH_CONCENTRATION_RISK` | **Elevata Concentrazione** | Uno o pochi asset occupano una quota sproporzionata del portafoglio ($HHI > 2500$). | $HHI \ge 2500$ |
| `PIVOT_FRACTAL_ATR_CLUSTER_V1` | **Cluster Frattale ATR** | Analisi dei livelli pivot con filtro sulla volatilità reale. | Strategia quantitativa V1 |

---

## 3. Standard di Formattazione Numerica e Valutaria

### 3.1 Allineamento e Numeri Tabulari
- Tutti i prezzi, percentuali, quantità e controvalori utilizzano la classe `.num-mono`:
  ```css
  font-family: 'JetBrains Mono', monospace;
  font-variant-numeric: tabular-nums;
  ```
- Nelle tabelle e liste, i dati numerici sono sempre **allineati a destra**, consentendo il confronto visivo istantaneo dell'ordine di grandezza dei valori.

### 3.2 Valute e Decimali
- **Euro (`EUR`), Dollaro USA (`USD`), Sterlina (`GBP`), Franco Svizzero (`CHF`):**
  - Valori superiori a 1,00: formattati con esattamente **2 cifre decimali** (es. `€ 1.250,50`, `$ 68.420,10`).
  - Prezzi crypto o micro-azioni inferiori a 1,00: formattati con **4 cifre decimali** (es. `$ 0,0425`).
- **Segno e Colore delle Variazioni Percentuali:**
  - Variazioni positive: prefisso esplicito `+` e colore verde controllato (`+2,45%`).
  - Variazioni negative: prefisso `-` e colore rosso rosato controllato (`-1,80%`).
  - Variazioni invariate (0,00%): prefisso neutro e colore grigio ardesia (`0,00%`).

---

## 4. Visualizzazione del Rischio di Concentrazione (Indice HHI)

L'indice Herfindahl-Hirschman ($HHI$) è lo standard economico istituzionale per misurare la concentrazione di un portafoglio:
$$HHI = \sum_{i=1}^{N} w_i^2 \quad \text{dove } w_i \in [0, 100] \text{ è il peso percentuale dell'asset } i$$

### 4.1 Livelli e Badge di Rischio HHI
| Valore HHI | Denominazione Semantica | Badge Visivo | Azione Consigliata per l'Investitore |
| :--- | :--- | :--- | :--- |
| **0 – 1.500** | **Portafoglio Ben Diversificato** | Verde Smeraldo | Asset allocation equilibrata tra strumenti decorrelati. |
| **1.501 – 2.500** | **Concentrazione Moderata** | Giallo Ambra | Alcune posizioni hanno un peso rilevante; monitorare le correlazioni. |
| **2.501 – 10.000** | **Elevata Concentrazione** | Rosso Rischio | Singola posizione dominante; elevata vulnerabilità a drawdown asimmetrici. |

---

## 5. Stato di Freschezza dei Dati e Trasparenza delle Fonti

Ogni quotazione e metrica visualizzata in DemInvest espone chiaramente la propria origine e il grado di freschezza:

- **Quotazione in Tempo Reale / Recente (&le; 15 min):** Badge verde `Aggiornato` con indicazione della fonte (es. *CoinGecko*, *Finnhub Realtime*).
- **Quotazione Differita / Chiusura (EOD):** Badge grigio `Fine Giornata` con timestamp UTC esatto della seduta (es. *Borse UE / BCE Frankfurter*).
- **Stato Offline:** Banner di avviso rosso e badge arancione `Dati Memorizzati`, per prevenire decisioni su prezzi non aggiornati durante interruzioni di connettività.

---

## 6. Disclaimer Operativi vs Notifiche

Per mantenere un tono professionale e non intimidatorio:
- I disclaimer legali (es. *"DemInvest è uno strumento di intelligence privata per finalità analitiche e non costituisce sollecitazione al pubblico risparmio"*) sono posizionati discretamente nel footer e nel drawer dell'assistente AI.
- Le notifiche di sistema utilizzano un linguaggio asciutto e orientato ai fatti: *"Raggiunto il livello di stop volumetrico su Apple Inc. alle 14:32 UTC. Consulta la scheda per valutare lo scenario."*
