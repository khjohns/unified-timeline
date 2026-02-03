/**
 * API Client
 *
 * Centralized HTTP client for backend communication.
 * Handles authentication, error handling, and request formatting.
 */

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8080';

// Auth token storage (set by AuthContext)
let authToken: string | null = null;

export function setAuthToken(token: string | null) {
  authToken = token;
}

export function getAuthToken(): string | null {
  return authToken;
}

// CSRF token storage and fetching
let csrfToken: string | null = null;
let csrfTokenPromise: Promise<string> | null = null;

async function fetchCsrfToken(): Promise<string> {
  const response = await fetch(`${API_BASE_URL}/api/csrf-token`);
  if (!response.ok) {
    throw new Error('Failed to fetch CSRF token');
  }
  const data = await response.json();
  return data.csrfToken;
}

async function getCsrfToken(forceRefresh: boolean = false): Promise<string> {
  if (csrfToken && !forceRefresh) {
    return csrfToken;
  }

  // Clear old token if forcing refresh
  if (forceRefresh) {
    csrfToken = null;
    csrfTokenPromise = null;
  }

  // Prevent multiple simultaneous fetches
  if (!csrfTokenPromise) {
    csrfTokenPromise = fetchCsrfToken().then(token => {
      csrfToken = token;
      csrfTokenPromise = null;
      return token;
    });
  }

  return csrfTokenPromise;
}

// Clear CSRF token (used on 403 errors to force refresh)
export function clearCsrfToken() {
  csrfToken = null;
  csrfTokenPromise = null;
}

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
    public data?: unknown
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

/**
 * HTTP status codes that indicate transient errors worth retrying.
 * - 408: Request Timeout
 * - 429: Too Many Requests (rate limited)
 * - 500: Internal Server Error
 * - 502: Bad Gateway
 * - 503: Service Unavailable
 * - 504: Gateway Timeout
 */
const RETRYABLE_STATUS_CODES = [408, 429, 500, 502, 503, 504];

/**
 * Check if an error is retryable (transient network/server issue).
 *
 * Used by React Query's retry function to decide whether to retry failed requests.
 * Returns true for:
 * - Network errors (status 0)
 * - Server errors (5xx)
 * - Rate limiting (429)
 * - Timeouts (408)
 *
 * Returns false for:
 * - Client errors (4xx except 408, 429)
 * - Auth errors (401, 403)
 * - Not found (404)
 * - Validation errors (400, 422)
 */
export function isRetryableError(error: unknown): boolean {
  // Network errors (fetch failed completely)
  if (error instanceof TypeError) {
    return true;
  }

  // ApiError with retryable status code
  if (error instanceof ApiError) {
    return RETRYABLE_STATUS_CODES.includes(error.status);
  }

  // Unknown errors - don't retry to be safe
  return false;
}

/**
 * Generic API fetch wrapper with error handling
 */
export async function apiFetch<T>(
  endpoint: string,
  options?: RequestInit
): Promise<T> {
  const url = `${API_BASE_URL}${endpoint}`;

  // Build headers with auth token if available
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  if (authToken) {
    headers['Authorization'] = `Bearer ${authToken}`;
  }

  // Add CSRF token for state-changing methods
  const method = options?.method?.toUpperCase() ?? 'GET';
  if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(method)) {
    const csrf = await getCsrfToken();
    headers['X-CSRF-Token'] = csrf;
  }

  try {
    const response = await fetch(url, {
      ...options,
      headers: {
        ...headers,
        ...options?.headers,
      },
    });

    // Parse response body
    const contentType = response.headers.get('content-type');
    let data: unknown;

    // Handle JSON responses (including CloudEvents format: application/cloudevents+json)
    if (contentType && (contentType.includes('application/json') || contentType.includes('+json'))) {
      data = await response.json();
    } else {
      data = await response.text();
    }

    // Handle error responses
    if (!response.ok) {
      // If 403 and it's a CSRF error, try once with a fresh token
      if (response.status === 403 && ['POST', 'PUT', 'PATCH', 'DELETE'].includes(method)) {
        const responseData = data as Record<string, unknown> | undefined;
        if (responseData?.error === 'CSRF validation failed') {
          // Clear cached token and retry once
          clearCsrfToken();
          const freshCsrf = await getCsrfToken(true);
          headers['X-CSRF-Token'] = freshCsrf;

          const retryResponse = await fetch(url, {
            ...options,
            headers: {
              ...headers,
              ...options?.headers,
            },
          });

          if (retryResponse.ok) {
            const retryContentType = retryResponse.headers.get('content-type');
            if (retryContentType && (retryContentType.includes('application/json') || retryContentType.includes('+json'))) {
              return await retryResponse.json() as T;
            }
            return await retryResponse.text() as unknown as T;
          }
        }
      }

      const errorMessage =
        typeof data === 'object' && data !== null && 'message' in data && typeof (data as Record<string, unknown>).message === 'string'
          ? (data as Record<string, unknown>).message as string
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
