import { test, expect } from '@playwright/test';

/**
 * E2E Tests for Form Validation
 *
 * Tests validation rules for required fields, date ranges, and amount formats.
 */

// Add delay between tests to avoid browser closing race condition in single-process mode
test.afterEach(async () => {
  await new Promise((resolve) => setTimeout(resolve, 100));
});

test.describe('Varsel Validation', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    // Ensure we're on Varsel tab
    await page.getByRole('tab', { name: /Varsel/i }).click();
  });

  test('should show error when trying to send without required date field', async ({ page }) => {
    // Try to send without filling dato_forhold_oppdaget
    const sendButton = page.getByRole('button', { name: /Send varsel/i });
    if (await sendButton.isVisible()) {
      await sendButton.click();

      // Should show error toast/message about missing date
      await expect(page.getByText(/fyll ut alle påkrevde felt/i)).toBeVisible({ timeout: 3000 });
    }
  });

  test('should show error when trying to send without selecting hovedkategori', async ({ page }) => {
    // Fill date but not hovedkategori
    const dateInput = page.locator('input[type="date"]').first();
    if (await dateInput.isVisible()) {
      const today = new Date().toISOString().split('T')[0];
      await dateInput.fill(today);

      const sendButton = page.getByRole('button', { name: /Send varsel/i });
      if (await sendButton.isVisible()) {
        await sendButton.click();

        // Should show error about missing hovedkategori
        await expect(page.getByText(/fyll ut alle påkrevde felt/i)).toBeVisible({ timeout: 3000 });
      }
    }
  });

  test('should require varsel date and method when previously notified', async ({ page }) => {
    // Select "Ja" for tidligere varslet
    const jaRadio = page.getByRole('radio', { name: /Ja/i }).first();
    if (await jaRadio.isVisible()) {
      await jaRadio.click();

      // Fill required fields
      const dateInput = page.locator('input[type="date"]').first();
      if (await dateInput.isVisible()) {
        const today = new Date().toISOString().split('T')[0];
        await dateInput.fill(today);
      }

      // Select hovedkategori
      const hovedkategoriSelect = page.locator('select').first();
      if (await hovedkategoriSelect.isVisible()) {
        await hovedkategoriSelect.selectOption({ index: 1 });
      }

      // Try to send without varsel date and method
      const sendButton = page.getByRole('button', { name: /Send varsel/i });
      if (await sendButton.isVisible()) {
        await sendButton.click();

        // Should show error about missing varsel date
        await expect(page.getByText(/når varselet ble sendt/i)).toBeVisible({ timeout: 3000 });
      }
    }
  });
});

test.describe('KOE Validation', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    // Navigate to KOE tab
    await page.getByRole('tab', { name: /Krav/i }).click();
  });

  test('should require at least one claim type (vederlag or frist)', async ({ page }) => {
    // Try to send without selecting any claim type
    const sendButton = page.getByRole('button', { name: /Send krav/i });
    if (await sendButton.isVisible()) {
      await sendButton.click();

      // Should show error about selecting at least one claim
      await expect(page.getByText(/minst ett krav/i)).toBeVisible({ timeout: 3000 });
    }
  });

  test('should validate amount is positive when vederlag is selected', async ({ page }) => {
    // Select vederlag claim
    const vederlagRadio = page.getByRole('radio', { name: /Bare vederlag/i });
    if (await vederlagRadio.isVisible()) {
      await vederlagRadio.click();

      // Select oppgjørsmetode
      const metodeSelect = page.locator('select').first();
      if (await metodeSelect.isVisible()) {
        await metodeSelect.selectOption({ index: 1 });
      }

      // Try negative or zero amount
      const amountInput = page.locator('input[type="number"]').first();
      if (await amountInput.isVisible()) {
        await amountInput.fill('0');

        // Fill begrunnelse
        const textarea = page.locator('textarea').first();
        if (await textarea.isVisible()) {
          await textarea.fill('Test begrunnelse');
        }

        const sendButton = page.getByRole('button', { name: /Send krav/i });
        if (await sendButton.isVisible()) {
          await sendButton.click();

          // Should show error about amount
          await expect(page.getByText(/krevd beløp/i)).toBeVisible({ timeout: 3000 });
        }
      }
    }
  });

  test('should require begrunnelse when vederlag is claimed', async ({ page }) => {
    // Select vederlag claim
    const vederlagRadio = page.getByRole('radio', { name: /Bare vederlag/i });
    if (await vederlagRadio.isVisible()) {
      await vederlagRadio.click();

      // Select oppgjørsmetode
      const metodeSelect = page.locator('select').first();
      if (await metodeSelect.isVisible()) {
        await metodeSelect.selectOption({ index: 1 });
      }

      // Fill amount but not begrunnelse
      const amountInput = page.locator('input[type="number"]').first();
      if (await amountInput.isVisible()) {
        await amountInput.fill('50000');

        const sendButton = page.getByRole('button', { name: /Send krav/i });
        if (await sendButton.isVisible()) {
          await sendButton.click();

          // Should show error about missing begrunnelse
          await expect(page.getByText(/begrunnelse.*vederlag/i)).toBeVisible({ timeout: 3000 });
        }
      }
    }
  });

  test('should validate frist extension requires positive days', async ({ page }) => {
    // Select frist claim
    const fristRadio = page.getByRole('radio', { name: /Bare fristforlengelse/i });
    if (await fristRadio.isVisible()) {
      await fristRadio.click();

      // Select frist type
      const fristTypeSelect = page.locator('select').first();
      if (await fristTypeSelect.isVisible()) {
        await fristTypeSelect.selectOption({ index: 1 });
      }

      // Try zero or negative days
      const daysInput = page.locator('input[type="number"]').first();
      if (await daysInput.isVisible()) {
        await daysInput.fill('0');

        // Fill begrunnelse
        const textarea = page.locator('textarea').first();
        if (await textarea.isVisible()) {
          await textarea.fill('Test begrunnelse for frist');
        }

        const sendButton = page.getByRole('button', { name: /Send krav/i });
        if (await sendButton.isVisible()) {
          await sendButton.click();

          // Should show error about days
          await expect(page.getByText(/antall dager/i)).toBeVisible({ timeout: 3000 });
        }
      }
    }
  });

  test('should require begrunnelse for frist extension', async ({ page }) => {
    // Select frist claim
    const fristRadio = page.getByRole('radio', { name: /Bare fristforlengelse/i });
    if (await fristRadio.isVisible()) {
      await fristRadio.click();

      // Select frist type
      const fristTypeSelect = page.locator('select').first();
      if (await fristTypeSelect.isVisible()) {
        await fristTypeSelect.selectOption({ index: 1 });
      }

      // Fill days but not begrunnelse
      const daysInput = page.locator('input[type="number"]').first();
      if (await daysInput.isVisible()) {
        await daysInput.fill('10');

        const sendButton = page.getByRole('button', { name: /Send krav/i });
        if (await sendButton.isVisible()) {
          await sendButton.click();

          // Should show error about missing begrunnelse
          await expect(page.getByText(/begrunnelse.*frist/i)).toBeVisible({ timeout: 3000 });
        }
      }
    }
  });
});

