/**
 * Constants - Central Export
 * All dropdown options, categories, and lookup helpers
 */

// Re-export all constants
export * from './categories';
export * from './paymentMethods';
export * from './responseOptions';
export * from './varselMetoder';
export * from './fristVarselTypes';
export * from './varslingsregler';
export * from './eventTypeLabels';

// Re-export types
export type { DropdownOption, Hovedkategori, Underkategori } from './categories';
export type { VarslingsRegel, FristType, KonsekvensType, Aktor } from './varslingsregler';
