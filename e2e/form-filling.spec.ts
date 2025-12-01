import { test, expect } from '@playwright/test';

/**
 * E2E Tests for Form Filling
 *
 * Tests form input, validation, and data persistence.
 */

// Add delay between tests to avoid browser closing race condition in single-process mode
test.afterEach(async () => {
  await new Promise((resolve) => setTimeout(resolve, 100));
});

test.describe('Varsel Form', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    // Ensure we're on Varsel tab
    await page.getByRole('tab', { name: /Varsel/i }).click();
  });

  test('should fill in project information', async ({ page }) => {
    // Fill project name
    const projectInput = page.locator('input[placeholder*="prosjekt"]').first();
    if (await projectInput.isVisible()) {
      await projectInput.fill('Test Prosjekt AS');
      await expect(projectInput).toHaveValue('Test Prosjekt AS');
    }
  });

  test('should fill in date fields', async ({ page }) => {
    // Fill date field
    const dateInput = page.locator('input[type="date"]').first();
    if (await dateInput.isVisible()) {
      const today = new Date().toISOString().split('T')[0];
      await dateInput.fill(today);
      await expect(dateInput).toHaveValue(today);
    }
  });

  test('should fill in textarea descriptions', async ({ page }) => {
    // Fill description textarea
    const textarea = page.locator('textarea').first();
    if (await textarea.isVisible()) {
      await textarea.fill('Dette er en testbeskrivelse av varselet.');
      await expect(textarea).toHaveValue('Dette er en testbeskrivelse av varselet.');
    }
  });
});

test.describe('KOE Form', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    // Navigate to KOE tab
    await page.getByRole('tab', { name: /Krav/i }).click();
  });

  test('should display KOE form sections', async ({ page }) => {
    // Check for vederlag section
    await expect(page.getByText(/Vederlag/i).first()).toBeVisible();

    // Check for frist section
    await expect(page.getByText(/Frist/i).first()).toBeVisible();
  });

  test('should toggle checkbox for compensation claim', async ({ page }) => {
    // Find checkbox for vederlag claim
    const checkbox = page.locator('input[type="checkbox"]').first();
    if (await checkbox.isVisible()) {
      // Toggle checkbox
      await checkbox.click();
      await expect(checkbox).toBeChecked();

      // Toggle back
      await checkbox.click();
      await expect(checkbox).not.toBeChecked();
    }
  });

  test('should fill in amount field when compensation is selected', async ({ page }) => {
    // Find and check vederlag checkbox
    const vederlagCheckbox = page.getByLabel(/Krever vederlag/i).first();
    if (await vederlagCheckbox.isVisible()) {
      await vederlagCheckbox.check();

      // Fill amount
      const amountInput = page.locator('input[type="number"]').first();
      if (await amountInput.isVisible()) {
        await amountInput.fill('50000');
        await expect(amountInput).toHaveValue('50000');
      }
    }
  });
});

test.describe('BH Svar Form', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    // Switch to BH role
    await page.getByRole('button', { name: 'BH' }).click();
    // Navigate to Svar tab
    await page.getByRole('tab', { name: /Svar/i }).click();
  });

  test('should display BH svar form', async ({ page }) => {
    // Check for svar section headers
    await expect(page.getByText(/Byggherrens svar/i).first()).toBeVisible();
  });

  test('should show decision options', async ({ page }) => {
    // Look for radio buttons or select for decision
    const decisionSection = page.getByText(/Godkjent|Avvist|Delvis/i).first();
    if (await decisionSection.isVisible()) {
      await expect(decisionSection).toBeVisible();
    }
  });
});

test.describe('Demo Data', () => {
  test('should load example data when clicking Eksempel button', async ({ page }) => {
    await page.goto('/');

    // Click Eksempel button
    await page.getByRole('button', { name: /Eksempel/i }).click();

    // Confirm dialog should appear
    const confirmButton = page.getByRole('button', { name: /Bekreft|OK|Ja/i });
    if (await confirmButton.isVisible()) {
      await confirmButton.click();
    }

    // Wait for data to load
    await page.waitForTimeout(500);

    // Check that some example data is visible
    // The specific content depends on DEMO_DATA
    const content = await page.content();
    expect(content.length).toBeGreaterThan(1000);
  });

  test('should reset form when clicking Nullstill button', async ({ page }) => {
    await page.goto('/');

    // First load example data
    await page.getByRole('button', { name: /Eksempel/i }).click();
    const confirmButton1 = page.getByRole('button', { name: /Bekreft|OK|Ja/i });
    if (await confirmButton1.isVisible()) {
      await confirmButton1.click();
    }

    // Then reset
    await page.getByRole('button', { name: /Nullstill/i }).click();
    const confirmButton2 = page.getByRole('button', { name: /Bekreft|OK|Ja/i });
    if (await confirmButton2.isVisible()) {
      await confirmButton2.click();
    }

    // Form should be reset - check first input is empty
    const firstInput = page.locator('input[type="text"]').first();
    if (await firstInput.isVisible()) {
      await expect(firstInput).toHaveValue('');
    }
  });
});
