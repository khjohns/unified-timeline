/**
 * E2E Tests: Grunnlag (Basis) Flow
 *
 * Tests the complete flow of:
 * 1. Opening app with magic link
 * 2. Viewing case state
 * 3. Submitting grunnlag event
 * 4. Verifying timeline and state updates
 */

import { test, expect } from './fixtures';

test.describe('Grunnlag Flow', () => {
  test.describe.configure({ mode: 'serial' });

  let testCase: { sakId: string; token: string; url: string };

  test.beforeAll(async ({ api }) => {
    // Create a unique test case for this test run
    const sakId = `e2e-grunnlag-${Date.now()}`;
    testCase = await api.createTestCase(sakId, 'E2E Test: Grunnlag');
  });

  test('should authenticate with magic link and show case', async ({ page }) => {
    // Navigate with token
    await page.goto(testCase.url);

    // Should redirect to case page
    await expect(page).toHaveURL(/\/saker\//);

    // Should show case title
    await expect(page.getByRole('heading', { name: /E2E Test: Grunnlag/i })).toBeVisible();

    // Should show sak ID (use first match to avoid strict mode error)
    await expect(page.getByText(new RegExp(testCase.sakId)).first()).toBeVisible();
  });

  test('should show "Varsle endringsforhold" button for TE role', async ({ page }) => {
    await page.goto(testCase.url);
    await expect(page).toHaveURL(/\/saker\//);

    // TE role should be default, should see Varsle endringsforhold button
    await expect(page.getByRole('button', { name: /varsle endringsforhold/i })).toBeVisible();
  });

  test('should open grunnlag modal and show form fields', async ({ page }) => {
    await page.goto(testCase.url);
    await expect(page).toHaveURL(/\/saker\//);

    // Click "Varsle endringsforhold" button
    await page.getByRole('button', { name: /varsle endringsforhold/i }).click();

    // Modal should open
    await expect(page.getByRole('dialog')).toBeVisible();
    await expect(page.getByRole('heading', { name: /varsle endringsforhold/i })).toBeVisible();

    // Form fields should be visible using data-testid
    await expect(page.getByTestId('grunnlag-hovedkategori')).toBeVisible();
    await expect(page.getByTestId('grunnlag-tittel')).toBeVisible();
    await expect(page.getByTestId('grunnlag-beskrivelse')).toBeVisible();
    await expect(page.getByTestId('grunnlag-dato-oppdaget')).toBeVisible();
    await expect(page.getByTestId('grunnlag-varsel-sendes-na')).toBeVisible();
    await expect(page.getByTestId('grunnlag-submit')).toBeVisible();

    // Close modal
    await page.keyboard.press('Escape');
  });

  test('should submit grunnlag and update timeline', async ({ page }) => {
    await page.goto(testCase.url);
    await expect(page).toHaveURL(/\/saker\//);

    // Click "Varsle endringsforhold" button
    await page.getByRole('button', { name: /varsle endringsforhold/i }).click();
    await expect(page.getByRole('dialog')).toBeVisible();

    // Fill out the form using data-testid selectors
    // Select hovedkategori - it's a radiogroup, not a dropdown
    await page.getByRole('radio', { name: /endring/i }).first().click();

    // Wait for underkategori list to appear and select one
    await expect(page.getByTestId('grunnlag-underkategori-list')).toBeVisible();
    await page.getByTestId('grunnlag-underkategori-list').getByRole('checkbox').first().click();

    // Fill tittel
    await page.getByTestId('grunnlag-tittel').fill('E2E Test Grunnlag');

    // Fill beskrivelse
    await page.getByTestId('grunnlag-beskrivelse').fill('Dette er en E2E-test av grunnlag-innsending. Beskrivelsen må være minst 10 tegn.');

    // Set dato oppdaget - click to open date picker
    // The DatePicker renders calendar in a Radix Portal outside the modal
    const datePickerButton = page.getByTestId('grunnlag-dato-oppdaget');
    await datePickerButton.click();

    // Wait for calendar to be visible - look for month/year header text
    await expect(page.getByText(/desember 2025|januar 2026/i)).toBeVisible({ timeout: 5000 });

    // Click today's date (8th in the screenshot) - find by the grid cell
    // Use aria-label or just click a visible day number
    const today = new Date().getDate().toString();
    const dayButton = page.locator(`button:has-text("${today}")`).first();
    await dayButton.click();

    // Check "varsel sendes nå"
    await page.getByTestId('grunnlag-varsel-sendes-na').click();

    // Submit the form
    await page.getByTestId('grunnlag-submit').click();

    // Wait for modal to close (indicates success)
    await expect(page.getByRole('dialog')).not.toBeVisible({ timeout: 10000 });

    // Verify timeline shows the new grunnlag event - timeline shows "Ansvarsgrunnlag" for grunnlag events
    // Use first() to handle multiple matches (dashboard + timeline)
    await expect(page.getByText('Ansvarsgrunnlag').first()).toBeVisible({ timeout: 5000 });
  });
});

test.describe('BH Response Flow', () => {
  test.describe.configure({ mode: 'serial' });

  let testCase: { sakId: string; token: string; url: string; grunnlagData: unknown };

  test.beforeAll(async ({ api }) => {
    // Create a case with grunnlag already submitted
    const sakId = `e2e-bh-response-${Date.now()}`;
    testCase = await api.createCaseWithGrunnlag(sakId, 'E2E Test: BH Response');
  });

  test('should show grunnlag in timeline after API submission', async ({ page }) => {
    await page.goto(testCase.url);
    await expect(page).toHaveURL(/\/saker\//);

    // Should show grunnlag event in timeline - timeline shows "Ansvarsgrunnlag" for grunnlag events
    // Use first() to handle multiple matches (dashboard + timeline)
    await expect(page.getByText('Ansvarsgrunnlag').first()).toBeVisible({ timeout: 10000 });
  });

  test('should show case status as "sendt" after grunnlag', async ({ page }) => {
    await page.goto(testCase.url);
    await expect(page).toHaveURL(/\/saker\//);

    // Status card should show "sendt" for grunnlag
    await expect(page.getByText(/sendt/i).first()).toBeVisible({ timeout: 10000 });
  });
});

test.describe('Authentication', () => {
  test('should show error for invalid token', async ({ page }) => {
    await page.goto('/?token=invalid-token-12345');

    // Should show error message (check for the actual error text from AuthLanding)
    await expect(page.getByRole('alert')).toBeVisible({ timeout: 5000 });
  });

  test('should show info page without token', async ({ page }) => {
    await page.goto('/');

    // Should show landing page
    await expect(page.getByText(/bruk lenken/i)).toBeVisible();
  });
});

test.describe('State Persistence', () => {
  test('should persist state across page reload', async ({ page, api }) => {
    // Create a new case
    const sakId = `e2e-persist-${Date.now()}`;
    const tc = await api.createTestCase(sakId, 'Persistence Test');

    // Navigate to case
    await page.goto(tc.url);
    await expect(page).toHaveURL(/\/saker\//);

    // Should show case title in timeline (sak_opprettet event shows the sakstittel)
    await expect(page.getByRole('heading', { name: /Persistence Test/i })).toBeVisible();

    // Reload page
    await page.reload();

    // State should persist - title should still be visible after reload
    await expect(page.getByRole('heading', { name: /Persistence Test/i })).toBeVisible();
  });
});
