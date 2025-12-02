/**
 * API Client
 *
 * Centralized HTTP client for backend communication.
 * Handles authentication, error handling, and request formatting.
 *
 * Mock Mode:
 * Set VITE_USE_MOCK_API=true to use mock data instead of real API.
 * Useful for development, testing, and GitHub Pages preview.
 */

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000';

// Check if we should use mock API
export const USE_MOCK_API = import.meta.env.VITE_USE_MOCK_API === 'true';

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
    public data?: any
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

/**
 * Simulate network delay for mock API calls
 */
export function mockDelay(ms: number = 500): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Generic API fetch wrapper with error handling
 */
export async function apiFetch<T>(
  endpoint: string,
  options?: RequestInit
): Promise<T> {
  const url = `${API_BASE_URL}${endpoint}`;

  try {
    const response = await fetch(url, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...options?.headers,
      },
    });

    // Parse response body
    const contentType = response.headers.get('content-type');
    let data: any;

    if (contentType && contentType.includes('application/json')) {
      data = await response.json();
    } else {
      data = await response.text();
    }

    // Handle error responses
    if (!response.ok) {
      const errorMessage =
        typeof data === 'object' && data.message
          ? data.message
          : typeof data === 'string'
          ? data
          : `HTTP ${response.status}: ${response.statusText}`;

      throw new ApiError(response.status, errorMessage, data);
    }

    return data as T;
  } catch (error) {
    // Re-throw ApiError as-is
    if (error instanceof ApiError) {
      throw error;
    }

    // Network errors or other issues
    if (error instanceof TypeError) {
      throw new ApiError(0, 'Network error: Could not connect to server');
    }

    // Unknown errors
    throw new ApiError(500, error instanceof Error ? error.message : 'Unknown error');
  }
}
