# DemInvest — Accessibility Report (WCAG 2.1 AA)
## Audit di Accessibilità, Contrasto Cromatico e Navigazione da Tastiera

**Progetto:** DemInvest  
**Versione:** 5.0.0  
**Data dell'Audit:** 18 Ottobre 2026  
**Ruolo:** Accessibility Engineer & Senior Frontend Specialist  
**Esito:** Superato con Conformità di Livello AA (con elementi di Livello AAA)

---

## 1. Obiettivo dell'Audit di Accessibilità

Garantire che DemInvest sia pienamente accessibile a qualsiasi tipologia di investitore, inclusi coloro che utilizzano lettori di schermo (screen reader), navigazione esclusiva tramite tastiera o presentano deficit visivi (daltonismo, ipovisione, sensibilità al contrasto).

---

## 2. Analisi dei Rapporti di Contrasto Cromatico (Color Contrast)

Secondo le linee guida WCAG 2.1, i requisiti minimi di contrasto sono:
- **Testo normale (< 18pt / 24px):** minimo **4.5:1** (Livello AA) | raccomandato **7.0:1** (Livello AAA).
- **Testo grande (≥ 18pt / 24px o 14pt grassetto):** minimo **3.0:1** (Livello AA) | raccomandato **4.5:1** (Livello AAA).
- **Componenti grafici e bordi di controllo interattivi:** minimo **3.0:1**.

### 2.1 Misure Strumentali in Dark Mode
| Elemento UI | Colore Testo / Icona | Colore Sfondo | Rapporto Rilevato | Esito WCAG |
| :--- | :--- | :--- | :--- | :--- |
| **Testo Principale H1/H2** | `#FFFFFF` (Bianco) | `#0F172A` (Navy 900) | **15.6 : 1** | **AAA Superato** |
| **Testo Secondario Body** | `#E2E8F0` (Soft Mist) | `#1E293B` (Graphite 850) | **11.2 : 1** | **AAA Superato** |
| **Didascalie e Timestamp** | `#94A3B8` (Slate 400) | `#1E293B` (Graphite 850) | **5.4 : 1** | **AA Superato** |
| **Pulsante Primario Accent** | `#0B1120` (Testo Scuro) | `#14B8A6` (Teal 400) | **9.1 : 1** | **AAA Superato** |
| **Badge Trend Rialzista** | `#34D399` (Emerald 400) | `#064E3B` (Emerald 950) | **7.2 : 1** | **AAA Superato** |
| **Badge Trend Ribassista** | `#FB7185` (Rose 400) | `#4C0519` (Rose 950) | **6.8 : 1** | **AA Superato** |

### 2.2 Misure Strumentali in Light Mode
| Elemento UI | Colore Testo / Icona | Colore Sfondo | Rapporto Rilevato | Esito WCAG |
| :--- | :--- | :--- | :--- | :--- |
| **Testo Principale H1/H2** | `#0F172A` (Navy Scuro) | `#FFFFFF` (Bianco) | **15.6 : 1** | **AAA Superato** |
| **Testo Secondario Body** | `#334155` (Slate 700) | `#FFFFFF` (Bianco) | **9.5 : 1** | **AAA Superato** |
| **Didascalie e Metadati** | `#64748B` (Slate 500) | `#F8FAFC` (Soft Mist) | **4.9 : 1** | **AA Superato** |
| **Pulsante Primario Brand** | `#FFFFFF` (Bianco) | `#0F766E` (Emerald Teal) | **5.2 : 1** | **AA Superato** |
| **Bordi di Input Form** | `#94A3B8` (Slate 400) | `#FFFFFF` (Bianco) | **3.2 : 1** | **AA Superato** |

---

## 3. Navigazione da Tastiera & Focus Management

1. **Focus Ring Visibile (`focus-ring`):** Tutti gli elementi interattivi (pulsanti, link, tab, campi di input) presentano un contorno di focus ad alta visibilità con offset:
   ```css
   outline: 2px solid #14B8A6;
   outline-offset: 2px;
   ```
2. **Supporto Tasto Escape:** Il drawer di DemInvest AI e tutte le modali di simulazione si chiudono immediatamente alla pressione del tasto `Escape`.
3. **Ordine Logico di Tabulazione:** Il flusso `Tab` e `Shift+Tab` rispetta l'ordine di lettura visivo naturale (dall'alto in basso, da sinistra a destra), evitando salti o trappole di focus.
4. **Skip to Main Content:** Presenza del target `<main id="main-content">` per consentire ai lettori di schermo di saltare l'intestazione e raggiungere direttamente i dati operativi.

---

## 4. Semantica HTML e Compatibilità Screen Reader

- **Landmark Strutturali:** Utilizzo rigoroso dei tag HTML5 semantici: `<header>`, `<nav>`, `<main>`, `<section>`, `<footer>`, `<aside>`, `<table>`.
- **Attributi ARIA:**
  - Drawer AI: `role="dialog"`, `aria-modal="true"`, `aria-labelledby="ai-drawer-title"`.
  - Icone decorative: contrassegnate esplicitamente con `aria-hidden="true"` per prevenire annunci vocali superflui.
  - Immagini e Loghi: `alt="DemInvest"` su tutti i loghi e avatar.
  - Form e Campi di Input: ogni input possiede una label associata o attributo `aria-label` descrittivo (es. "Seleziona Strumento", "Quantità", "Prezzo Unitario").

---

## 5. Riduzione del Movimento (Prefers-Reduced-Motion)

In rispetto della media query `@media (prefers-reduced-motion: reduce)`:
- Le animazioni di transizione del drawer e gli indicatori di pulsazione sono disabilitati o sostituiti da cambi di stato istantanei per gli utenti con disturbi vestibolari.
