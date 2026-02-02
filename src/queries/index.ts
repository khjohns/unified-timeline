/**
 * Query Options
 *
 * Centralized query definitions using TanStack Query's queryOptions.
 * This provides type-safe, reusable query configurations.
 *
 * @example
 * // Use in components
 * useQuery(sakQueries.state(sakId))
 * useSuspenseQuery(forseringQueries.kontekst(sakId))
 *
 * // Use for invalidation
 * queryClient.invalidateQueries({ queryKey: sakKeys.state(sakId) })
 *
 * // Use for prefetching
 * queryClient.prefetchQuery(fravikQueries.state(sakId))
 */

export { sakKeys, sakQueries } from './sak';
export { forseringKeys, forseringQueries } from './forsering';
export { endringsordreKeys, endringsordreQueries } from './endringsordre';
export { fravikKeys, fravikQueries } from './fravik';
