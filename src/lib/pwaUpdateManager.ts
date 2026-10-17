/**
 * DemInvest — PWA Continuous Background Update Manager
 * 
 * Monitora costantemente la presenza di nuovi deploy e rilasci dell'app,
 * senza costringere l'utente a ricaricare o aggiornare manualmente la pagina.
 * 
 * Strategia:
 * 1. Controllo periodico silenzioso del Service Worker (ogni 30 secondi).
 * 2. Controllo immediato quando l'utente torna sull'app (visibility change / window focus).
 * 3. Controllo al ripristino della connettività (online event).
 * 4. Applicazione automatica non-bloccante del nuovo worker tramite SKIP_WAITING.
 * 5. Aggiornamento automatico e trasparente dell'interfaccia via controllerchange.
 */

type UpdateListener = (status: 'idle' | 'checking' | 'available' | 'installing' | 'updated') => void;

class PwaUpdateManager {
  private registration: ServiceWorkerRegistration | null = null;
  private listeners: Set<UpdateListener> = new Set();
  private isRefreshing = false;
  private checkIntervalId: number | null = null;
  private currentStatus: 'idle' | 'checking' | 'available' | 'installing' | 'updated' = 'idle';

  constructor() {
    if (typeof window === 'undefined' || !('serviceWorker' in navigator)) {
      return;
    }

    this.init();
  }

  private notify(status: 'idle' | 'checking' | 'available' | 'installing' | 'updated') {
    this.currentStatus = status;
    this.listeners.forEach((listener) => {
      try {
        listener(status);
      } catch (err) {
        console.error('[PwaUpdateManager] Errore listener:', err);
      }
    });
  }

  public subscribe(listener: UpdateListener): () => void {
    this.listeners.add(listener);
    listener(this.currentStatus);
    return () => this.listeners.delete(listener);
  }

  private init() {
    window.addEventListener('load', async () => {
      try {
        this.registration = await navigator.serviceWorker.register('/sw.js', { scope: '/' });
        console.info('[DemInvest PWA] Service Worker attivo. Sistema di auto-update continuo avviato.');

        // Se c'è già un worker in attesa, applicalo subito
        if (this.registration.waiting) {
          this.applyUpdate(this.registration.waiting);
        }

        // Ascolta nuovi aggiornamenti rilevati
        this.registration.addEventListener('updatefound', () => {
          const newWorker = this.registration?.installing;
          if (!newWorker) return;

          this.notify('installing');

          newWorker.addEventListener('statechange', () => {
            if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
              // Nuovo aggiornamento completato e pronto
              this.notify('available');
              this.applyUpdate(newWorker);
            }
          });
        });

        // Avvia polling continuo ogni 30 secondi
        this.startContinuousPolling();

        // Controlla ad ogni cambio visibilità (es. quando l'utente riapre la scheda o la PWA)
        document.addEventListener('visibilitychange', () => {
          if (document.visibilityState === 'visible') {
            this.checkForUpdates();
          }
        });

        // Controlla al focus della finestra
        window.addEventListener('focus', () => {
          this.checkForUpdates();
        });

        // Controlla al ritorno online
        window.addEventListener('online', () => {
          this.checkForUpdates();
        });

      } catch (error) {
        console.warn('[DemInvest PWA] Registrazione Service Worker gestita silenziosamente:', error);
      }
    });

    // Solo se c'era già un controller attivo al caricamento della pagina (ovvero si tratta di un vero aggiornamento, non della prima installazione iniziale)
    const hadExistingController = Boolean(navigator.serviceWorker.controller);

    // Quando un nuovo service worker prende il controllo, ricarica automaticamente per applicare il nuovo codice
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (!hadExistingController || this.isRefreshing) return;
      this.isRefreshing = true;
      this.notify('updated');
      console.info('[DemInvest PWA] Nuova versione applicata con successo. Aggiornamento automatico della vista...');
      setTimeout(() => {
        window.location.reload();
      }, 600);
    });
  }

  /**
   * Forza il controllo manuale o schedulato di aggiornamenti sul server
   */
  public async checkForUpdates(): Promise<void> {
    if (!this.registration) return;

    try {
      this.notify('checking');
      await this.registration.update();
      this.notify('idle');
    } catch {
      // In assenza temporanea di rete o rate limit, fallisce silenziosamente
      this.notify('idle');
    }
  }

  /**
   * Invia messaggio al worker per prendere subito il controllo
   */
  private applyUpdate(worker: ServiceWorker) {
    try {
      worker.postMessage({ type: 'SKIP_WAITING' });
    } catch (err) {
      console.warn('[DemInvest PWA] Impossibile inviare SKIP_WAITING:', err);
    }
  }

  private startContinuousPolling() {
    if (this.checkIntervalId !== null) return;

    // Polling continuo ogni 30 secondi
    this.checkIntervalId = window.setInterval(() => {
      this.checkForUpdates();
    }, 30000);
  }
}

export const pwaUpdateManager = new PwaUpdateManager();
