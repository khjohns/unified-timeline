/**
 * Integration tests for useCaseLoader hook
 *
 * Tests the complex data loading and authentication flow
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { useCaseLoader } from '../../hooks/useCaseLoader';
import { api } from '../../services/api';
import { INITIAL_FORM_DATA } from '../../constants';

// Mock dependencies
vi.mock('../../services/api', () => ({
  api: {
    verifyMagicToken: vi.fn(),
    getCase: vi.fn(),
  },
}));

vi.mock('../../utils/logger', () => ({
  logger: {
    log: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

vi.mock('../../utils/toastHelpers', () => ({
  showToast: vi.fn(),
}));

const mockSetSearchParams = vi.fn();
const getMockSearchParams = () => {
  if (!(globalThis as any).__mockSearchParams__) {
    (globalThis as any).__mockSearchParams__ = new URLSearchParams();
  }
  return (globalThis as any).__mockSearchParams__;
};

vi.mock('react-router-dom', () => ({
  useSearchParams: () => [getMockSearchParams(), mockSetSearchParams],
}));

describe('useCaseLoader', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    sessionStorage.clear();
    localStorage.clear();
    (globalThis as any).__mockSearchParams__ = new URLSearchParams();
  });

  describe('Magic token flow', () => {
    it('should verify magic token and load case data', async () => {
      // Mock API responses
      vi.mocked(api.verifyMagicToken).mockResolvedValue({
        success: true,
        data: { sakId: 'SAK-001' },
      });

      vi.mocked(api.getCase).mockResolvedValue({
        success: true,
        data: {
          sakId: 'SAK-001',
          formData: {
            ...INITIAL_FORM_DATA,
            sak: { ...INITIAL_FORM_DATA.sak, saksnummer: 'SAK-001' },
            rolle: 'TE',
          },
          topicGuid: 'TOPIC-001',
        } as any,
      });

      const clearMagicToken = vi.fn();
      const setToastMessage = vi.fn();

      const { result } = renderHook(() =>
        useCaseLoader({
          magicToken: 'test-token',
          sakId: null,
          modus: 'varsel',
          topicGuid: null,
          isFromMagicLink: true,
          isApiConnected: true,
          clearMagicToken,
          loadedData: null,
          setToastMessage,
        })
      );

      // Initially loading
      expect(result.current.isLoading).toBe(true);

      // Wait for token verification and data loading
      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      }, { timeout: 1000 });

      // Verify API calls
      expect(api.verifyMagicToken).toHaveBeenCalledWith('test-token');
      expect(api.getCase).toHaveBeenCalledWith('SAK-001', 'varsel');
      expect(clearMagicToken).toHaveBeenCalled();

      // Verify data loaded
      expect(result.current.internalSakId).toBe('SAK-001');
      expect(result.current.formData.sak.saksnummer).toBe('SAK-001');
      expect(result.current.topicGuid).toBe('TOPIC-001');
      expect(result.current.apiError).toBeNull();
    });

    it('should handle magic token verification failure', async () => {
      vi.mocked(api.verifyMagicToken).mockResolvedValue({
        success: false,
        error: 'Invalid token',
      });

      const setToastMessage = vi.fn();

      const { result } = renderHook(() =>
        useCaseLoader({
          magicToken: 'invalid-token',
          sakId: null,
          modus: null,
          topicGuid: null,
          isFromMagicLink: true,
          isApiConnected: true,
          clearMagicToken: vi.fn(),
          loadedData: null,
          setToastMessage,
        })
      );

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.apiError).toBe('Invalid token');
      expect(result.current.internalSakId).toBeNull();
    });

    it('should clear localStorage when using magic link', async () => {
      // Set localStorage
      localStorage.setItem('koe_v5_0_draft', JSON.stringify(INITIAL_FORM_DATA));

      vi.mocked(api.verifyMagicToken).mockResolvedValue({
        success: true,
        data: { sakId: 'SAK-001' },
      });

      vi.mocked(api.getCase).mockResolvedValue({
        success: true,
        data: {
          formData: INITIAL_FORM_DATA,
          topicGuid: null,
        } as any,
      });

      renderHook(() =>
        useCaseLoader({
          magicToken: 'test-token',
          sakId: null,
          modus: null,
          topicGuid: null,
          isFromMagicLink: true,
          isApiConnected: true,
          clearMagicToken: vi.fn(),
          loadedData: null,
          setToastMessage: vi.fn(),
        })
      );

      // Wait for async operations
      await waitFor(() => {
        expect(localStorage.getItem('koe_v5_0_draft')).toBeNull();
      });
    });
  });

  describe('Direct sakId flow', () => {
    it('should load case data when sakId is provided directly', async () => {
      vi.mocked(api.getCase).mockResolvedValue({
        success: true,
        data: {
          sakId: 'SAK-002',
          formData: {
            ...INITIAL_FORM_DATA,
            rolle: 'TE',
          },
          topicGuid: 'TOPIC-002',
        } as any,
      });

      const { result } = renderHook(() =>
        useCaseLoader({
          magicToken: null,
          sakId: 'SAK-002',
          modus: 'koe',
          topicGuid: null,
          isFromMagicLink: false,
          isApiConnected: true,
          clearMagicToken: vi.fn(),
          loadedData: null,
          setToastMessage: vi.fn(),
        })
      );

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(api.getCase).toHaveBeenCalledWith('SAK-002', 'koe');
      expect(result.current.internalSakId).toBe('SAK-002');
      expect(result.current.topicGuid).toBe('TOPIC-002');
    });
  });

  describe('Role and tab management', () => {
    it('should set role to TE for varsel modus', async () => {
      vi.mocked(api.getCase).mockResolvedValue({
        success: true,
        data: {
          formData: { ...INITIAL_FORM_DATA, rolle: 'TE' },
        } as any,
      });

      const { result } = renderHook(() =>
        useCaseLoader({
          magicToken: null,
          sakId: 'SAK-001',
          modus: 'varsel',
          topicGuid: null,
          isFromMagicLink: false,
          isApiConnected: true,
          clearMagicToken: vi.fn(),
          loadedData: null,
          setToastMessage: vi.fn(),
        })
      );

      await waitFor(() => {
        expect(result.current.formData.rolle).toBe('TE');
      });

      expect(result.current.activeTab).toBe(0); // Varsel tab
    });

    it('should set role to BH for svar modus', async () => {
      vi.mocked(api.getCase).mockResolvedValue({
        success: true,
        data: {
          formData: { ...INITIAL_FORM_DATA, rolle: 'BH' },
        } as any,
      });

      const { result } = renderHook(() =>
        useCaseLoader({
          magicToken: null,
          sakId: 'SAK-001',
          modus: 'svar',
          topicGuid: null,
          isFromMagicLink: false,
          isApiConnected: true,
          clearMagicToken: vi.fn(),
          loadedData: null,
          setToastMessage: vi.fn(),
        })
      );

      await waitFor(() => {
        expect(result.current.formData.rolle).toBe('BH');
      });

      expect(result.current.activeTab).toBe(2); // Svar tab
    });

    it('should set tab to 1 for koe modus', async () => {
      vi.mocked(api.getCase).mockResolvedValue({
        success: true,
        data: {
          formData: { ...INITIAL_FORM_DATA, rolle: 'TE' },
        } as any,
      });

      const { result } = renderHook(() =>
        useCaseLoader({
          magicToken: null,
          sakId: 'SAK-001',
          modus: 'koe',
          topicGuid: null,
          isFromMagicLink: false,
          isApiConnected: true,
          clearMagicToken: vi.fn(),
          loadedData: null,
          setToastMessage: vi.fn(),
        })
      );

      await waitFor(() => {
        expect(result.current.activeTab).toBe(1);
      });
    });
  });

  describe('LocalStorage fallback', () => {
    it('should use loadedData when API fails and not from magic link', async () => {
      vi.mocked(api.getCase).mockResolvedValue({
        success: false,
        error: 'API error',
      });

      const loadedFromStorage = {
        ...INITIAL_FORM_DATA,
        sak: { ...INITIAL_FORM_DATA.sak, saksnummer: 'DRAFT-001' },
      };

      const { result } = renderHook(() =>
        useCaseLoader({
          magicToken: null,
          sakId: 'SAK-001',
          modus: 'koe',
          topicGuid: null,
          isFromMagicLink: false,
          isApiConnected: true,
          clearMagicToken: vi.fn(),
          loadedData: loadedFromStorage,
          setToastMessage: vi.fn(),
        })
      );

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.formData.sak.saksnummer).toBe('DRAFT-001');
      expect(result.current.apiError).toBe('API error');
    });

    it('should NOT use loadedData when coming from magic link', async () => {
      vi.mocked(api.getCase).mockResolvedValue({
        success: false,
        error: 'API error',
      });

      vi.mocked(api.verifyMagicToken).mockResolvedValue({
        success: true,
        data: { sakId: 'SAK-001' },
      });

      const loadedFromStorage = {
        ...INITIAL_FORM_DATA,
        sak: { ...INITIAL_FORM_DATA.sak, saksnummer: 'DRAFT-001' },
      };

      const clearMagicToken = vi.fn();
      const setToastMessage = vi.fn();

      const { result } = renderHook(() =>
        useCaseLoader({
          magicToken: 'test-token',
          sakId: null,
          modus: null,
          topicGuid: null,
          isFromMagicLink: true,
          isApiConnected: true,
          clearMagicToken,
          loadedData: loadedFromStorage,
          setToastMessage,
        })
      );

      // Wait for loading to complete (both magic token verification and API call)
      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      // Verify both API calls were made
      expect(api.verifyMagicToken).toHaveBeenCalledWith('test-token');
      expect(api.getCase).toHaveBeenCalledWith('SAK-001', undefined);

      // Should NOT use localStorage data when coming from magic link
      expect(result.current.formData.sak.saksnummer).not.toBe('DRAFT-001');
      expect(result.current.apiError).toBe('API error');
    });
  });
});
