/**
 * Mock Data Module
 *
 * Provides mock data for development, testing, and the demo page.
 *
 * ## Usage
 *
 * **Production (Demo Page):**
 * Used by ExampleCasesPage (/demo route) to display sample cases without backend.
 * ```typescript
 * import { mockCaseList } from '@/src/mocks';
 * ```
 *
 * **Testing:**
 * Used by unit tests for consistent test fixtures.
 * ```typescript
 * import { mockSakState1, getMockHistorikkById } from '@/src/mocks';
 * ```
 *
 * ## Structure
 * - `cases/` - Individual case state fixtures (SakState)
 * - `timelines/` - Timeline event fixtures (TimelineEntry[])
 * - `caseList.ts` - List of all mock cases for ExampleCasesPage
 * - `helpers.ts` - Utility functions for accessing mock data
 *
 * @note This module is intentionally in `src/` because it's used in production
 * by the demo page, not just for testing.
 */

// Re-export all cases
export * from './cases';

// Re-export all timelines
export * from './timelines';

// Re-export helper functions
export * from './helpers';

// Re-export case list
export { mockCaseList } from './caseList';
