import { expect, test } from '@playwright/test';

test.describe('DemInvest — Flusso End-to-End Completo (Release 1 MVP Reale)', () => {
  test('Registrazione proprietario (SINGLE_USER_MODE), Onboarding, Dashboard, Mercati, Screener, Portafoglio, Paper Trading, Notifiche e AI', async ({
    page,
  }) => {
    await page.goto('/');

    // 1. Se siamo sulla schermata di autenticazione iniziale, registriamo/accediamo
    const authBtn = page.getByTestId('auth-submit-button');
    if (await authBtn.isVisible()) {
      await authBtn.click();
    }

    // 2. Se appare l'onboarding, completiamolo
    const onboardingBtn = page.getByTestId('complete-onboarding-button');
    if (await onboardingBtn.isVisible()) {
      await onboardingBtn.click();
    }

    // 3. Verifica che la Dashboard sia caricata con lo stato delle borse e la watchlist
    await expect(page.getByText(/Stato Principali Borse/i)).toBeVisible();
    await expect(page.getByText(/Watchlist Personale/i)).toBeVisible();

    // 4. Passaggio tra Modalità Semplice e Modalità Pro
    const uiModeBtn = page.getByTestId('toggle-ui-mode-btn');
    await expect(uiModeBtn).toBeVisible();
    const initialModeText = (await uiModeBtn.textContent()) ?? '';
    if (initialModeText.includes('Semplice')) {
      await uiModeBtn.click();
      await expect(uiModeBtn).toContainText('PRO');
    } else {
      await uiModeBtn.click();
      await expect(uiModeBtn).toContainText('Semplice');
      await uiModeBtn.click();
      await expect(uiModeBtn).toContainText('PRO');
    }

    // 5. Navigazione a Mercati e verifica grafico TradingView Lightweight Charts e Broker Mapping
    await page.getByTestId('nav-markets').click();
    await expect(page.getByText(/Scheda Broker & Nomenclatura/i)).toBeVisible();

    // 6. Navigazione a Opportunità & Market Screener
    await page.getByTestId('nav-opportunities').click();
    await expect(page.getByText(/Market Screener & Opportunity Discovery/i)).toBeVisible();

    // 7. Navigazione a Trading Lab (Paper Trading & Backtesting)
    await page.getByTestId('nav-lab').click();
    await expect(page.getByRole('heading', { name: /Trading Lab — Simulazione/i })).toBeVisible();
    await page.getByTestId('lab-tab-backtest').click();
    await expect(page.getByTestId('run-backtest-btn')).toBeVisible();

    // 8. Navigazione a Portafoglio Manuale
    await page.getByTestId('nav-portfolio').click();
    await expect(page.getByText(/Portfolio Tracker Manuale/i)).toBeVisible();

    // 9. Navigazione a Notifiche e test invio notifica backend
    await page.getByTestId('nav-notifications').click();
    await page.getByTestId('send-test-push-btn').click();
    await expect(page.getByText(/Test Reale Notifica Web Push/i).first()).toBeVisible();

    // 10. Navigazione a Impostazioni e verifica Diagnostica & Riconciliazione Supabase Cloud
    await page.getByTestId('nav-settings').click();
    await expect(page.getByTestId('supabase-diagnostics-panel')).toBeVisible();
    await expect(page.getByTestId('reconcile-supabase-btn')).toBeVisible();
    await page.getByTestId('reconcile-supabase-btn').click();

    // 11. Apertura Assistente DemInvest AI e verifica tool-calling e guardrail
    await page.getByTestId('header-ai-btn').click();
    await expect(page.getByText(/DemInvest AI — Analista Contestuale/i)).toBeVisible();
    await page.getByTestId('ai-chat-input').fill('Analizza BTC/USD e il rischio');
    await page.getByTestId('ai-chat-send').click();
    await expect(page.getByText(/1. Dati Verificati/i).first()).toBeVisible();
  });
});

