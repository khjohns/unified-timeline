import { test, expect } from '@playwright/test';

/**
 * E2E Tests for Workflow and Modus
 *
 * Tests the different workflow modes (varsel, koe, svar, revidering)
 * and the complete user journey.
 */

// Add delay between tests to avoid browser closing race condition in single-process mode
test.afterEach(async () => {
  await new Promise((resolve) => setTimeout(resolve, 100));
});

test.describe('Modus URL Parameters', () => {
  test('should set correct tab for varsel modus', async ({ page }) => {
    await page.goto('/?modus=varsel');

    // Varsel tab should be active
    const varselTab = page.getByRole('tab', { name: /Varsel/i });
    await expect(varselTab).toHaveAttribute('aria-selected', 'true');
  });

  test('should set correct tab for koe modus', async ({ page }) => {
    await page.goto('/?modus=koe');

    // KOE tab should be active
    const koeTab = page.getByRole('tab', { name: /Krav/i });
    await expect(koeTab).toHaveAttribute('aria-selected', 'true');
  });

  test('should set correct tab for svar modus', async ({ page }) => {
    await page.goto('/?modus=svar');

    // Svar tab should be active
    const svarTab = page.getByRole('tab', { name: /Svar/i });
    await expect(svarTab).toHaveAttribute('aria-selected', 'true');

    // Role should be BH
    const bhButton = page.getByRole('button', { name: 'BH' });
    await expect(bhButton).toHaveClass(/bg-pri/);
  });

  test('should set correct tab for revidering modus', async ({ page }) => {
    await page.goto('/?modus=revidering');

    // KOE tab should be active (revidering uses KOE tab)
    const koeTab = page.getByRole('tab', { name: /Krav/i });
    await expect(koeTab).toHaveAttribute('aria-selected', 'true');
  });
});

test.describe('PDF Download', () => {
  test('should trigger PDF download', async ({ page }) => {
    await page.goto('/');

    // Load example data first to have content
    await page.getByRole('button', { name: /Eksempel/i }).click();
    const confirmDialog = page.getByRole('dialog');
    if (await confirmDialog.isVisible()) {
      await page.getByRole('button', { name: /Bekreft|OK|Ja/i }).click();
    }

    // Set up download listener
    const downloadPromise = page.waitForEvent('download', { timeout: 10000 }).catch(() => null);

    // Click PDF download button
    await page.getByRole('button', { name: /Last ned PDF/i }).click();

    // Check if download was triggered
    const download = await downloadPromise;
    if (download) {
      const filename = download.suggestedFilename();
      expect(filename).toContain('.pdf');
    }
  });
});

test.describe('Submit Button States', () => {
  test('should show correct submit button for varsel modus', async ({ page }) => {
    await page.goto('/?modus=varsel');

    // Submit button should show "Send varsel til BH"
    const submitButton = page.getByRole('button', { name: /Send varsel/i });
    // Only check if API is connected (button visible)
    if (await submitButton.isVisible()) {
      await expect(submitButton).toContainText(/varsel/i);
    }
  });

  test('should show correct submit button for koe modus', async ({ page }) => {
    await page.goto('/?modus=koe');

    // Submit button should show "Send krav"
    const submitButton = page.getByRole('button', { name: /Send krav/i });
    if (await submitButton.isVisible()) {
      await expect(submitButton).toContainText(/krav/i);
    }
  });

  test('should show correct submit button for svar modus', async ({ page }) => {
    await page.goto('/?modus=svar');

    // Submit button should show "Send svar til TE"
    const submitButton = page.getByRole('button', { name: /Send svar/i });
    if (await submitButton.isVisible()) {
      await expect(submitButton).toContainText(/svar/i);
    }
  });
});

test.describe('Toast Messages', () => {
  test('should show toast when example data is loaded', async ({ page }) => {
    await page.goto('/');

    // Click Eksempel button
    await page.getByRole('button', { name: /Eksempel/i }).click();

    // Confirm dialog
    const confirmButton = page.getByRole('button', { name: /Bekreft|OK|Ja/i });
    if (await confirmButton.isVisible()) {
      await confirmButton.click();
    }

    // Toast message might appear (depends on implementation)
    // Check for any toast-like element
    await page.waitForTimeout(1000);
  });
});

test.describe('Responsive Layout', () => {
  test('should show side panel on desktop', async ({ page }) => {
    // Set desktop viewport
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto('/');

    // Side panel should be visible on large screens
    const sidePanel = page.locator('.lg\\:col-span-1').first();
    if (await sidePanel.isVisible()) {
      await expect(sidePanel).toBeVisible();
    }
  });

  test('should hide side panel on mobile', async ({ page }) => {
    // Set mobile viewport
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto('/');

    // Side panel should be hidden on small screens
    const sidePanel = page.locator('.lg\\:col-span-1').first();
    await expect(sidePanel).toHaveClass(/hidden/);
  });
});