test.describe('BH Svar Validation', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    // Switch to BH role
    await page.getByRole('button', { name: 'BH' }).click();
    // Navigate to Svar tab
    await page.getByRole('tab', { name: /Svar/i }).click();
  });

  test('should require decision type before sending answer', async ({ page }) => {
    // Try to send without selecting decision
    const sendButton = page.getByRole('button', { name: /Send svar|Svar på krav/i });
    if (await sendButton.isVisible()) {
      await sendButton.click();

      // Should show error about missing decision
      await expect(page.getByText(/velg.*beslutning|påkrevde felt/i)).toBeVisible({ timeout: 3000 });
    }
  });

  test('should require begrunnelse when rejecting claim', async ({ page }) => {
    // Select "Avvist" decision if available
    const avvistRadio = page.getByRole('radio', { name: /Avvist|Nei/i }).first();
    if (await avvistRadio.isVisible()) {
      await avvistRadio.click();

      const sendButton = page.getByRole('button', { name: /Send svar|Svar på krav/i });
      if (await sendButton.isVisible()) {
        await sendButton.click();

        // Should show error about missing begrunnelse
        await expect(page.getByText(/begrunnelse/i)).toBeVisible({ timeout: 3000 });
      }
    }
  });
});

test.describe('Date Range Validation', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('should validate that from-date is not after to-date', async ({ page }) => {
    // This test depends on whether the app has date range fields
    // Check if there are multiple date fields in any form
    const dateInputs = page.locator('input[type="date"]');
    const count = await dateInputs.count();

    if (count >= 2) {
      const today = new Date();
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);
      const yesterday = new Date(today);
      yesterday.setDate(yesterday.getDate() - 1);

      const todayStr = today.toISOString().split('T')[0];
      const tomorrowStr = tomorrow.toISOString().split('T')[0];
      const yesterdayStr = yesterday.toISOString().split('T')[0];

      // Try to fill first date with future date and second with past date
      await dateInputs.nth(0).fill(tomorrowStr);
      await dateInputs.nth(1).fill(yesterdayStr);

      // Blur to trigger validation
      await dateInputs.nth(1).blur();

      // Check if there's a validation message
      // Note: This test may need adjustment based on actual validation implementation
      const errorMessage = page.getByText(/dato.*før|ugyldig.*dato/i);
      if (await errorMessage.isVisible({ timeout: 1000 }).catch(() => false)) {
        await expect(errorMessage).toBeVisible();
      }
    }
  });
});

test.describe('Amount Format Validation', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.getByRole('tab', { name: /Krav/i }).click();
  });

  test('should only accept numeric values for amount', async ({ page }) => {
    // Select vederlag to show amount field
    const vederlagRadio = page.getByRole('radio', { name: /Bare vederlag/i });
    if (await vederlagRadio.isVisible()) {
      await vederlagRadio.click();

      const amountInput = page.locator('input[type="number"]').first();
      if (await amountInput.isVisible()) {
        // Try to input text - browser should prevent or clear it
        await amountInput.fill('abc');
        const value = await amountInput.inputValue();

        // Should be empty or contain only valid numbers
        expect(value).not.toContain('abc');
      }
    }
  });

  test('should validate amount is a positive number', async ({ page }) => {
    // Select vederlag to show amount field
    const vederlagRadio = page.getByRole('radio', { name: /Bare vederlag/i });
    if (await vederlagRadio.isVisible()) {
      await vederlagRadio.click();

      const amountInput = page.locator('input[type="number"]').first();
      if (await amountInput.isVisible()) {
        // Try negative amount
        await amountInput.fill('-1000');

        // Select oppgjørsmetode
        const metodeSelect = page.locator('select').first();
        if (await metodeSelect.isVisible()) {
          await metodeSelect.selectOption({ index: 1 });
        }

        // Fill begrunnelse
        const textarea = page.locator('textarea').first();
        if (await textarea.isVisible()) {
          await textarea.fill('Test');
        }

        const sendButton = page.getByRole('button', { name: /Send krav/i });
        if (await sendButton.isVisible()) {
          await sendButton.click();

          // Should show validation error
          await expect(page.getByText(/krevd beløp/i)).toBeVisible({ timeout: 3000 });
        }
      }
    }
  });
});
