/**
 * E2E Smoke Tests
 *
 * Quick tests to verify basic functionality works.
 * Run these first to catch obvious issues.
 */

import { test, expect } from '@playwright/test';

const API_BASE_URL = process.env.API_BASE_URL || 'http://localhost:8080';

test.describe('Smoke Tests', () => {
  test('backend health check', async ({ request }) => {
    const response = await request.get(`${API_BASE_URL}/api/health`);
    expect(response.ok()).toBeTruthy();

    const data = await response.json();
    expect(data.status).toBe('healthy');
  });

  test('frontend loads', async ({ page }) => {
    await page.goto('/');
    // Should load without error
    await expect(page.locator('body')).toBeVisible();
  });

  test('CSRF token endpoint works', async ({ request }) => {
    const response = await request.get(`${API_BASE_URL}/api/csrf-token`);
    expect(response.ok()).toBeTruthy();

    const data = await response.json();
    expect(data.csrfToken).toBeDefined();
    expect(typeof data.csrfToken).toBe('string');
  });

  test('demo page loads', async ({ page }) => {
    await page.goto('/demo');
    // Should show example cases heading
    await expect(page.getByRole('heading', { name: /eksempel/i })).toBeVisible({ timeout: 10000 });
  });
});
