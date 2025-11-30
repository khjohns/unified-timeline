import { test, expect } from '@playwright/test';

/**
 * E2E Tests for Navigation and Basic UI
 *
 * Tests the core navigation and UI elements of the application.
 */

test.describe('Navigation', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to the app
    await page.goto('/');
  });

  test('should display the header with service name', async ({ page }) => {
    // Check that the header is visible
    const header = page.locator('header');
    await expect(header).toBeVisible();

    // Check service name is displayed
    await expect(page.getByText('Skjema for krav om endringsordre (KOE)')).toBeVisible();
  });

  test('should display role toggle buttons', async ({ page }) => {
    // Check role toggle buttons
    const teButton = page.getByRole('button', { name: 'TE' });
    const bhButton = page.getByRole('button', { name: 'BH' });

    await expect(teButton).toBeVisible();
    await expect(bhButton).toBeVisible();
  });

  test('should have four tabs', async ({ page }) => {
    // Check all four tabs are present
    await expect(page.getByRole('tab', { name: /Varsel/i })).toBeVisible();
    await expect(page.getByRole('tab', { name: /Krav/i })).toBeVisible();
    await expect(page.getByRole('tab', { name: /Svar/i })).toBeVisible();
    await expect(page.getByRole('tab', { name: /Oversikt/i })).toBeVisible();
  });

  test('should switch tabs when clicked', async ({ page }) => {
    // Click on Krav tab
    await page.getByRole('tab', { name: /Krav/i }).click();

    // Verify Krav panel content is visible
    await expect(page.getByText(/Krav om endringsordre/i)).toBeVisible();

    // Click on Svar tab
    await page.getByRole('tab', { name: /Svar/i }).click();

    // Verify Svar panel content is visible
    await expect(page.getByText(/Byggherrens svar/i)).toBeVisible();
  });

  test('should show bottom bar with buttons', async ({ page }) => {
    // Check bottom bar buttons
    await expect(page.getByRole('button', { name: /Nullstill/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /Last ned PDF/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /Eksempel/i })).toBeVisible();
  });
});

test.describe('Role Switching', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('should start with TE role selected', async ({ page }) => {
    const teButton = page.getByRole('button', { name: 'TE' });

    // TE button should have the "active" styling (bg-pri)
    await expect(teButton).toHaveClass(/bg-pri/);
  });

  test('should switch to BH role when clicked', async ({ page }) => {
    const bhButton = page.getByRole('button', { name: 'BH' });

    // Click BH button
    await bhButton.click();

    // BH button should now be active
    await expect(bhButton).toHaveClass(/bg-pri/);

    // Header should show "Byggherren"
    await expect(page.getByText('Byggherren')).toBeVisible();
  });

  test('should disable TE fields when BH role is selected', async ({ page }) => {
    // Switch to BH role
    await page.getByRole('button', { name: 'BH' }).click();

    // Go to Varsel tab
    await page.getByRole('tab', { name: /Varsel/i }).click();

    // TE fields should be disabled (check for disabled state in form fields)
    // This depends on actual implementation - adjust selector as needed
    const dateField = page.locator('input[type="date"]').first();
    if (await dateField.isVisible()) {
      await expect(dateField).toBeDisabled();
    }
  });
});
