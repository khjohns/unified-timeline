/**
 * Unit tests for useUrlParams hook
 *
 * Tests URL parameter extraction and magic link tracking
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useUrlParams } from '../../hooks/useUrlParams';

// Mock react-router-dom
const mockSetSearchParams = vi.fn();
const getMockSearchParams = () => {
  const params = new URLSearchParams();
  // Make it work with the mock by storing a reference
  if (!(globalThis as any).__mockSearchParams__) {
    (globalThis as any).__mockSearchParams__ = params;
  }
  return (globalThis as any).__mockSearchParams__;
};

vi.mock('react-router-dom', () => ({
  useSearchParams: () => [getMockSearchParams(), mockSetSearchParams],
}));

describe('useUrlParams', () => {
  beforeEach(() => {
    // Clear all mocks and sessionStorage before each test
    vi.clearAllMocks();
    sessionStorage.clear();

    // Reset mockSearchParams by creating a new instance
    (globalThis as any).__mockSearchParams__ = new URLSearchParams();
  });

  describe('URL parameter extraction', () => {
    it('should extract magicToken from URL', () => {
      getMockSearchParams().set('magicToken', 'test-token-123');

      const { result } = renderHook(() => useUrlParams());

      expect(result.current.magicToken).toBe('test-token-123');
    });

    it('should extract sakId from URL', () => {
      getMockSearchParams().set('sakId', 'SAK-001');

      const { result } = renderHook(() => useUrlParams());

      expect(result.current.sakId).toBe('SAK-001');
    });

    it('should extract modus from URL', () => {
      getMockSearchParams().set('modus', 'varsel');

      const { result } = renderHook(() => useUrlParams());

      expect(result.current.modus).toBe('varsel');
    });

    it('should extract topicGuid from URL', () => {
      getMockSearchParams().set('topicGuid', 'TOPIC-GUID-123');

      const { result } = renderHook(() => useUrlParams());

      expect(result.current.topicGuid).toBe('TOPIC-GUID-123');
    });

    it('should return null for missing parameters', () => {
      const { result } = renderHook(() => useUrlParams());

      expect(result.current.magicToken).toBeNull();
      expect(result.current.sakId).toBeNull();
      expect(result.current.modus).toBeNull();
      expect(result.current.topicGuid).toBeNull();
    });

    it('should extract all parameters together', () => {
      getMockSearchParams().set('magicToken', 'test-token');
      getMockSearchParams().set('sakId', 'SAK-001');
      getMockSearchParams().set('modus', 'koe');
      getMockSearchParams().set('topicGuid', 'TOPIC-123');

      const { result } = renderHook(() => useUrlParams());

      expect(result.current.magicToken).toBe('test-token');
      expect(result.current.sakId).toBe('SAK-001');
      expect(result.current.modus).toBe('koe');
      expect(result.current.topicGuid).toBe('TOPIC-123');
    });
  });

  describe('Magic link tracking', () => {
    it('should set isFromMagicLink to true when magicToken is present', () => {
      getMockSearchParams().set('magicToken', 'test-token');

      const { result } = renderHook(() => useUrlParams());

      expect(result.current.isFromMagicLink).toBe(true);
    });

    it('should store magicToken usage in sessionStorage', () => {
      getMockSearchParams().set('magicToken', 'test-token');

      renderHook(() => useUrlParams());

      expect(sessionStorage.getItem('isFromMagicLink')).toBe('true');
    });

    it('should persist isFromMagicLink when sessionStorage is "true"', () => {
      sessionStorage.setItem('isFromMagicLink', 'true');

      const { result } = renderHook(() => useUrlParams());

      expect(result.current.isFromMagicLink).toBe(true);
    });

    it('should persist isFromMagicLink when sessionStorage is "consumed"', () => {
      sessionStorage.setItem('isFromMagicLink', 'consumed');

      const { result } = renderHook(() => useUrlParams());

      expect(result.current.isFromMagicLink).toBe(true);
    });

    it('should not overwrite sessionStorage if already set to "consumed"', () => {
      sessionStorage.setItem('isFromMagicLink', 'consumed');
      getMockSearchParams().set('magicToken', 'test-token');

      renderHook(() => useUrlParams());

      expect(sessionStorage.getItem('isFromMagicLink')).toBe('consumed');
    });

    it('should not overwrite sessionStorage if already set to "true"', () => {
      sessionStorage.setItem('isFromMagicLink', 'true');
      getMockSearchParams().set('magicToken', 'test-token');

      renderHook(() => useUrlParams());

      expect(sessionStorage.getItem('isFromMagicLink')).toBe('true');
    });

    it('should return false for isFromMagicLink when no token and no session', () => {
      const { result } = renderHook(() => useUrlParams());

      expect(result.current.isFromMagicLink).toBe(false);
    });
  });

  describe('clearMagicToken', () => {
    it('should remove magicToken from URL parameters', () => {
      getMockSearchParams().set('magicToken', 'test-token');
      getMockSearchParams().set('sakId', 'SAK-001');

      const { result } = renderHook(() => useUrlParams());
      result.current.clearMagicToken();

      expect(mockSetSearchParams).toHaveBeenCalledWith(
        expect.any(URLSearchParams),
        { replace: true }
      );

      // Verify magicToken was deleted but other params remain
      const callArgs = mockSetSearchParams.mock.calls[0][0];
      expect(callArgs.get('magicToken')).toBeNull();
      expect(callArgs.get('sakId')).toBe('SAK-001');
    });

    it('should mark token as consumed in sessionStorage', () => {
      getMockSearchParams().set('magicToken', 'test-token');

      const { result } = renderHook(() => useUrlParams());
      result.current.clearMagicToken();

      expect(sessionStorage.getItem('isFromMagicLink')).toBe('consumed');
    });

    it('should use replace mode to avoid adding history entry', () => {
      getMockSearchParams().set('magicToken', 'test-token');

      const { result } = renderHook(() => useUrlParams());
      result.current.clearMagicToken();

      expect(mockSetSearchParams).toHaveBeenCalledWith(
        expect.any(URLSearchParams),
        { replace: true }
      );
    });
  });

  describe('HMR (Hot Module Replacement) resilience', () => {
    it('should survive HMR reload when sessionStorage is set', () => {
      // Simulate first load with magic token
      sessionStorage.setItem('isFromMagicLink', 'true');
      sessionStorage.setItem('currentSakId', 'SAK-001');

      // Simulate HMR reload (no token in URL anymore)
      const { result } = renderHook(() => useUrlParams());

      expect(result.current.isFromMagicLink).toBe(true);
      expect(result.current.magicToken).toBeNull(); // Token cleared from URL
    });

    it('should survive HMR reload after token consumption', () => {
      sessionStorage.setItem('isFromMagicLink', 'consumed');

      const { result } = renderHook(() => useUrlParams());

      expect(result.current.isFromMagicLink).toBe(true);
    });
  });
});
