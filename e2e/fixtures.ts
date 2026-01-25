/**
 * E2E Test Fixtures
 *
 * Provides test setup utilities including:
 * - Backend API helpers
 * - Magic link generation
 * - Test case creation
 */

import { test as base, expect } from '@playwright/test';

const API_BASE_URL = process.env.API_BASE_URL || 'http://localhost:8080';

interface TestCase {
  sakId: string;
  token: string;
  url: string;
}

interface GrunnlagData {
  hovedkategori: string;
  underkategori: string[];
  tittel: string;
  beskrivelse: string;
  dato_oppdaget: string;
  grunnlag_varsel?: {
    dato_sendt: string;
    metode: string[];
  };
}

interface TestCaseWithGrunnlag extends TestCase {
  grunnlagData: GrunnlagData;
}

interface ApiHelpers {
  createTestCase: (sakId: string, title?: string) => Promise<TestCase>;
  createCaseWithGrunnlag: (sakId: string, title?: string, grunnlagOverrides?: Partial<GrunnlagData>) => Promise<TestCaseWithGrunnlag>;
  getCsrfToken: () => Promise<string>;
  submitEvent: (token: string, sakId: string, eventType: string, data: Record<string, unknown>, expectedVersion?: number) => Promise<unknown>;
}

/**
 * Generate a magic link token via backend
 */
async function generateMagicLink(sakId: string): Promise<string> {
  // Call backend script to generate token
  const response = await fetch(`${API_BASE_URL}/api/csrf-token`);
  if (!response.ok) {
    throw new Error('Backend not running - start with: cd backend && python app.py');
  }

  // Use Python to generate token (backend must be running)
  const { execSync } = await import('child_process');
  const result = execSync(
    `cd backend && source venv/bin/activate 2>/dev/null || true && python3 -c "
import sys
sys.path.insert(0, '.')
from lib.auth.magic_link import MagicLinkManager
mgr = MagicLinkManager()
token = mgr.generate(sak_id='${sakId}', ttl_hours=1)
print(token)
"`,
    { encoding: 'utf-8', cwd: process.cwd() }
  ).trim();

  return result;
}

/**
 * Extended test with API helpers
 */
export const test = base.extend<{ api: ApiHelpers }>({
  api: async ({}, use) => {
    const helpers: ApiHelpers = {
      /**
       * Create a test case with magic link
       */
      createTestCase: async (sakId: string, title?: string): Promise<TestCase> => {
        const token = await generateMagicLink(sakId);
        const csrf = await helpers.getCsrfToken();

        // Create case via API
        // Note: sak_opprettet has fields directly in event, not nested under 'data'
        const response = await fetch(`${API_BASE_URL}/api/events`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
            'X-CSRF-Token': csrf,
          },
          body: JSON.stringify({
            sak_id: sakId,
            expected_version: 0,
            event: {
              event_type: 'sak_opprettet',
              sakstittel: title || `Test-sak ${sakId}`,
              aktor: 'E2E Test',
              aktor_rolle: 'TE',
            },
          }),
        });

        if (!response.ok) {
          const error = await response.json();
          throw new Error(`Failed to create test case: ${JSON.stringify(error)}`);
        }

        return {
          sakId,
          token,
          url: `/?token=${token}`,
        };
      },

      /**
       * Create a test case with grunnlag already submitted
       * Useful for testing BH (Byggherre) response flows
       */
      createCaseWithGrunnlag: async (
        sakId: string,
        title?: string,
        grunnlagOverrides?: Partial<GrunnlagData>
      ): Promise<TestCaseWithGrunnlag> => {
        // First create the case
        const testCase = await helpers.createTestCase(sakId, title);

        // Default grunnlag data
        // Uses SCREAMING_SNAKE_CASE codes (synced frontend/backend): ENDRING + EO
        const today = new Date().toISOString().split('T')[0]!;
        const defaultGrunnlag: GrunnlagData = {
          hovedkategori: 'ENDRING',
          underkategori: ['EO'],
          tittel: `E2E Test Grunnlag - ${sakId}`,
          beskrivelse: 'Dette er et automatisk generert grunnlag for E2E-testing. Det inneholder tilstrekkelig beskrivelse for å passere validering.',
          dato_oppdaget: today,
          grunnlag_varsel: {
            dato_sendt: today,
            metode: ['digital_oversendelse'],
          },
        };

        const grunnlagData: GrunnlagData = {
          ...defaultGrunnlag,
          ...grunnlagOverrides,
        };

        // Submit grunnlag event
        const csrf = await helpers.getCsrfToken();
        const response = await fetch(`${API_BASE_URL}/api/events`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${testCase.token}`,
            'X-CSRF-Token': csrf,
          },
          body: JSON.stringify({
            sak_id: sakId,
            expected_version: 1,
            event: {
              event_type: 'grunnlag_opprettet',
              aktor: 'E2E Test',
              aktor_rolle: 'TE',
              data: grunnlagData,
            },
          }),
        });

        if (!response.ok) {
          const error = await response.json();
          throw new Error(`Failed to submit grunnlag: ${JSON.stringify(error)}`);
        }

        return {
          ...testCase,
          grunnlagData,
        };
      },

      /**
       * Get CSRF token from backend
       */
      getCsrfToken: async (): Promise<string> => {
        const response = await fetch(`${API_BASE_URL}/api/csrf-token`);
        const data = await response.json();
        return data.csrfToken;
      },

      /**
       * Submit an event via API
       */
      submitEvent: async (
        token: string,
        sakId: string,
        eventType: string,
        data: Record<string, unknown>,
        expectedVersion = 1
      ) => {
        const csrf = await helpers.getCsrfToken();

        const response = await fetch(`${API_BASE_URL}/api/events`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
            'X-CSRF-Token': csrf,
          },
          body: JSON.stringify({
            sak_id: sakId,
            expected_version: expectedVersion,
            event: {
              event_type: eventType,
              data,
            },
          }),
        });

        return response.json();
      },
    };

    await use(helpers);
  },
});

export { expect };
