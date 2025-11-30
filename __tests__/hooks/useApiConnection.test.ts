/**
 * Unit tests for useApiConnection hook
 *
 * Tests API health check functionality
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { useApiConnection } from '../../hooks/useApiConnection';
import { api } from '../../services/api';

// Mock the API module
vi.mock('../../services/api', () => ({
  api: {
    healthCheck: vi.fn(),
  },
}));

// Mock logger to avoid console spam
vi.mock('../../utils/logger', () => ({
  logger: {
    log: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

describe('useApiConnection', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should start with null (unknown) status', async () => {
    vi.mocked(api.healthCheck).mockResolvedValue(true);

    const { result, unmount } = renderHook(() => useApiConnection());

    expect(result.current.isApiConnected).toBeNull();

    // Wait for async effect to complete before unmounting
    await waitFor(() => {
      expect(result.current.isApiConnected).toBe(true);
    });

    unmount();
  });

  it('should set isApiConnected to true when health check succeeds', async () => {
    vi.mocked(api.healthCheck).mockResolvedValue(true);

    const { result } = renderHook(() => useApiConnection());

    // Wait for health check to complete
    await waitFor(() => {
      expect(result.current.isApiConnected).toBe(true);
    });

    expect(api.healthCheck).toHaveBeenCalledTimes(1);
  });

  it('should set isApiConnected to false when health check fails', async () => {
    vi.mocked(api.healthCheck).mockResolvedValue(false);

    const { result } = renderHook(() => useApiConnection());

    // Wait for health check to complete
    await waitFor(() => {
      expect(result.current.isApiConnected).toBe(false);
    });

    expect(api.healthCheck).toHaveBeenCalledTimes(1);
  });

  it('should set isApiConnected to false when health check throws error', async () => {
    vi.mocked(api.healthCheck).mockRejectedValue(new Error('Network error'));

    const { result } = renderHook(() => useApiConnection());

    // Wait for health check to complete
    await waitFor(() => {
      expect(result.current.isApiConnected).toBe(false);
    });

    expect(api.healthCheck).toHaveBeenCalledTimes(1);
  });

  it('should only check connection once on mount', async () => {
    vi.mocked(api.healthCheck).mockResolvedValue(true);

    const { result, rerender } = renderHook(() => useApiConnection());

    // Wait for initial check
    await waitFor(() => {
      expect(result.current.isApiConnected).toBe(true);
    });

    // Rerender should not trigger another check
    rerender();
    rerender();

    expect(api.healthCheck).toHaveBeenCalledTimes(1);
  });

  it('should handle slow health check gracefully', async () => {
    // Simulate slow API response
    vi.mocked(api.healthCheck).mockImplementation(
      () => new Promise((resolve) => setTimeout(() => resolve(true), 100))
    );

    const { result } = renderHook(() => useApiConnection());

    // Should be null initially
    expect(result.current.isApiConnected).toBeNull();

    // Wait for health check to complete
    await waitFor(() => {
      expect(result.current.isApiConnected).toBe(true);
    }, { timeout: 200 });
  });
});
