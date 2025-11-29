import { Role } from '../types';
import { Modus } from '../services/api';

/**
 * Map modus to role
 *
 * Determines which role (TE/BH) should be active based on the current modus.
 * This eliminates the duplicated roleMap definitions in App.tsx.
 *
 * @param modus - The current workflow mode
 * @returns The corresponding role (TE or BH)
 */
export const getRoleFromModus = (modus: Modus): Role => {
  const roleMap: Record<Modus, Role> = {
    'varsel': 'TE',
    'koe': 'TE',
    'svar': 'BH',
    'revidering': 'TE',
  };
  return roleMap[modus];
};

/**
 * Get tab index from modus
 *
 * Determines which tab should be active based on the current modus.
 * This eliminates the duplicated if-else chains in App.tsx.
 *
 * @param modus - The current workflow mode
 * @returns The tab index (0: Varsel, 1: KOE, 2: BH Svar, 3: Test)
 */
export const getTabIndexFromModus = (modus: Modus): number => {
  switch (modus) {
    case 'varsel':
      return 0;
    case 'koe':
    case 'revidering':
      return 1;
    case 'svar':
      return 2;
    default:
      return 0;
  }
};
