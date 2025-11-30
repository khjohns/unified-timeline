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

  // Retry on CI only
  retries: process.env.CI ? 2 : 0,

  // Opt out of parallel tests on CI
  workers: process.env.CI ? 1 : undefined,

  // Reporter to use
  reporter: [
    ['html', { outputFolder: 'playwright-report' }],
    ['list'],
  ],

  // Shared settings for all projects
  use: {
    // Base URL to use in actions like `await page.goto('/')`
    baseURL: 'http://localhost:3000/Skjema_Endringsmeldinger',

    // Collect trace when retrying the failed test
    trace: 'on-first-retry',

    // Screenshot on failure
    screenshot: 'only-on-failure',

    // Video on failure
    video: 'on-first-retry',
  },

  // Configure projects for major browsers
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },

    // Uncomment for Firefox testing
    // {
    //   name: 'firefox',
    //   use: { ...devices['Desktop Firefox'] },
    // },

    // Uncomment for Safari testing
    // {
    //   name: 'webkit',
    //   use: { ...devices['Desktop Safari'] },
    // },

    // Mobile viewports
    // {
    //   name: 'Mobile Chrome',
    //   use: { ...devices['Pixel 5'] },
    // },
  ],

  // Run local dev server before starting the tests (optional)
  // webServer: {
  //   command: 'npm run dev',
  //   url: 'http://localhost:3000/Skjema_Endringsmeldinger',
  //   reuseExistingServer: !process.env.CI,
  // },
});
