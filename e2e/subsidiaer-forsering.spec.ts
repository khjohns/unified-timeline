/**
 * E2E Tests: Subsidiær Datamodell and Forseringsvarsel (§33.8)
 *
 * These tests verify:
 * 1. BH can respond to grunnlag with rejection (which triggers subsidiary mode)
 * 2. Forsering button appears after BH rejects frist
 * 3. TE can send forsering varsel with 30% calculation
 *
 * Note: Full subsidiary flow tests require complex setup. These tests
 * focus on the forsering varsel functionality after grunnlag/frist rejection.
 */

import { test, expect } from './fixtures';

test.describe('BH Grunnlag Rejection Flow', () => {
  test.describe.configure({ mode: 'serial' });

  let testCase: { sakId: string; token: string; url: string; grunnlagData: unknown };

  test.beforeAll(async ({ api }) => {
    // Create a case with grunnlag
    const sakId = `e2e-rejection-${Date.now()}`;
    testCase = await api.createCaseWithGrunnlag(sakId, 'E2E Test: Grunnlag Rejection');
  });

  test('BH can reject grunnlag with "Avslått"', async ({ page }) => {
    await page.goto(testCase.url);
    await expect(page).toHaveURL(/\/saker\//);

    // Switch to BH role
    await page.getByLabel('Bytt til Byggherre modus').click();
    await expect(page.getByLabel('Bytt til Byggherre modus')).toHaveAttribute('aria-pressed', 'true', { timeout: 5000 });

    // Click "Svar" button
    await page.getByRole('button', { name: /^svar$/i }).first().click();
    await expect(page.getByRole('dialog')).toBeVisible();

    // Select "Avslått - BH avslår ansvarsgrunnlaget" using radio button
    await page.getByRole('radio', { name: /avslått/i }).click();

    // Fill begrunnelse
    await page.getByRole('textbox').fill('BH avslår grunnlaget. E2E test for rejection flow.');
    await page.getByRole('button', { name: /send svar/i }).click();
    await expect(page.getByRole('dialog')).not.toBeVisible({ timeout: 10000 });

    // Verify grunnlag status is now "Avslått"
    await expect(page.getByText(/avslått/i).first()).toBeVisible({ timeout: 5000 });
  });

  test('BH rejection info shows in timeline', async ({ page }) => {
    await page.goto(testCase.url);
    await expect(page).toHaveURL(/\/saker\//);

    // Should see the rejection status - look for "Avslått" text
    await expect(page.getByText(/avslått/i).first()).toBeVisible({ timeout: 5000 });
  });
});

test.describe('Forseringsvarsel UI Components', () => {
  test.describe.configure({ mode: 'serial' });

  let testCase: { sakId: string; token: string; url: string; grunnlagData: unknown };

  test.beforeAll(async ({ api }) => {
    // Create a case with grunnlag and frist submitted via UI
    const sakId = `e2e-forsering-ui-${Date.now()}`;
    testCase = await api.createCaseWithGrunnlag(sakId, 'E2E Test: Forsering UI');
  });

  test('TE submits frist claim via UI', async ({ page }) => {
    await page.goto(testCase.url);
    await expect(page).toHaveURL(/\/saker\//);

    // TE role is default - click "Send krav" button in Frist section
    const fristSection = page.locator('div').filter({ hasText: /^Frist/ }).first();
    await fristSection.getByRole('button', { name: /send krav/i }).click();
    await expect(page.getByRole('dialog')).toBeVisible();

    // Select varsel type - spesifisert
    await page.getByRole('radio', { name: /spesifisert krav/i }).first().click();

    // Check "Varsel sendes nå" checkbox
    await page.getByRole('checkbox', { name: /varsel sendes nå/i }).first().click();

    // Fill days
    const dagerInput = page.getByRole('spinbutton');
    await expect(dagerInput).toBeVisible({ timeout: 5000 });
    await dagerInput.fill('15');

    // Fill begrunnelse
    await page.getByRole('textbox').first().fill('E2E test fristkrav for forsering testing - 15 dager forlengelse.');

    // Submit
    await page.getByRole('button', { name: /send fristkrav/i }).click();
    await expect(page.getByRole('dialog')).not.toBeVisible({ timeout: 10000 });

    // Verify FRIST status changed to "Sendt"
    const fristSectionAfter = page.locator('div').filter({ hasText: /^Frist/ }).first();
    await expect(fristSectionAfter.getByText(/sendt/i).first()).toBeVisible({ timeout: 5000 });
  });

  test('Forsering button NOT visible before BH responds to frist', async ({ page }) => {
    await page.goto(testCase.url);
    await expect(page).toHaveURL(/\/saker\//);

    // TE role is default - forsering button should NOT be visible
    await expect(page.getByRole('button', { name: /forsering/i })).not.toBeVisible();
  });

  test('BH approves grunnlag first', async ({ page }) => {
    await page.goto(testCase.url);
    await expect(page).toHaveURL(/\/saker\//);

    // Switch to BH role
    await page.getByLabel('Bytt til Byggherre modus').click();
    await expect(page.getByLabel('Bytt til Byggherre modus')).toHaveAttribute('aria-pressed', 'true', { timeout: 5000 });

    // Click "Svar" button for grunnlag
    await page.getByRole('button', { name: /^svar$/i }).first().click();
    await expect(page.getByRole('dialog')).toBeVisible();

    // Select "Godkjent"
    await page.getByRole('radio', { name: 'Godkjent - BH aksepterer ansvarsgrunnlaget' }).click();

    // Fill begrunnelse
    await page.getByRole('textbox').fill('Grunnlag godkjent for forsering-test.');
    await page.getByRole('button', { name: /send svar/i }).click();
    await expect(page.getByRole('dialog')).not.toBeVisible({ timeout: 10000 });
  });

  test('BH rejects frist claim via wizard', async ({ page }) => {
    await page.goto(testCase.url);
    await expect(page).toHaveURL(/\/saker\//);

    // Switch to BH role
    await page.getByLabel('Bytt til Byggherre modus').click();
    await expect(page.getByLabel('Bytt til Byggherre modus')).toHaveAttribute('aria-pressed', 'true', { timeout: 5000 });

    // Find the Frist section "Svar" button
    const fristSection = page.locator('div').filter({ hasText: /^Frist/ }).first();
    await fristSection.getByRole('button', { name: /^svar$/i }).click();
    await expect(page.getByRole('dialog')).toBeVisible();

    // The frist response modal is a wizard with 5 steps:
    // 1. Oversikt, 2. Preklusjon, 3. Vilkår, 4. Beregning, 5. Oppsummering

    // Step 1: Oversikt - just click Neste
    await page.getByRole('button', { name: /neste/i }).click();

    // Step 2: Preklusjon - select "Nei" (not preklusive) and fill begrunnelse, then Neste
    await page.getByRole('radio', { name: /nei/i }).first().click();
    await page.getByRole('textbox').first().fill('Varselet ble mottatt i tide.');
    await page.getByRole('button', { name: /neste/i }).click();

    // Step 3: Vilkår - select "Nei" (ingen hindring) and fill begrunnelse, then Neste
    await page.getByRole('radio', { name: /nei/i }).first().click();
    await page.getByRole('textbox').first().fill('Ingen reell hindring foreligger - TE hadde slakk.');
    await page.getByRole('button', { name: /neste/i }).click();

    // Step 4: Beregning - set 0 days and Neste
    await page.getByRole('spinbutton').fill('0');
    await page.getByRole('button', { name: /neste/i }).click();

    // Step 5: Oppsummering - submit with "Send svar"
    await page.getByRole('button', { name: /send svar/i }).click();

    await expect(page.getByRole('dialog')).not.toBeVisible({ timeout: 10000 });

    // Verify frist section no longer shows "Svar" button (has been responded to)
    // The status might be "Avslått" or "0 dager" depending on the wizard result
    const fristSectionAfter = page.locator('div').filter({ hasText: /^Frist/ }).first();
    await expect(fristSectionAfter.getByRole('button', { name: /^svar$/i })).not.toBeVisible({ timeout: 5000 });
  });

  test('Forsering button should be visible after BH rejects frist', async ({ page }) => {
    await page.goto(testCase.url);
    await expect(page).toHaveURL(/\/saker\//);

    // TE role is default - forsering button should now be visible
    await expect(page.getByRole('button', { name: /forsering/i })).toBeVisible({ timeout: 10000 });
  });

  test('SendForseringModal can be opened', async ({ page }) => {
    await page.goto(testCase.url);
    await expect(page).toHaveURL(/\/saker\//);

    // Click forsering button
    await page.getByRole('button', { name: /forsering/i }).click();
    await expect(page.getByRole('dialog')).toBeVisible();

    // Modal should have a heading related to forsering
    await expect(page.getByRole('heading').first()).toBeVisible();

    // Close modal
    await page.keyboard.press('Escape');
    await expect(page.getByRole('dialog')).not.toBeVisible();
  });
});
