/**
 * Felles API utilities
 *
 * Delt funksjonalitet for API-kall, spesielt for mock-støtte.
 */

import { apiFetch, USE_MOCK_API, mockDelay } from './client';

/**
 * Wrapper for API-kall med mock-støtte.
 *
 * Forenkler den repetitive mønstret:
 * ```
 * if (USE_MOCK_API) {
 *   await mockDelay(X);
 *   return mockFn();
 * }
 * return apiFetch<T>(endpoint, options);
 * ```
 *
 * @param mockFn - Funksjon som returnerer mock-data
 * @param realFn - Funksjon som gjør ekte API-kall
 * @param delay - Mock-forsinkelse i ms (default 300)
 */
export async function withMockSupport<T>(
  mockFn: () => T | Promise<T>,
  realFn: () => Promise<T>,
  delay: number = 300
): Promise<T> {
  if (USE_MOCK_API) {
    await mockDelay(delay);
    return mockFn();
  }
  return realFn();
}

/**
 * Forenklet GET-kall med mock-støtte.
 *
 * @param endpoint - API-endepunkt
 * @param mockFn - Funksjon som returnerer mock-data
 * @param delay - Mock-forsinkelse i ms
 */
export async function apiGet<T>(
  endpoint: string,
  mockFn: () => T | Promise<T>,
  delay: number = 300
): Promise<T> {
  return withMockSupport(
    mockFn,
    () => apiFetch<T>(endpoint),
    delay
  );
}

/**
 * Forenklet POST-kall med mock-støtte.
 *
 * @param endpoint - API-endepunkt
 * @param data - Data å sende i body
 * @param mockFn - Funksjon som returnerer mock-data
 * @param delay - Mock-forsinkelse i ms
 */
export async function apiPost<T, D = unknown>(
  endpoint: string,
  data: D,
  mockFn: () => T | Promise<T>,
  delay: number = 400
): Promise<T> {
  return withMockSupport(
    mockFn,
    () => apiFetch<T>(endpoint, {
      method: 'POST',
      body: JSON.stringify(data),
    }),
    delay
  );
}

/**
 * Forenklet PUT-kall med mock-støtte.
 *
 * @param endpoint - API-endepunkt
 * @param data - Data å sende i body
 * @param mockFn - Funksjon som returnerer mock-data
 * @param delay - Mock-forsinkelse i ms
 */
export async function apiPut<T, D = unknown>(
  endpoint: string,
  data: D,
  mockFn: () => T | Promise<T>,
  delay: number = 300
): Promise<T> {
  return withMockSupport(
    mockFn,
    () => apiFetch<T>(endpoint, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),
    delay
  );
}

/**
 * Forenklet DELETE-kall med mock-støtte.
 *
 * @param endpoint - API-endepunkt
 * @param mockFn - Funksjon som returnerer mock-data
 * @param delay - Mock-forsinkelse i ms
 */
export async function apiDelete<T>(
  endpoint: string,
  mockFn: () => T | Promise<T>,
  delay: number = 300
): Promise<T> {
  return withMockSupport(
    mockFn,
    () => apiFetch<T>(endpoint, { method: 'DELETE' }),
    delay
  );
}

// ============================================================================
// FELLES RESPONS-TYPER
// ============================================================================

/**
 * Basis suksess-respons
 */
export interface SuccessResponse {
  success: boolean;
  message?: string;
}

/**
 * Respons med relaterte saker
 */
export interface RelaterteSakerResponse<T> {
  success: boolean;
  sak_id: string;
  relaterte_saker: T[];
}

/**
 * Respons med kandidat-saker
 */
export interface KandidaterResponse<T> {
  success: boolean;
  kandidat_saker: T[];
}
