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

  test('BH can reject grunnlag with "Avvist - Uenig"', async ({ page }) => {
    await page.goto(testCase.url);
    await expect(page).toHaveURL(/\/saker\//);

    // Switch to BH role
    await page.getByLabel('Bytt til Byggherre modus').click();
    await expect(page.getByLabel('Bytt til Byggherre modus')).toHaveAttribute('aria-pressed', 'true', { timeout: 5000 });

    // Click "Svar" button
    await page.getByRole('button', { name: /^svar$/i }).first().click();
    await expect(page.getByRole('dialog')).toBeVisible();

    // Select "Avvist - Uenig" using radio button
    await page.getByRole('radio', { name: 'Avvist - Uenig i ansvarsgrunnlaget' }).click();

    // Fill begrunnelse
    await page.getByRole('textbox').fill('BH avviser grunnlaget - uenig i ansvarsgrunnlaget. E2E test for rejection flow.');
    await page.getByRole('button', { name: /send svar/i }).click();
    await expect(page.getByRole('dialog')).not.toBeVisible({ timeout: 10000 });

    // Verify grunnlag status is now "Avvist" (use exact match to avoid matching avvist_uenig event)
    await expect(page.getByText('Avvist', { exact: true })).toBeVisible({ timeout: 5000 });
  });

  test('BH rejection info shows in Sammendrag', async ({ page }) => {
    await page.goto(testCase.url);
    await expect(page).toHaveURL(/\/saker\//);

    // Should see the rejection in timeline
    await expect(page.getByText(/avvist_uenig/i)).toBeVisible({ timeout: 5000 });
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

    // TE role is default - click the second "Send krav" button (first is Vederlag, second is Frist)
    const sendKravButtons = page.getByRole('button', { name: /send krav/i });
    await expect(sendKravButtons.nth(1)).toBeVisible({ timeout: 5000 });
    await sendKravButtons.nth(1).click(); // Second button is for Frist
    await expect(page.getByRole('dialog')).toBeVisible();

    // Select varsel type - spesifisert
    await page.getByRole('radio', { name: 'Spesifisert krav (§33.6)' }).first().click();

    // Check "Varsel sendes nå" checkbox
    await page.getByRole('checkbox', { name: /varsel sendes nå/i }).first().click();

    // Fill days
    const dagerInput = page.getByRole('spinbutton');
    await expect(dagerInput).toBeVisible({ timeout: 5000 });
    await dagerInput.fill('15');

    // Fill begrunnelse
    await page.getByTestId('frist-begrunnelse').fill('E2E test fristkrav for forsering testing - 15 dager forlengelse.');

    // Submit
    await page.getByTestId('frist-submit').click();
    await expect(page.getByRole('dialog')).not.toBeVisible({ timeout: 10000 });

    // Verify FRIST status changed to "Sendt" - look for the Frist section showing "Sendt" and "15 dager"
    await expect(page.getByLabel('Status Dashboard').getByText('dager')).toBeVisible({ timeout: 5000 });
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

  test('BH rejects frist claim with "ingen hindring"', async ({ page }) => {
    await page.goto(testCase.url);
    await expect(page).toHaveURL(/\/saker\//);

    // Switch to BH role
    await page.getByLabel('Bytt til Byggherre modus').click();
    await expect(page.getByLabel('Bytt til Byggherre modus')).toHaveAttribute('aria-pressed', 'true', { timeout: 5000 });

    // Now there should be a "Svar" button for frist (grunnlag is handled)
    // Wait for UI to stabilize
    await page.waitForTimeout(500);

    // Find the frist section and click its Svar button (use exact match to avoid "Endre svar")
    const fristSection = page.locator('section, div').filter({ has: page.locator('text=FRIST') });
    await fristSection.getByRole('button', { name: 'Svar', exact: true }).click();
    await expect(page.getByRole('dialog')).toBeVisible();

    // The frist modal is a wizard. Navigate through it to reject:
    // Port 1: Preklusjon - Check if there's a "Ja" option for timing
    const jaRadio = page.getByRole('radio', { name: /ja/i }).first();
    if (await jaRadio.isVisible()) {
      await jaRadio.click();
    }

    // Look for "Neste" button to advance wizard
    const nesteButton = page.getByRole('button', { name: /neste/i });
    if (await nesteButton.isVisible()) {
      await nesteButton.click();
    }

    // Port 2: Vilkår - reject (ingen hindring)
    const vilkarNeiRadio = page.getByRole('radio', { name: /nei/i }).first();
    if (await vilkarNeiRadio.isVisible()) {
      await vilkarNeiRadio.click();

      // Fill begrunnelse for vilkår rejection
      const vilkarBegrunnelse = page.getByRole('textbox').first();
      if (await vilkarBegrunnelse.isVisible()) {
        await vilkarBegrunnelse.fill('TE hadde slakk i fremdriftsplanen - ingen reell hindring.');
      }
    }

    // Continue through wizard
    if (await nesteButton.isVisible()) {
      await nesteButton.click();
    }

    // Port 3: Beregning - set to 0 days
    const dagerInput = page.getByRole('spinbutton').first();
    if (await dagerInput.isVisible()) {
      await dagerInput.fill('0');
    }

    // Continue to summary
    if (await nesteButton.isVisible()) {
      await nesteButton.click();
    }

    // Fill samlet begrunnelse if visible
    const samletBegrunnelse = page.getByRole('textbox').first();
    if (await samletBegrunnelse.isVisible()) {
      await samletBegrunnelse.fill('BH avslår fristkravet - ingen hindring foreligger. E2E test.');
    }

    // Submit (could be "Send svar" or "Bekreft")
    const submitButton = page.getByRole('button', { name: /send svar|bekreft/i }).first();
    await submitButton.click();

    await expect(page.getByRole('dialog')).not.toBeVisible({ timeout: 10000 });
  });

  test('Forsering button should be visible after BH rejects frist', async ({ page }) => {
    await page.goto(testCase.url);
    await expect(page).toHaveURL(/\/saker\//);

    // TE role is default - forsering button should now be visible
    await expect(page.getByRole('button', { name: /forsering/i })).toBeVisible({ timeout: 10000 });
  });

  test('SendForseringModal displays 30% calculation', async ({ page }) => {
    await page.goto(testCase.url);
    await expect(page).toHaveURL(/\/saker\//);

    // Click forsering button
    await page.getByRole('button', { name: /forsering/i }).click();
    await expect(page.getByRole('dialog')).toBeVisible();

    // Modal should have correct heading
    await expect(page.getByRole('heading', { name: /forseringsvarsel/i })).toBeVisible();

    // Should see 30% calculation section
    await expect(page.getByText(/30%-beregning/i)).toBeVisible();
    await expect(page.getByText(/dagmulktsats/i).first()).toBeVisible();
    await expect(page.getByText(/maks forseringskostnad/i).first()).toBeVisible();

    // Should see context about rejected days
    await expect(page.getByText(/avslåtte dager/i).first()).toBeVisible();

    // Close modal
    await page.keyboard.press('Escape');
  });
});
