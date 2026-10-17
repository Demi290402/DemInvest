# SIGNAL_ENGINE.md — Motore Quantitativo, Orizzonti e Signal Intelligence

## 1. Quantitative Analysis Engine (`src/engines/quantitativeEngine.ts`)

Tutti gli indicatori sono calcolati in modo deterministico esclusivamente sulle candele chiuse (`isClosed !== false`):
- **Trend**: `SMA(20)`, `SMA(50)`, `SMA(200)`, `EMA(12)`, `EMA(20)`, `EMA(26)`, `ADX(14)` (metodo di Wilder), distanza percentuale dalle medie.
- **Momentum**: `RSI(14)` (metodo di Wilder), `MACD(12, 26, 9)`, `ROC(10)`, `Stochastic(14, 3)`.
- **Volatilità**: `ATR(14)` (Wilder), `Bande di Bollinger(20, 2)`, Volatilità Storica Annualizzata sui rendimenti logaritmici, `Maximum Drawdown (%)`.
- **Volume**: `Volume SMA(20)`, `Relative Volume (RVOL)`, `On-Balance Volume (OBV)`.
- **Supporti e Resistenze (`PIVOT_FRACTAL_ATR_CLUSTER_V1`)**:
  1. Individua i massimi e minimi locali tramite finestra frattale simmetrica a 5 barre chiuse $[i-2, i-1, i, i+1, i+2]$.
  2. Raggruppa i pivot la cui distanza è inferiore a $\max(0.75 \times \text{ATR}_{14}, 1.0\% \text{ del prezzo})$.
  3. Calcola `touches` e `strengthScore` (1–100) classificando i livelli sotto la chiusura attuale come `SUPPORT` e quelli sopra come `RESISTANCE`.

---

## 2. Time Horizon Engine (`src/engines/signalIntelligenceEngine.ts`)

| Orizzonte | Durata | Ritardo Max Dati Ammesso | Regola Specifiche |
| :--- | :--- | :--- | :--- |
| `BREVISSIMO` | Minuti – 24 ore | $180\text{ s}$ | **Blocco automatico** di qualsiasi segnale operativo se il dato è `EOD`, `STALE` o con ritardo $> 180\text{ s}$. |
| `BREVE` | 1 – 30 giorni | $3600\text{ s}$ | Focus su swing, momentum (RSI/MACD), pullback su SMA20 e invalidazione basata su ATR(14). |
| `MEDIO` | 1 – 12 mesi | $86400\text{ s}$ | Focus su struttura primaria (SMA50/SMA200), regime di volatilità e drawdown. |
| `LUNGO` | $> 12$ mesi | $86400\text{ s}$ | Focus su allocazione strategica, accumulo PAC, costi e rischio di concentrazione. |

---

## 3. Regole Deterministiche e No-Trade Detector

- **Punteggio Euristico (`0–100`)**: Media ponderata trasparente di `trendScore` (28%), `momentumScore` (25%), `volatilityRiskScore` (20%), `volumeConfirmationScore` (15%) e `dataQualityScore` (12%). Non viene mai presentato come "probabilità di successo".
- **Distinzione `SELL_SETUP` vs Short**: Un segnale `SELL_SETUP` segnala un deterioramento tecnico o eccesso di ipercomprato utile per valutare la presa di profitto o l'uscita da una posizione long esistente, **mai** l'apertura automatica di una vendita allo scoperto.
- **No-Trade Detector**: Quando mancano dati validi, osservazioni sufficienti o convergenza degli indicatori, restituisce `NO_TRADE` elencando in `conditionsUnmet` tutti i criteri non soddisfatti.
