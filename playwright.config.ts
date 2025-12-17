import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright E2E Test Configuration
 *
 * For å kjøre E2E-tester lokalt:
 * 1. Installer browsers: npx playwright install
 * 2. Start backend: cd backend && python app.py
 * 3. Start frontend: npm run dev
 * 4. Kjør tester: npm run test:e2e
 *
 * @see https://playwright.dev/docs/test-configuration
 */
export default defineConfig({
  // Test directory
  testDir: './e2e',

  // Run tests in parallel
  fullyParallel: true,

  // Fail the build on CI if you accidentally left test.only in the source code
  forbidOnly: !!process.env.CI,

  // Retry failed tests to handle flaky browser closing in single-process mode
  retries: 2,

  // Opt out of parallel tests on CI
  workers: 1,

  // Reporter to use
  reporter: [
    ['html', { outputFolder: 'playwright-report' }],
    ['list'],
  ],

  // Timeout for each test
  timeout: 60000,

  // Shared settings for all projects
  use: {
    // Base URL to use in actions like `await page.goto('/')`
    // Must match the webServer port (3001) to use real API, not mock data
    baseURL: 'http://localhost:3001',

    // Collect trace when retrying the failed test
    trace: 'on-first-retry',

    // Screenshot on failure
    screenshot: 'only-on-failure',

    // Video on failure
    video: 'on-first-retry',

    // Navigation timeout
    navigationTimeout: 30000,
  },

  // Configure projects for major browsers
  // Note: --single-process is required in resource-constrained container environments
  // but causes browser to close after each test, resulting in ~50% test failures.
  // This is a known limitation. For reliable E2E testing, run on a proper CI server.
  projects: [
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        headless: true,
        launchOptions: {
          slowMo: 50, // Add delay between browser operations
          args: [
            '--disable-dev-shm-usage',
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-gpu',
            '--disable-extensions',
          ],
        },
      },
    },
  ],

  // Run local dev server before starting the tests (optional)
  // Note: VITE_USE_MOCK_API=false ensures frontend uses real backend API
  // Uses port 3001 to avoid conflicts with existing dev server on 3000
  webServer: {
    command: 'VITE_USE_MOCK_API=false npm run dev -- --port 3001',
    url: 'http://localhost:3001',
    reuseExistingServer: false,
    env: {
      VITE_USE_MOCK_API: 'false',
    },
  },
});
