# DemInvest Design System — Specifica V5
## Human-Crafted Fintech Design Language

**Progetto:** DemInvest  
**Versione:** 5.0.0  
**Ambiente:** Progressive Web App (Mobile-First & Desktop Adaptive)  
**Ruolo:** Design Systems Specialist & Senior Visual Designer  

---

## 1. Fondamenti Visivi e Brand Identity

DemInvest adotta un'identità visiva ispirata alle moderne piattaforme istituzionali di asset management e intelligence quantitativa: calma, disciplinata, autorevole e orientata alla massima chiarezza dei dati finanziari.

### 1.1 Principi di Design
1. **Calma Operativa:** Nessuna animazione aggressiva o colori lampeggianti. L'interfaccia trasmette sicurezza e ponderazione.
2. **Precisione Matematica:** Numeri sempre allineati a destra con spaziatura tabulare (`font-variant-numeric: tabular-nums`).
3. **Gerarchia Esplicita:** Distinzione netta tra dati verificati (fatti), calcoli deterministici (formule) e scenari/ipotesi.
4. **Coerenza Bimodale:** Dark mode nativa e Light mode speculare perfettamente contrastata.

---

## 2. Tavolozza Colori (Color Tokens)

### 2.1 Colori Fondamentali del Brand
| Token Tailwind | Valore HEX | Utilizzo Primario |
| :--- | :--- | :--- |
| `brand-500` | `#0F766E` | Emerald Teal istituzionale, bottoni d'azione principali, accenti brand. |
| `brand-400` | `#14B8A6` | Stato hover e accenti in Dark Mode. |
| `brand-smart` | `#10B981` | Verde brillante disciplinato per badge di conferma e mercati positivi. |
| `navy-950` | `#0B1120` | Sfondo profondo Dark Mode, drawer e header fisse. |
| `navy-900` | `#0F172A` | Sfondo primario app e card in Dark Mode. |
| `navy-850` | `#1E293B` | Superfici sopraelevate e contenitori secondari in Dark Mode. |
| `navy-800` | `#334155` | Bordi di separazione e linee di supporto in Dark Mode. |
| `clean-white` | `#FFFFFF` | Sfondo card in Light Mode, testi primari in Dark Mode. |
| `soft-mist` | `#F8FAFC` | Sfondo pagina in Light Mode. |

### 2.2 Colori Funzionali Finanziari
| Token Funzionale | Valore HEX | Semantica Finanziaria |
| :--- | :--- | :--- |
| `positive` | `#10B981` | Rialzo delle quotazioni, rendimento positivo, validazione superata. |
| `negative` | `#F43F5E` | Ribasso delle quotazioni, drawdown, invalidazione dello scenario. |
| `warning` | `#F59E0B` | Rischio di concentrazione, volatilità anomala, mercato laterale. |
| `info` | `#06B6D4` | Dati verificati da fonti esterne (BCE, Finnhub, CoinGecko). |
| `neutral-muted` | `#64748B` | Timestamp, codici ISIN/MIC, didascalie e metadati secondari. |

---

## 3. Tipografia e Numeri Tabulari

### 3.1 Famiglia Tipografica
- **Testo e UI:** `Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`
- **Dati Finanziari & Prezzi:** `JetBrains Mono, "Fira Code", monospace` con classe `.num-mono` (`font-feature-settings: "tnum" 1, "zero" 1`).

### 3.2 Scala Tipografica
| Livello | Dimensione | Peso | Line-Height | Uso |
| :--- | :--- | :--- | :--- | :--- |
| **Display / H1** | `1.5rem (24px)` | `800 (ExtraBold)` | `1.2` | Titoli delle viste principali (`Panoramica`, `Mercati`). |
| **Section / H2** | `1.125rem (18px)` | `700 (Bold)` | `1.3` | Sezioni principali (`Watchlist Personale`, `Stato Borse`). |
| **Subhead / H3** | `0.875rem (14px)` | `600 (SemiBold)` | `1.4` | Titoli card, intestazioni tabelle, modali. |
| **Body** | `0.8125rem (13px)` | `400 (Regular)` | `1.5` | Testo esplicativo, descrizioni, note operative. |
| **Caption** | `0.6875rem (11px)` | `500 (Medium)` | `1.4` | Microcopy, timestamp UTC, disclaimer, fonti. |

---

## 4. Sistema Spazi e Layout (8pt Grid)

Tutte le dimensioni, margini e padding seguono la griglia modulare a base **8px** (con multipli a 4px per micro-spaziature):
- `p-1 / gap-1`: 4px (micro distanze interne bottoni e tag)
- `p-2 / gap-2`: 8px (spaziatura tra icone e testi)
- `p-3 / gap-3`: 12px (spaziatura interna card compatte)
- `p-4 / gap-4`: 16px (padding standard mobile per card e form)
- `p-5 / p-6`: 20px / 24px (padding standard desktop e container)
- `gap-6 / gap-8`: 24px / 32px (spaziatura tra moduli e sezioni hero)

---

## 5. Raggi di Curvatura (Border Radius)

Per evitare l'aspetto standardizzato "AI template", i raggi di curvatura sono rigorosamente graduati:
- `rounded-md` (`6px`): Badge compatti, tag di categoria e celle interattive.
- `rounded-xl` (`12px`): Bottoni, campi input, dropdown e card secondarie.
- `rounded-2xl` (`16px`): Card di sezione principali, contenitori hero e modali.
- `rounded-full`: Avatar utente, dot di stato e pill di navigazione.

---

## 6. Elevazioni e Ombreggiature (Shadows)

In modalità scura le ombreggiature standard risultano invisibili. Il design system V5 utilizza combinazioni di bordi opachi e sottili bagliori controllati:
- **Default Card (Dark):** `border border-navy-800/80 bg-navy-900/90 shadow-sm`
- **Elevated / Drawer (Dark):** `border-l border-navy-800 bg-navy-950 shadow-2xl`
- **Hero Glow:** `ring-1 ring-brand-500/20 shadow-[0_0_15px_rgba(20,184,166,0.1)]`
- **Default Card (Light):** `border border-slate-200/90 bg-white shadow-sm`

---

## 7. Componenti Core

### 7.1 Bottoni (Buttons)
- **Primary:** Sfondo `brand-500`, testo scuro ad alto contrasto o bianco, `font-bold`, altezza minima 44px su mobile, focus-ring di sicurezza.
- **Secondary:** Bordo `slate-300` (Light) o `navy-700` (Dark), sfondo neutro, hover graduale.
- **Ghost:** Nessun bordo né sfondo iniziale, evidenziazione al passaggio del mouse.

### 7.2 Badge Semantici di Rischio e Segnale
- **Nuovo / Forte:** Sfondo `emerald-500/15`, testo `emerald-600` / `emerald-400`, bordo `emerald-500/30`.
- **Rischio Elevato:** Sfondo `rose-500/15`, testo `rose-600` / `rose-400`, bordo `rose-500/30`.
- **Attenzione / Neutro:** Sfondo `amber-500/15`, testo `amber-700` / `amber-300`, bordo `amber-500/30`.

### 7.3 Drawer DemInvest AI
- Pannello scorrevole laterale su desktop (`max-w-2xl`) e full-screen su mobile.
- Header con strumento corrente e orizzonte temporale.
- Struttura a 4 livelli: Sintesi, Rationale, Rischi/Invalidazione e Dati Tecnici Verificati in fisarmonica (`<details>`).
