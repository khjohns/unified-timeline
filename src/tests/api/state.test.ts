/**
 * Unit tests for State API
 *
 * Tests case state fetching functionality.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { fetchCaseState } from '@/api/state';
import * as clientModule from '@/api/client';
import type { SakState } from '@/types/timeline';

// Mock the client module
vi.mock('@/api/client', async () => {
  const actual = await vi.importActual('@/api/client');
  return {
    ...actual,
    apiFetch: vi.fn(),
  };
});

// Inline mock state for tests
const createMockSakState = (overrides: Partial<SakState> = {}): SakState => ({
  sak_id: 'SAK-2025-001',
  sakstittel: 'Test sak',
  prosjekt_navn: 'Testprosjekt',
  entreprenor: 'Test Entreprenør AS',
  byggherre: 'Test Byggherre',
  sakstype: 'standard',
  grunnlag: {
    status: 'sendt',
    hovedkategori: 'ENDRING',
    underkategori: 'PROSJEKTERING',
    beskrivelse: 'Test beskrivelse',
    kontraktsreferanser: [],
    laast: false,
    antall_versjoner: 1,
  },
  vederlag: {
    status: 'ikke_relevant',
    antall_versjoner: 0,
  },
  frist: {
    status: 'ikke_relevant',
    antall_versjoner: 0,
  },
  er_subsidiaert_vederlag: false,
  er_subsidiaert_frist: false,
  visningsstatus_vederlag: '',
  visningsstatus_frist: '',
  overordnet_status: 'UNDER_BEHANDLING',
  kan_utstede_eo: false,
  neste_handling: {
    rolle: 'BH',
    handling: 'Venter på respons',
    spor: 'grunnlag',
  },
  sum_krevd: 0,
  sum_godkjent: 0,
  opprettet: '2025-01-01T10:00:00Z',
  siste_aktivitet: '2025-01-01T10:00:00Z',
  antall_events: 1,
  ...overrides,
});

describe('State API', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('fetchCaseState', () => {
    it('should call apiFetch with correct endpoint', async () => {
      const mockState = createMockSakState();
      const mockResponse = {
        version: 5,
        state: mockState,
      };

      vi.mocked(clientModule.apiFetch).mockResolvedValueOnce(mockResponse);

      const result = await fetchCaseState('SAK-2025-001');

      expect(clientModule.apiFetch).toHaveBeenCalledWith('/api/cases/SAK-2025-001/state');
      expect(result).toEqual(mockResponse);
    });

    it('should return the complete state response', async () => {
      const mockState = createMockSakState({
        sak_id: 'SAK-REAL-001',
        antall_events: 25,
      });
      const mockResponse = {
        version: 10,
        state: mockState,
      };

      vi.mocked(clientModule.apiFetch).mockResolvedValueOnce(mockResponse);

      const result = await fetchCaseState('SAK-REAL-001');

      expect(result.version).toBe(10);
      expect(result.state.sak_id).toBe('SAK-REAL-001');
      expect(result.state.antall_events).toBe(25);
    });

    it('should propagate API errors', async () => {
      const apiError = new clientModule.ApiError(404, 'Case not found');
      vi.mocked(clientModule.apiFetch).mockRejectedValueOnce(apiError);

      await expect(fetchCaseState('NON-EXISTENT')).rejects.toThrow('Case not found');
    });

    it('should propagate network errors', async () => {
      const networkError = new clientModule.ApiError(0, 'Network error: Could not connect to server');
      vi.mocked(clientModule.apiFetch).mockRejectedValueOnce(networkError);

      await expect(fetchCaseState('SAK-001')).rejects.toThrow('Network error');
    });

    it('should handle different case ID formats', async () => {
      const mockState = createMockSakState();
      const caseIds = [
        'SAK-2025-001',
        'SAK-2024-089',
        '123',
        'test-case',
        'CASE_WITH_UNDERSCORE',
      ];

      for (const sakId of caseIds) {
        vi.mocked(clientModule.apiFetch).mockResolvedValueOnce({
          version: 1,
          state: mockState,
        });

        await fetchCaseState(sakId);

        expect(clientModule.apiFetch).toHaveBeenCalledWith(`/api/cases/${sakId}/state`);
      }
    });
  });
});
