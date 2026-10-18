const { chromium } = require('@playwright/test');
const fs = require('fs');
const path = require('path');

async function run() {
  const outDir = path.resolve(__dirname, '../screenshots/after');
  if (!fs.existsSync(outDir)) {
    fs.mkdirSync(outDir, { recursive: true });
  }

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

    console.log(`[After] Capturing ${vp.name}...`);
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

    // 1. Dashboard (Dark)
    await page.screenshot({ path: path.join(outDir, `${vp.name}-dashboard-dark.png`), fullPage: false });

    // Toggle to Light mode to capture Light mode Dashboard
    const themeBtn = page.getByTestId('toggle-theme-btn');
    if (await themeBtn.isVisible()) {
      await themeBtn.click();
      await page.waitForTimeout(500);
      await page.screenshot({ path: path.join(outDir, `${vp.name}-dashboard-light.png`), fullPage: false });
      // Toggle back to dark
      await themeBtn.click();
      await page.waitForTimeout(500);
    }

    // 2. Markets
    const navMarkets = vp.isMobile ? page.getByTestId('mobile-nav-markets') : page.getByTestId('nav-markets');
    if (await navMarkets.isVisible()) {
      await navMarkets.click();
      await page.waitForTimeout(800);
      await page.screenshot({ path: path.join(outDir, `${vp.name}-markets.png`), fullPage: false });
    }

    // 3. Opportunities
    const navOpp = vp.isMobile ? page.getByTestId('mobile-nav-opportunities') : page.getByTestId('nav-opportunities');
    if (await navOpp.isVisible()) {
      await navOpp.click();
      await page.waitForTimeout(800);
      await page.screenshot({ path: path.join(outDir, `${vp.name}-opportunities.png`), fullPage: false });
    }

    // 4. Portfolio
    const navPort = vp.isMobile ? page.getByTestId('mobile-nav-portfolio') : page.getByTestId('nav-portfolio');
    if (await navPort.isVisible()) {
      await navPort.click();
      await page.waitForTimeout(800);
      await page.screenshot({ path: path.join(outDir, `${vp.name}-portfolio.png`), fullPage: false });
    }

    // 5. More / Lab
    if (vp.isMobile) {
      const navMore = page.getByTestId('mobile-nav-more');
      if (await navMore.isVisible()) {
        await navMore.click();
        await page.waitForTimeout(800);
        await page.screenshot({ path: path.join(outDir, `${vp.name}-more-hub.png`), fullPage: false });
      }
    }

    // 6. AI Assistant Drawer
    const aiBtn = page.getByTestId('header-ai-btn');
    if (await aiBtn.isVisible()) {
      await aiBtn.click();
      await page.waitForTimeout(600);
      await page.screenshot({ path: path.join(outDir, `${vp.name}-ai-drawer.png`), fullPage: false });
      const closeBtn = page.getByRole('button', { name: /chiudi/i });
      if (await closeBtn.isVisible()) {
        await closeBtn.click();
      } else {
        await page.keyboard.press('Escape');
      }
      await page.waitForTimeout(400);
    }

    await context.close();
  }

  await browser.close();
  console.log('[After] All after redesign screenshots captured successfully!');
}

run().catch((err) => {
  console.error('[After] Capture failed:', err);
  process.exit(1);
});
