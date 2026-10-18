const { chromium } = require('@playwright/test');
const fs = require('fs');
const path = require('path');

async function run() {
  const browser = await chromium.launch({ channel: 'msedge', headless: true });

  const viewports = [
    { name: 'desktop', width: 1440, height: 900, isMobile: false },
    { name: 'mobile', width: 390, height: 844, isMobile: true, hasTouch: true },
  ];

  for (const vp of viewports) {
    const context = await browser.newContext({
      viewport: { width: vp.width, height: vp.height },
      isMobile: vp.isMobile,
      hasTouch: vp.hasTouch,
    });
    const page = await context.newPage();

    console.log(`[Baseline] Capturing ${vp.name}...`);
    await page.goto('http://localhost:5173', { waitUntil: 'networkidle' });

    // Handle initial auth/onboarding if visible
    const authBtn = page.getByTestId('auth-submit-button');
    if (await authBtn.isVisible()) {
      await authBtn.click();
      await page.waitForTimeout(500);
    }
    const onboardingBtn = page.getByTestId('complete-onboarding-button');
    if (await onboardingBtn.isVisible()) {
      await onboardingBtn.click();
      await page.waitForTimeout(500);
    }

    // Wait for main content
    await page.waitForSelector('#main-content', { timeout: 10000 });

    // Dashboard
    await page.screenshot({ path: `screenshots/baseline/${vp.name}-dashboard.png`, fullPage: false });

    // Markets
    const navMarkets = vp.isMobile ? page.getByTestId('mobile-nav-markets') : page.getByTestId('nav-markets');
    if (await navMarkets.isVisible()) {
      await navMarkets.click();
      await page.waitForTimeout(800);
      await page.screenshot({ path: `screenshots/baseline/${vp.name}-markets.png`, fullPage: false });
    }

    // Opportunities
    const navOpp = vp.isMobile ? page.getByTestId('mobile-nav-opportunities') : page.getByTestId('nav-opportunities');
    if (await navOpp.isVisible()) {
      await navOpp.click();
      await page.waitForTimeout(800);
      await page.screenshot({ path: `screenshots/baseline/${vp.name}-opportunities.png`, fullPage: false });
    }

    // Portfolio
    const navPort = vp.isMobile ? page.getByTestId('mobile-nav-portfolio') : page.getByTestId('nav-portfolio');
    if (await navPort.isVisible()) {
      await navPort.click();
      await page.waitForTimeout(800);
      await page.screenshot({ path: `screenshots/baseline/${vp.name}-portfolio.png`, fullPage: false });
    }

    await context.close();
  }

  await browser.close();
  console.log('[Baseline] All baseline screenshots captured successfully!');
}

run().catch((err) => {
  console.error('[Baseline] Capture failed:', err);
  process.exit(1);
});
