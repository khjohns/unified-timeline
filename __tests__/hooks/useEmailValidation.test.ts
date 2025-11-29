/**
 * Unit tests for useEmailValidation hook
 *
 * Tests email validation against Catenda API
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { useEmailValidation } from '../../hooks/useEmailValidation';
import { api } from '../../services/api';

// Mock the API module
vi.mock('../../services/api', () => ({
  api: {
    validateUser: vi.fn(),
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

describe('useEmailValidation', () => {
  const mockSetToastMessage = vi.fn();
  const mockOnValidated = vi.fn();

  const defaultOptions = {
    sakId: 'test-123',
    onValidated: mockOnValidated,
    setToastMessage: mockSetToastMessage,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should initialize with empty state', () => {
    const { result } = renderHook(() => useEmailValidation(defaultOptions));

    expect(result.current.signerEmail).toBe('');
    expect(result.current.signerName).toBe('');
    expect(result.current.isValidating).toBe(false);
    expect(result.current.validationError).toBe('');
  });

  it('should initialize with initialName when provided', () => {
    const { result } = renderHook(() =>
      useEmailValidation({
        ...defaultOptions,
        initialName: 'Initial User',
      })
    );

    expect(result.current.signerName).toBe('Initial User');
  });

  it('should update signerEmail on handleEmailChange', () => {
    const { result } = renderHook(() => useEmailValidation(defaultOptions));

    act(() => {
      result.current.handleEmailChange({
        target: { value: 'test@example.com' },
      } as React.ChangeEvent<HTMLInputElement>);
    });

    expect(result.current.signerEmail).toBe('test@example.com');
  });

  it('should not trigger validation for email without @', async () => {
    const { result } = renderHook(() => useEmailValidation(defaultOptions));

    act(() => {
      result.current.handleEmailChange({
        target: { value: 'testexample' },
      } as React.ChangeEvent<HTMLInputElement>);
    });

    // Advance timers past debounce
    act(() => {
      vi.advanceTimersByTime(1000);
    });

    expect(api.validateUser).not.toHaveBeenCalled();
  });

  it('should validate email after debounce', async () => {
    // Use real timers for this test since fake timers don't work well with async
    vi.useRealTimers();

    vi.mocked(api.validateUser).mockResolvedValue({
      success: true,
      data: { name: 'Test User', email: 'test@example.com', company: 'Test Co' },
    });

    const { result } = renderHook(() => useEmailValidation(defaultOptions));

    act(() => {
      result.current.handleEmailChange({
        target: { value: 'test@example.com' },
      } as React.ChangeEvent<HTMLInputElement>);
    });

    // Should not validate immediately
    expect(api.validateUser).not.toHaveBeenCalled();

    // Wait for debounce and validation to complete
    await waitFor(() => {
      expect(api.validateUser).toHaveBeenCalledWith('test-123', 'test@example.com');
    }, { timeout: 2000 });

    await waitFor(() => {
      expect(result.current.signerName).toBe('Test User');
    });

    expect(mockOnValidated).toHaveBeenCalledWith('Test User');
    expect(result.current.validationError).toBe('');

    vi.useFakeTimers();
  });

  it('should show error for invalid user', async () => {
    // Use real timers for this test
    vi.useRealTimers();

    vi.mocked(api.validateUser).mockResolvedValue({
      success: false,
      error: 'User not found',
    });

    const { result } = renderHook(() => useEmailValidation(defaultOptions));

    act(() => {
      result.current.handleEmailChange({
        target: { value: 'invalid@example.com' },
      } as React.ChangeEvent<HTMLInputElement>);
    });

    await waitFor(() => {
      expect(result.current.validationError).toBe('User not found');
    }, { timeout: 2000 });

    expect(result.current.signerName).toBe('');
    expect(mockOnValidated).not.toHaveBeenCalled();

    vi.useFakeTimers();
  });

  it('should handle API error gracefully', async () => {
    // Use real timers for this test
    vi.useRealTimers();

    vi.mocked(api.validateUser).mockRejectedValue(new Error('Network error'));

    const { result } = renderHook(() => useEmailValidation(defaultOptions));

    act(() => {
      result.current.handleEmailChange({
        target: { value: 'test@example.com' },
      } as React.ChangeEvent<HTMLInputElement>);
    });

    await waitFor(() => {
      expect(result.current.validationError).toBe('Feil ved validering');
    }, { timeout: 2000 });

    expect(result.current.signerName).toBe('');

    vi.useFakeTimers();
  });

  it('should show toast message on successful validation', async () => {
    // Use real timers for this test
    vi.useRealTimers();

    vi.mocked(api.validateUser).mockResolvedValue({
      success: true,
      data: { name: 'Test User', email: 'test@example.com', company: 'Test Co' },
    });

    const { result } = renderHook(() => useEmailValidation(defaultOptions));

    act(() => {
      result.current.handleEmailChange({
        target: { value: 'test@example.com' },
      } as React.ChangeEvent<HTMLInputElement>);
    });

    await waitFor(() => {
      expect(mockSetToastMessage).toHaveBeenCalledWith('Bruker validert: Test User');
    }, { timeout: 2000 });

    vi.useFakeTimers();
  });

  it('should debounce multiple rapid changes', async () => {
    // Use real timers for this test
    vi.useRealTimers();

    vi.mocked(api.validateUser).mockResolvedValue({
      success: true,
      data: { name: 'Final User', email: 'final@example.com', company: 'Test Co' },
    });

    const { result } = renderHook(() => useEmailValidation(defaultOptions));

    // Rapid changes with small delays between them
    act(() => {
      result.current.handleEmailChange({
        target: { value: 'test@' },
      } as React.ChangeEvent<HTMLInputElement>);
    });

    // Small delay between changes (less than debounce time)
    await new Promise(resolve => setTimeout(resolve, 200));

    act(() => {
      result.current.handleEmailChange({
        target: { value: 'test@ex' },
      } as React.ChangeEvent<HTMLInputElement>);
    });

    await new Promise(resolve => setTimeout(resolve, 200));

    act(() => {
      result.current.handleEmailChange({
        target: { value: 'final@example.com' },
      } as React.ChangeEvent<HTMLInputElement>);
    });

    // Wait for debounce and validation
    await waitFor(() => {
      expect(api.validateUser).toHaveBeenCalledTimes(1);
    }, { timeout: 2000 });

    expect(api.validateUser).toHaveBeenCalledWith('test-123', 'final@example.com');

    vi.useFakeTimers();
  });

  it('should reset validation state', () => {
    const { result } = renderHook(() =>
      useEmailValidation({
        ...defaultOptions,
        initialName: 'Initial User',
      })
    );

    // Set some state
    act(() => {
      result.current.handleEmailChange({
        target: { value: 'test@example.com' },
      } as React.ChangeEvent<HTMLInputElement>);
    });

    // Reset
    act(() => {
      result.current.resetValidation();
    });

    expect(result.current.signerEmail).toBe('');
    expect(result.current.signerName).toBe('');
    expect(result.current.validationError).toBe('');
  });

  it('should clear validation state when email becomes incomplete', () => {
    vi.mocked(api.validateUser).mockResolvedValue({
      success: true,
      data: { name: 'Test User', email: 'test@example.com', company: 'Test Co' },
    });

    const { result } = renderHook(() => useEmailValidation(defaultOptions));

    // Start with valid email
    act(() => {
      result.current.handleEmailChange({
        target: { value: 'test@example.com' },
      } as React.ChangeEvent<HTMLInputElement>);
    });

    // Clear to incomplete email
    act(() => {
      result.current.handleEmailChange({
        target: { value: 'test' },
      } as React.ChangeEvent<HTMLInputElement>);
    });

    expect(result.current.signerName).toBe('');
    expect(result.current.validationError).toBe('');
  });

  it('should handle validation via handleEmailValidation directly', async () => {
    vi.mocked(api.validateUser).mockResolvedValue({
      success: true,
      data: { name: 'Direct User', email: 'direct@example.com', company: 'Test Co' },
    });

    const { result } = renderHook(() => useEmailValidation(defaultOptions));

    await act(async () => {
      await result.current.handleEmailValidation('direct@example.com');
    });

    expect(result.current.signerName).toBe('Direct User');
    expect(mockOnValidated).toHaveBeenCalledWith('Direct User');
  });

  it('should set isValidating during validation', async () => {
    vi.mocked(api.validateUser).mockImplementation(
      () => new Promise((resolve) => setTimeout(() => resolve({
        success: true,
        data: { name: 'Test User', email: 'test@example.com', company: 'Test Co' },
      }), 100))
    );

    const { result } = renderHook(() => useEmailValidation(defaultOptions));

    // Start validation directly (not through debounce)
    let validationPromise: Promise<void>;
    act(() => {
      validationPromise = result.current.handleEmailValidation('test@example.com');
    });

    // Should be validating
    expect(result.current.isValidating).toBe(true);

    // Wait for validation to complete
    await act(async () => {
      vi.advanceTimersByTime(100);
      await validationPromise;
    });

    expect(result.current.isValidating).toBe(false);
  });
});
