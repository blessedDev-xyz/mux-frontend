import { test, expect, Page, BrowserContext } from '@playwright/test';
import { WalletConnectSDK } from '@muxprotocol/wallet-connect-sdk';

test.describe('WalletConnect Smoke Tests', () => {
  let page: Page;
  let walletSDK: WalletConnectSDK;

  test.beforeEach(async ({ browser }) => {
    const context = await browser.newContext();
    page = await context.newPage();
    walletSDK = new WalletConnectSDK({
      projectId: process.env.WALLETCONNECT_PROJECT_ID!,
      relayUrl: process.env.WALLETCONNECT_RELAY_URL || 'wss://relay.walletconnect.com',
    });
    await walletSDK.init();
  });

  test.afterEach(async () => {
    await walletSDK.disconnect();
    await page.close();
  });

  test('WalletConnect session initializes without crash', async () => {
    const status = await walletSDK.getStatus();
    expect(status.isConnected).toBe(false);
    expect(status.error).toBeNull();
  });

  test('WalletConnect connection completes within timeout', async () => {
    const connectPromise = walletSDK.connect({
      requiredNamespaces: {
        eip155: {
          methods: ['eth_sendTransaction', 'eth_signTransaction'],
          chains: ['eip155:1'],
          events: ['chainChanged', 'accountsChanged'],
        },
      },
    });

    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => reject(new Error('Connection timed out')), 30000);
    });

    await Promise.race([connectPromise, timeoutPromise]);
    expect(await walletSDK.getStatus().isConnected).toBe(true);
  });

  test('WalletConnect reconnection after crash is graceful', async () => {
    await walletSDK.connect();
    await walletSDK.disconnect();

    const reconnectPromise = walletSDK.reconnect();
    await expect(reconnectPromise).resolves.toBeUndefined();
    expect((await walletSDK.getStatus()).isConnected).toBe(false);
  });

  test('Multiple wallet creation methods all succeed', async () => {
    const methods = ['email', 'social', 'passkey', 'connect'];
    const results = await Promise.allSettled(
      methods.map((method) => walletSDK.createWallet({ method }))
    );

    results.forEach((result, index) => {
      if (result.status === 'rejected') {
        test.fail(false, `Method ${methods[index]} failed: ${result.reason}`);
      }
    });

    const successCount = results.filter((r) => r.status === 'fulfilled').length;
    expect(successCount).toBe(methods.length);
  });

  test('Wallet table a11y focus order is correct', async () => {
    await page.goto('/wallets');

    const rows = await page.$$('[role="row"]');
    expect(rows.length).toBeGreaterThan(0);

    await rows[0]?.focus();
    await page.keyboard.press('ArrowDown');
    await page.waitForTimeout(100);
    await expect(rows[1]).toBeFocused();

    await page.keyboard.press('ArrowUp');
    await page.waitForTimeout(100);
    await expect(rows[0]).toBeFocused();

    await page.keyboard.press('Enter');
    await expect(rows[0]).toHaveAttribute('aria-selected', 'true');
  });

  test('Analytics chart renders without errors', async () => {
    await page.goto('/analytics/wallets');
    await expect(page.locator('[data-testid="wallet-analytics"]')).toBeVisible({
      timeout: 5000,
    });
    await expect(page.locator('[data-testid="analytics-metrics"]')).toBeVisible();
  });

  test('Security headers are present on all wallet pages', async () => {
    await page.goto('/wallets');

    const headers = await page.request().response()?.headers();
    expect(headers?.['x-content-type-options']).toBe('nosniff');
    expect(headers?.['x-frame-options']).toBe('DENY');
    expect(headers?.['strict-transport-security']).toBeTruthy();
  });
});

test.describe('Wallet Creation Analytics Smoke Tests', () => {
  test('Analytics data loads correctly', async ({ page }) => {
    await page.goto('/analytics/wallets');
    await expect(page.locator('[data-testid="analytics-metrics"]')).toBeVisible({
      timeout: 5000,
    });
  });

  test('Chart updates on time range change', async ({ page }) => {
    await page.goto('/analytics/wallets');
    await page.click('[data-testid="time-range-7d"]');
    await expect(page.locator('[data-testid="chart-updated"]')).toBeVisible({
      timeout: 3000,
    });
  });
});

test.describe('Playwright Required PR Validation', () => {
  test('All smoke tests pass before merge', async ({ page }) => {
    const results = await test.run();
    const failures = results.filter((r) => r.status !== 'passed');
    expect(failures).toEqual([]);
  });
});
