/**
 * E2E Tests: Vederlag (Compensation) and Frist (Deadline) Flows
 *
 * Tests the complete flow of:
 * 1. TE submitting vederlag claims with different calculation methods
 * 2. TE submitting frist claims with different varsel types
 * 3. State updates and timeline verification
 */

import { test, expect } from './fixtures';

test.describe('Vederlag Flow', () => {
  test.describe.configure({ mode: 'serial' });

  let testCase: { sakId: string; token: string; url: string; grunnlagData: unknown };

  test.beforeAll(async ({ api }) => {
    // Create a case with grunnlag already submitted (required before vederlag)
    const sakId = `e2e-vederlag-${Date.now()}`;
    testCase = await api.createCaseWithGrunnlag(sakId, 'E2E Test: Vederlag');
  });

  test('should show "Send vederlagskrav" button after grunnlag is sent', async ({ page }) => {
    await page.goto(testCase.url);
    await expect(page).toHaveURL(/\/saker\//);

    // Should see vederlag button in dashboard
    await expect(page.getByRole('button', { name: /send vederlagskrav/i })).toBeVisible({ timeout: 10000 });
  });

  test('should open vederlag modal and show form fields', async ({ page }) => {
    await page.goto(testCase.url);
    await expect(page).toHaveURL(/\/saker\//);

    // Click "Send vederlagskrav" button
    await page.getByRole('button', { name: /send vederlagskrav/i }).click();

    // Modal should open
    await expect(page.getByRole('dialog')).toBeVisible();
    await expect(page.getByRole('heading', { name: /vederlagsjustering/i })).toBeVisible();

    // Form should show method selection
    await expect(page.getByTestId('vederlag-metode')).toBeVisible();
    await expect(page.getByTestId('vederlag-begrunnelse')).toBeVisible();
    await expect(page.getByTestId('vederlag-submit')).toBeVisible();

    // Close modal
    await page.keyboard.press('Escape');
  });

  test('should submit vederlag with ENHETSPRISER method', async ({ page }) => {
    await page.goto(testCase.url);
    await expect(page).toHaveURL(/\/saker\//);

    // Click "Send vederlagskrav" button
    await page.getByRole('button', { name: /send vederlagskrav/i }).click();
    await expect(page.getByRole('dialog')).toBeVisible();

    // Select ENHETSPRISER method - use .first() because Radix renders both styled + native radio
    await page.getByRole('radio', { name: 'Enhetspriser (§34.3)' }).first().click();

    // Wait for amount field section to appear
    await expect(page.getByText(/Sum direkte kostnader/)).toBeVisible({ timeout: 5000 });

    // Fill the CurrencyInput - it's an input[type="text"] within the form
    // The CurrencyInput is the first text input after selecting ENHETSPRISER
    const amountInput = page.locator('input[inputmode="decimal"]').first();
    await amountInput.fill('150000');

    // Fill begrunnelse
    await page.getByTestId('vederlag-begrunnelse').fill('E2E test begrunnelse for vederlagskrav med enhetspriser. Henvisning til vedlegg og beregningsgrunnlag.');

    // Submit the form
    await page.getByTestId('vederlag-submit').click();

    // Wait for modal to close (indicates success)
    await expect(page.getByRole('dialog')).not.toBeVisible({ timeout: 10000 });

    // Verify timeline shows the new event - use specific heading text to avoid matching multiple elements
    await expect(page.getByRole('heading', { name: 'Vederlagskrav sendt' })).toBeVisible({ timeout: 5000 });
  });
});

test.describe('Frist Flow', () => {
  test.describe.configure({ mode: 'serial' });

  let testCase: { sakId: string; token: string; url: string; grunnlagData: unknown };

  test.beforeAll(async ({ api }) => {
    // Create a case with grunnlag already submitted (required before frist)
    const sakId = `e2e-frist-${Date.now()}`;
    testCase = await api.createCaseWithGrunnlag(sakId, 'E2E Test: Frist');
  });

  test('should show "Send fristkrav" button after grunnlag is sent', async ({ page }) => {
    await page.goto(testCase.url);
    await expect(page).toHaveURL(/\/saker\//);

    // Should see frist button in dashboard
    await expect(page.getByRole('button', { name: /send fristkrav/i })).toBeVisible({ timeout: 10000 });
  });

  test('should open frist modal and show form fields', async ({ page }) => {
    await page.goto(testCase.url);
    await expect(page).toHaveURL(/\/saker\//);

    // Click "Send fristkrav" button
    await page.getByRole('button', { name: /send fristkrav/i }).click();

    // Modal should open
    await expect(page.getByRole('dialog')).toBeVisible();
    await expect(page.getByRole('heading', { name: /send fristkrav/i })).toBeVisible();

    // Form should show varsel type selection
    await expect(page.getByTestId('frist-varsel-type')).toBeVisible();
    await expect(page.getByTestId('frist-begrunnelse')).toBeVisible();
    await expect(page.getByTestId('frist-submit')).toBeVisible();

    // Close modal
    await page.keyboard.press('Escape');
  });

  test('should submit frist with spesifisert varsel', async ({ page }) => {
    await page.goto(testCase.url);
    await expect(page).toHaveURL(/\/saker\//);

    // Click "Send fristkrav" button
    await page.getByRole('button', { name: /send fristkrav/i }).click();
    await expect(page.getByRole('dialog')).toBeVisible();

    // Select spesifisert varsel type - use .first() because Radix renders both styled + native radio
    await page.getByRole('radio', { name: 'Spesifisert krav (§33.6)' }).first().click();

    // Check "Varsel sendes nå" checkbox (required for spesifisert krav)
    await page.getByRole('checkbox', { name: /varsel sendes nå/i }).first().click();

    // Fill days - spinbutton should be visible after selecting varsel type
    const dagerInput = page.getByRole('spinbutton');
    await expect(dagerInput).toBeVisible({ timeout: 5000 });
    await dagerInput.fill('14');

    // Fill begrunnelse
    await page.getByTestId('frist-begrunnelse').fill('E2E test begrunnelse for fristkrav. Forholdet hindrer fremdriften og krever fristforlengelse på 14 kalenderdager.');

    // Submit the form
    await page.getByTestId('frist-submit').click();

    // Wait for modal to close (indicates success)
    await expect(page.getByRole('dialog')).not.toBeVisible({ timeout: 10000 });

    // Verify FRIST status changed to "Sendt" in dashboard
    await expect(page.locator('h3:has-text("FRIST")').locator('..').getByText('Sendt')).toBeVisible({ timeout: 5000 });
  });
});

test.describe('BH Response Flow - Grunnlag', () => {
  test.describe.configure({ mode: 'serial' });

  let testCase: { sakId: string; token: string; url: string; grunnlagData: unknown };

  test.beforeAll(async ({ api }) => {
    // Create a case with grunnlag already submitted
    const sakId = `e2e-bh-grunnlag-${Date.now()}`;
    testCase = await api.createCaseWithGrunnlag(sakId, 'E2E Test: BH Grunnlag Response');
  });

  test('should show "Svar på grunnlag" button when BH role is selected', async ({ page }) => {
    await page.goto(testCase.url);
    await expect(page).toHaveURL(/\/saker\//);

    // Switch to BH role - button has text "BH" and aria-label "Bytt til Byggherre modus"
    await page.getByLabel('Bytt til Byggherre modus').click();
    // Wait for UI to update after role switch
    await expect(page.getByLabel('Bytt til Byggherre modus')).toHaveAttribute('aria-pressed', 'true', { timeout: 5000 });

    // Should see response button (just "Svar" in grunnlag section)
    await expect(page.getByRole('button', { name: /^svar$/i })).toBeVisible({ timeout: 10000 });
  });

  test('should open respond grunnlag modal and show form fields', async ({ page }) => {
    await page.goto(testCase.url);
    await expect(page).toHaveURL(/\/saker\//);

    // Switch to BH role - button has text "BH" and aria-label "Bytt til Byggherre modus"
    await page.getByLabel('Bytt til Byggherre modus').click();
    // Wait for UI to update after role switch
    await expect(page.getByLabel('Bytt til Byggherre modus')).toHaveAttribute('aria-pressed', 'true', { timeout: 5000 });

    // Click "Svar" button in grunnlag section
    await page.getByRole('button', { name: /^svar$/i }).first().click();

    // Modal should open
    await expect(page.getByRole('dialog')).toBeVisible();
    await expect(page.getByRole('heading', { name: /svar på grunnlag/i })).toBeVisible();

    // Form should show resultat selection (now a RadioGroup, not Select)
    await expect(page.getByRole('radiogroup')).toBeVisible();
    await expect(page.getByRole('radio', { name: /^Godkjent - BH aksepterer/i })).toBeVisible();
    await expect(page.getByPlaceholder(/begrunn/i)).toBeVisible();
    await expect(page.getByRole('button', { name: /send svar/i })).toBeVisible();

    // Close modal
    await page.keyboard.press('Escape');
  });

  test('should submit BH grunnlag response with "godkjent"', async ({ page }) => {
    await page.goto(testCase.url);
    await expect(page).toHaveURL(/\/saker\//);

    // Switch to BH role - button has text "BH" and aria-label "Bytt til Byggherre modus"
    await page.getByLabel('Bytt til Byggherre modus').click();
    // Wait for UI to update after role switch
    await expect(page.getByLabel('Bytt til Byggherre modus')).toHaveAttribute('aria-pressed', 'true', { timeout: 5000 });

    // Click "Svar" button in grunnlag section
    await page.getByRole('button', { name: /^svar$/i }).first().click();
    await expect(page.getByRole('dialog')).toBeVisible();

    // Select "Godkjent" using radio button (UI was changed from Select to RadioGroup)
    // Use exact name to avoid matching "Delvis godkjent - BH"
    await page.getByRole('radio', { name: 'Godkjent - BH aksepterer ansvarsgrunnlaget' }).click();

    // Fill begrunnelse - use textbox role since placeholder changes based on selection
    await page.getByRole('textbox').fill('E2E test: Grunnlaget godkjennes. Forholdet er utenfor entreprenørens kontroll og utgjør en endring.');

    // Submit the form
    await page.getByRole('button', { name: /send svar/i }).click();

    // Wait for modal to close (indicates success)
    await expect(page.getByRole('dialog')).not.toBeVisible({ timeout: 10000 });

    // Verify timeline shows the response event
    await expect(page.getByText(/godkjent/i).first()).toBeVisible({ timeout: 5000 });
  });
});

test.describe('Role-Based Access Control', () => {
  let testCase: { sakId: string; token: string; url: string; grunnlagData: unknown };

  test.beforeAll(async ({ api }) => {
    const sakId = `e2e-rbac-${Date.now()}`;
    testCase = await api.createCaseWithGrunnlag(sakId, 'E2E Test: RBAC');
  });

  test('TE should see TE-specific buttons', async ({ page }) => {
    await page.goto(testCase.url);
    await expect(page).toHaveURL(/\/saker\//);

    // TE role is default
    await expect(page.getByRole('button', { name: /oppdater grunnlag/i })).toBeVisible({ timeout: 10000 });
    await expect(page.getByRole('button', { name: /send vederlagskrav/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /send fristkrav/i })).toBeVisible();

    // TE should NOT see BH response buttons (button is just "Svar", not visible for TE)
    // Note: TE does not see "Svar" buttons in this state
  });

  test('BH should see BH-specific buttons', async ({ page }) => {
    await page.goto(testCase.url);
    await expect(page).toHaveURL(/\/saker\//);

    // Switch to BH role - button has text "BH" and aria-label "Bytt til Byggherre modus"
    await page.getByLabel('Bytt til Byggherre modus').click();
    // Wait for UI to update after role switch
    await expect(page.getByLabel('Bytt til Byggherre modus')).toHaveAttribute('aria-pressed', 'true', { timeout: 5000 });

    // BH should see response button (just "Svar" in grunnlag section)
    await expect(page.getByRole('button', { name: /^svar$/i })).toBeVisible({ timeout: 10000 });

    // BH should NOT see TE submission buttons
    await expect(page.getByRole('button', { name: /oppdater grunnlag/i })).not.toBeVisible();
    await expect(page.getByRole('button', { name: /send vederlagskrav/i })).not.toBeVisible();
  });

  test('should toggle between TE and BH roles', async ({ page }) => {
    await page.goto(testCase.url);
    await expect(page).toHaveURL(/\/saker\//);

    // Start as TE (default)
    await expect(page.getByRole('button', { name: /bytt til totalentreprenør/i })).toHaveAttribute('aria-pressed', 'true');

    // Switch to BH
    await page.getByRole('button', { name: /bytt til byggherre/i }).click();
    await expect(page.getByRole('button', { name: /bytt til byggherre/i })).toHaveAttribute('aria-pressed', 'true');

    // Switch back to TE
    await page.getByRole('button', { name: /bytt til totalentreprenør/i }).click();
    await expect(page.getByRole('button', { name: /bytt til totalentreprenør/i })).toHaveAttribute('aria-pressed', 'true');
  });
});

test.describe('Form Validation', () => {
  let testCase: { sakId: string; token: string; url: string; grunnlagData: unknown };

  test.beforeAll(async ({ api }) => {
    const sakId = `e2e-validation-${Date.now()}`;
    testCase = await api.createCaseWithGrunnlag(sakId, 'E2E Test: Validation');
  });

  test('should show validation error for empty vederlag begrunnelse', async ({ page }) => {
    await page.goto(testCase.url);
    await expect(page).toHaveURL(/\/saker\//);

    // Open vederlag modal
    await page.getByRole('button', { name: /send vederlagskrav/i }).click();
    await expect(page.getByRole('dialog')).toBeVisible();

    // Select method but don't fill begrunnelse
    await page.getByRole('radio', { name: 'Enhetspriser (§34.3)' }).first().click();
    await expect(page.getByText(/Sum direkte kostnader/)).toBeVisible({ timeout: 5000 });
    const amountInput = page.locator('input[inputmode="decimal"]').first();
    await amountInput.fill('100000');

    // Try to submit
    await page.getByTestId('vederlag-submit').click();

    // Should show validation error
    await expect(page.getByText(/begrunnelse må være minst 10 tegn/i)).toBeVisible();

    // Close modal
    await page.keyboard.press('Escape');
  });

  test('should show validation error for empty frist begrunnelse', async ({ page }) => {
    await page.goto(testCase.url);
    await expect(page).toHaveURL(/\/saker\//);

    // Open frist modal
    await page.getByRole('button', { name: /send fristkrav/i }).click();
    await expect(page.getByRole('dialog')).toBeVisible();

    // Select varsel type
    await page.getByRole('radio', { name: 'Spesifisert krav (§33.6)' }).first().click();

    // Check "Varsel sendes nå" checkbox (required for spesifisert krav)
    await page.getByRole('checkbox', { name: /varsel sendes nå/i }).first().click();

    // Fill days but not begrunnelse - wait for spinbutton to be visible
    const dagerInput = page.getByRole('spinbutton');
    await expect(dagerInput).toBeVisible({ timeout: 5000 });
    await dagerInput.fill('10');

    // Try to submit
    await page.getByTestId('frist-submit').click();

    // Should show validation error
    await expect(page.getByText(/begrunnelse må være minst 10 tegn/i)).toBeVisible();

    // Close modal
    await page.keyboard.press('Escape');
  });
});

test.describe('Complete Claim Journey', () => {
  test.describe.configure({ mode: 'serial' });

  let testCase: { sakId: string; token: string; url: string };

  test.beforeAll(async ({ api }) => {
    // Create fresh case (no grunnlag yet)
    const sakId = `e2e-journey-${Date.now()}`;
    testCase = await api.createTestCase(sakId, 'E2E Test: Complete Journey');
  });

  test('Step 1: TE sends grunnlag', async ({ page }) => {
    await page.goto(testCase.url);
    await expect(page).toHaveURL(/\/saker\//);

    // Open grunnlag modal
    await page.getByRole('button', { name: /send grunnlag/i }).click();
    await expect(page.getByRole('dialog')).toBeVisible();

    // Fill form
    await page.getByTestId('grunnlag-hovedkategori').click();
    await page.getByRole('option', { name: /endring/i }).first().click();
    await expect(page.getByTestId('grunnlag-underkategori-list')).toBeVisible();
    await page.getByTestId('grunnlag-underkategori-list').getByRole('checkbox').first().click();
    await page.getByTestId('grunnlag-tittel').fill('E2E Journey Test');
    await page.getByTestId('grunnlag-beskrivelse').fill('Test grunnlag for complete journey E2E test.');

    // Set date
    await page.getByTestId('grunnlag-dato-oppdaget').click();
    const today = new Date().getDate().toString();
    await page.locator(`button:has-text("${today}")`).first().click();

    // Check varsel
    await page.getByTestId('grunnlag-varsel-sendes-na').click();

    // Submit
    await page.getByTestId('grunnlag-submit').click();
    await expect(page.getByRole('dialog')).not.toBeVisible({ timeout: 10000 });

    // Verify
    await expect(page.getByRole('heading', { name: 'Grunnlag sendt' })).toBeVisible({ timeout: 5000 });
  });

  test('Step 2: BH responds to grunnlag with "delvis_godkjent" (keeps case open)', async ({ page }) => {
    await page.goto(testCase.url);
    await expect(page).toHaveURL(/\/saker\//);

    // Switch to BH
    await page.getByLabel('Bytt til Byggherre modus').click();
    await expect(page.getByLabel('Bytt til Byggherre modus')).toHaveAttribute('aria-pressed', 'true', { timeout: 5000 });

    // Open response modal
    await page.getByRole('button', { name: /^svar$/i }).first().click();
    await expect(page.getByRole('dialog')).toBeVisible();

    // Fill form - use delvis_godkjent to keep case open for further claims (UI uses RadioGroup)
    await page.getByRole('radio', { name: 'Delvis godkjent - BH aksepterer deler av grunnlaget' }).click();
    // Fill begrunnelse - use textbox role since placeholder changes based on selection
    await page.getByRole('textbox').fill('BH godkjenner grunnlaget delvis i denne E2E-testen.');

    // Submit
    await page.getByRole('button', { name: /send svar/i }).click();
    await expect(page.getByRole('dialog')).not.toBeVisible({ timeout: 10000 });

    // Verify status updated
    await expect(page.getByText(/delvis/i).first()).toBeVisible({ timeout: 5000 });
  });

  test('Step 3: TE sends vederlag after grunnlag approved', async ({ page }) => {
    await page.goto(testCase.url);
    await expect(page).toHaveURL(/\/saker\//);

    // Should be TE by default, open vederlag modal
    await page.getByRole('button', { name: /send vederlagskrav/i }).click();
    await expect(page.getByRole('dialog')).toBeVisible();

    // Fill form - select method and fill amount
    await page.getByRole('radio', { name: 'Enhetspriser (§34.3)' }).first().click();
    await expect(page.getByText(/Sum direkte kostnader/)).toBeVisible({ timeout: 5000 });
    const amountInput = page.locator('input[inputmode="decimal"]').first();
    await amountInput.fill('250000');
    await page.getByTestId('vederlag-begrunnelse').fill('Vederlagskrav for E2E journey test med enhetspriser metode.');

    // Submit
    await page.getByTestId('vederlag-submit').click();
    await expect(page.getByRole('dialog')).not.toBeVisible({ timeout: 10000 });

    // Verify vederlag status updated
    await expect(page.getByText(/sendt/i).first()).toBeVisible({ timeout: 5000 });
  });

  test('Step 4: TE sends frist claim', async ({ page }) => {
    await page.goto(testCase.url);
    await expect(page).toHaveURL(/\/saker\//);

    // Open frist modal
    await page.getByRole('button', { name: /send fristkrav/i }).click();
    await expect(page.getByRole('dialog')).toBeVisible();

    // Fill form - select varsel type
    await page.getByRole('radio', { name: 'Spesifisert krav (§33.6)' }).first().click();

    // Check "Varsel sendes nå" checkbox (required for spesifisert krav)
    await page.getByRole('checkbox', { name: /varsel sendes nå/i }).first().click();

    // Fill days - wait for spinbutton to be visible
    const dagerInput = page.getByRole('spinbutton');
    await expect(dagerInput).toBeVisible({ timeout: 5000 });
    await dagerInput.fill('21');
    await page.getByTestId('frist-begrunnelse').fill('Fristkrav for E2E journey test med 21 kalenderdagers forlengelse.');

    // Submit
    await page.getByTestId('frist-submit').click();
    await expect(page.getByRole('dialog')).not.toBeVisible({ timeout: 10000 });

    // Verify FRIST status changed to "Sendt" in dashboard
    await expect(page.locator('h3:has-text("FRIST")').locator('..').getByText('Sendt')).toBeVisible({ timeout: 5000 });
  });
});
