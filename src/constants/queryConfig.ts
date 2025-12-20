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
 * Default query options that can be spread into useQuery calls.
 */
export const defaultQueryOptions = {
  staleTime: STALE_TIME.DEFAULT,
  refetchOnWindowFocus: false,
  retry: 1,
} as const;

/**
 * Extended query options for relational queries (forsering, endringsordre).
 * These queries fetch related data that changes less frequently.
 */
export const extendedQueryOptions = {
  ...defaultQueryOptions,
  staleTime: STALE_TIME.EXTENDED,
} as const;
