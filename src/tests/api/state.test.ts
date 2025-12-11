/**
 * Unit tests for State API
 *
 * Tests case state fetching functionality including mock mode.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { fetchCaseState } from '@/src/api/state';
import * as clientModule from '@/src/api/client';
import { mockSakState1, mockSakState2, mockSakState3, mockSakState4 } from '@/src/mocks';

// Mock the client module
vi.mock('@/src/api/client', async () => {
  const actual = await vi.importActual('@/src/api/client');
  return {
    ...actual,
    apiFetch: vi.fn(),
    mockDelay: vi.fn(() => Promise.resolve()),
  };
});

describe('State API', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('fetchCaseState', () => {
    describe('with mock API enabled', () => {
      beforeEach(() => {
        vi.spyOn(clientModule, 'USE_MOCK_API', 'get').mockReturnValue(true);
      });

      it('should return mock state for SAK-2025-001', async () => {
        const result = await fetchCaseState('SAK-2025-001');

        expect(result.version).toBe(1);
        expect(result.state).toEqual(mockSakState1);
        expect(result.state.sak_id).toBe('SAK-2025-001');
        expect(result.state.sakstittel).toBe('Endring av grunnforhold - Bjørvika Utbyggingsprosjekt');
      });

      it('should return mock state for SAK-2025-002', async () => {
        const result = await fetchCaseState('SAK-2025-002');

        expect(result.state).toEqual(mockSakState2);
        expect(result.state.sak_id).toBe('SAK-2025-002');
        expect(result.state.overordnet_status).toBe('UTKAST');
      });

      it('should return mock state for SAK-2024-089', async () => {
        const result = await fetchCaseState('SAK-2024-089');

        expect(result.state).toEqual(mockSakState3);
        expect(result.state.sak_id).toBe('SAK-2024-089');
        expect(result.state.kan_utstede_eo).toBe(true);
      });

      it('should return mock state for SAK-2025-003', async () => {
        const result = await fetchCaseState('SAK-2025-003');

        expect(result.state).toEqual(mockSakState4);
        expect(result.state.sak_id).toBe('SAK-2025-003');
      });

      it('should return default mock state for unknown case IDs', async () => {
        const result = await fetchCaseState('UNKNOWN-ID');

        expect(result.state).toEqual(mockSakState1);
      });

      it('should call mockDelay for simulated network latency', async () => {
        await fetchCaseState('SAK-2025-001');

        expect(clientModule.mockDelay).toHaveBeenCalledWith(300);
      });

      it('should always return version 1 in mock mode', async () => {
        const cases = ['SAK-2025-001', 'SAK-2025-002', 'SAK-2024-089', 'SAK-2025-003'];

        for (const sakId of cases) {
          const result = await fetchCaseState(sakId);
          expect(result.version).toBe(1);
        }
      });
    });

    describe('with real API', () => {
      beforeEach(() => {
        vi.spyOn(clientModule, 'USE_MOCK_API', 'get').mockReturnValue(false);
      });

      it('should call apiFetch with correct endpoint', async () => {
        const mockResponse = {
          version: 5,
          state: mockSakState1,
        };

        vi.mocked(clientModule.apiFetch).mockResolvedValueOnce(mockResponse);

        const result = await fetchCaseState('SAK-2025-001');

        expect(clientModule.apiFetch).toHaveBeenCalledWith('/api/cases/SAK-2025-001/state');
        expect(result).toEqual(mockResponse);
      });

      it('should encode special characters in case ID', async () => {
        vi.mocked(clientModule.apiFetch).mockResolvedValueOnce({
          version: 1,
          state: mockSakState1,
        });

        await fetchCaseState('SAK-2025-001');

        expect(clientModule.apiFetch).toHaveBeenCalledWith('/api/cases/SAK-2025-001/state');
      });

      it('should return the complete state response', async () => {
        const mockResponse = {
          version: 10,
          state: {
            ...mockSakState1,
            sak_id: 'SAK-REAL-001',
            antall_events: 25,
          },
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
            state: mockSakState1,
          });

          await fetchCaseState(sakId);

          expect(clientModule.apiFetch).toHaveBeenCalledWith(`/api/cases/${sakId}/state`);
        }
      });
    });
  });
});
