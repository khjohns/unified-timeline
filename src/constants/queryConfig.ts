/**
 * Centralized React Query Configuration
 *
 * Provides consistent cache and retry settings across all queries.
 * This eliminates magic numbers and ensures consistent behavior.
 */

/**
 * Stale time constants in milliseconds.
 * Data is considered "fresh" for this duration before refetching.
 */
export const STALE_TIME = {
  /** Default stale time for most queries (30 seconds) */
  DEFAULT: 30_000,
  /** Extended stale time for less frequently changing data (60 seconds) */
  EXTENDED: 60_000,
  /** Short stale time for frequently changing data (10 seconds) */
  SHORT: 10_000,
} as const;

/**
 * Retry configuration constants.
 */
export const RETRY_CONFIG = {
  /** Maximum retry attempts for queries */
  MAX_QUERY_RETRIES: 3,
  /** Maximum retry attempts for mutations (lower to avoid duplicate state changes) */
  MAX_MUTATION_RETRIES: 1,
  /** Base delay in ms for exponential backoff */
  BACKOFF_BASE_MS: 1000,
  /** Maximum delay in ms for exponential backoff */
  BACKOFF_MAX_MS: 30_000,
} as const;

/**
 * Calculate retry delay using exponential backoff with jitter.
 *
 * Formula: min(baseMs * 2^attempt + jitter, maxMs)
 *
 * Examples:
 * - Attempt 0: ~1000ms (1s)
 * - Attempt 1: ~2000ms (2s)
 * - Attempt 2: ~4000ms (4s)
 * - Attempt 3+: capped at 30s
 */
export function calculateRetryDelay(attemptIndex: number): number {
  const { BACKOFF_BASE_MS, BACKOFF_MAX_MS } = RETRY_CONFIG;
  const exponentialDelay = BACKOFF_BASE_MS * Math.pow(2, attemptIndex);
  // Add jitter (±25%) to prevent thundering herd
  const jitter = exponentialDelay * 0.25 * (Math.random() * 2 - 1);
  return Math.min(exponentialDelay + jitter, BACKOFF_MAX_MS);
}

/**
 * Default query options that can be spread into useQuery calls.
 */
export const defaultQueryOptions = {
  staleTime: STALE_TIME.DEFAULT,
  refetchOnWindowFocus: false,
  retry: RETRY_CONFIG.MAX_QUERY_RETRIES,
} as const;

/**
 * Extended query options for relational queries (forsering, endringsordre).
 * These queries fetch related data that changes less frequently.
 */
export const extendedQueryOptions = {
  ...defaultQueryOptions,
  staleTime: STALE_TIME.EXTENDED,
} as const;
