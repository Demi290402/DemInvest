# NOTIFICATIONS.md — Motore Notifiche, Web Push (VAPID) e Scheduler

## 1. Architettura Web Push (RFC 8292 VAPID)

DemInvest implementa notifiche push reali server-side tramite la libreria `web-push` e il Service Worker `public/sw.js`:
1. **Chiavi VAPID**: All'avvio del backend, se `VAPID_PUBLIC_KEY` e `VAPID_PRIVATE_KEY` non sono presenti in `.env`, il sistema genera automaticamente una coppia di chiavi crittografiche ECDSA P-256 valida e la persiste in `server/.data/vapid-keys.json`.
2. **Permesso Volontario Utente**: La richiesta di `Notification.requestPermission()` e `pushManager.subscribe()` avviene esclusivamente quando l'utente clicca volontariamente sul pulsante **"Attiva Permesso Web Push"** nella vista Notifiche.
3. **Notifica di Test Reale**: Il pulsante **"Invia Notifica Push di Test Reale"** invoca `POST /api/push/test`, recupera l'ultima quotazione verificata di `BTC/USD`, cifra il payload VAPID e lo invia a tutte le sottoscrizioni attive registrando l'evento nel registro consegne.
4. **Pulizia Sottoscrizioni Scadute**: Se l'endpoint push restituisce HTTP `404` o `410 Gone`, la sottoscrizione viene automaticamente rimossa.

---

## 2. Personalizzazione, Quiet Hours e Cooldown

- **Quiet Hours**: Fascia oraria configurabile (predefinita `22:30–07:30`) durante la quale gli avvisi non critici vengono registrati nel centro notifiche con stato `SUPPRESSED_QUIET_HOURS` senza disturbare l'utente con push sonore.
- **Cooldown**: Ogni regola di alert (`PRICE_ABOVE`, `PRICE_BELOW`, `PCT_CHANGE_24H`, `RSI_OVERSOLD`, `RSI_OVERBOUGHT`, `VOLATILITY_SPIKE`) applica un intervallo minimo (`cooldownMinutes`) prima di poter scattare nuovamente.

---

## 3. Installazione e Web Push su iOS / iPadOS
Su iOS/iPadOS (versione 16.4+), le notifiche Web Push richiedono che la PWA sia stata aggiunta alla Schermata Home da Safari (**Condividi -> Aggiungi alla schermata Home**) e aperta in modalità standalone.
