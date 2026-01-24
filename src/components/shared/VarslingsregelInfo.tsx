/**
 * VarslingsregelInfo Component
 *
 * Gjenbrukbar komponent for å forklare NS 8407 varslingsregler til brukeren.
 * Viser relevant informasjon om frister, konsekvenser og §5-regler.
 *
 * Brukes i modaler der det allerede finnes alerts eller forklaringstekst,
 * for å gi konsistent og pedagogisk informasjon om varslingsplikter.
 *
 * @example
 * // For TE som sender varsel om fristforlengelse (§33.4)
 * <VarslingsregelInfo
 *   hjemmel="§33.4"
 *   rolle="TE"
 *   dagerSiden={14}
 * />
 *
 * @example
 * // For BH som vurderer om varsel kom i tide
 * <VarslingsregelInfo
 *   hjemmel="§33.4"
 *   rolle="BH"
 *   visParagraf5={true}
 * />
 */

import { Alert, type AlertVariant } from '../primitives';
import {
  getVarslingsRegel,
  getFristTypeLabel,
  getKonsekvensLabel,
  type VarslingsRegel,
  type KonsekvensType,
} from '../../constants/varslingsregler';

// ============================================================================
// TYPES
// ============================================================================

type Rolle = 'TE' | 'BH';

type Hjemmel =
  | '§33.4'
  | '§33.6.1'
  | '§33.6.2'
  | '§33.7'
  | '§33.8'
  | '§32.2'
  | '§25.1.2'
  | '§34.1.2'
  | '§34.1.3';

interface VarslingsregelInfoProps {
  /** Which paragraph this relates to */
  hjemmel: Hjemmel;
  /** Which party is viewing this (affects the messaging) */
  rolle: Rolle;
  /** Alert variant - auto-determined if not specified */
  variant?: AlertVariant;
  /** Show consequence information (default: true) */
  visKonsekvens?: boolean;
  /** Show deadline information (default: true) */
  visFrist?: boolean;
  /** Show §5 information for BH objections (default: false) */
  visParagraf5?: boolean;
  /** Days since the triggering event - for time-based warnings */
  dagerSiden?: number;
  /** Additional CSS classes */
  className?: string;
}

// ============================================================================
// HELPER DATA
// ============================================================================

/** Map hjemmel to varslingsregler.ts kode */
const HJEMMEL_TIL_KODE: Record<Hjemmel, string> = {
  '§33.4': 'FRIST_VARSEL',
  '§33.6.1': 'FRIST_SPESIFISERING',
  '§33.6.2': 'SVAR_PA_FORESPORSEL',
  '§33.7': 'BH_SVAR_KRAV',
  '§33.8': 'FORSERING_VARSEL',
  '§32.2': 'VARSEL_IRREGULAER',
  '§25.1.2': 'VARSEL_SVIKT_BH',
  '§34.1.2': 'VARSEL_SVIKT_BH', // Uses same rule
  '§34.1.3': 'VARSEL_RIGG_DRIFT',
};

/** Extended descriptions for each hjemmel - basert på kontraktsteksten */
const HJEMMEL_BESKRIVELSER: Record<Hjemmel, { te: string; bh: string; konsekvens: string }> = {
  '§33.4': {
    te: 'Du skal varsle «uten ugrunnet opphold», selv om du ennå ikke kan fremsette et spesifisert krav.',
    bh: 'Totalentreprenøren skal varsle «uten ugrunnet opphold» etter at forholdet oppstod.',
    konsekvens: 'Krav på fristforlengelse tapes.',
  },
  '§33.6.1': {
    te: 'Når du har grunnlag for å beregne omfanget, skal du «uten ugrunnet opphold» angi og begrunne antall dager.',
    bh: 'Totalentreprenøren skal angi og begrunne antall dager «uten ugrunnet opphold».',
    konsekvens: 'Bare krav på slik fristforlengelse som du «måtte forstå» at han hadde krav på.',
  },
  '§33.6.2': {
    te: 'Du skal svare på byggherrens forespørsel «uten ugrunnet opphold».',
    bh: 'Totalentreprenøren skal svare på din forespørsel «uten ugrunnet opphold».',
    konsekvens: 'Krav på fristforlengelse tapes.',
  },
  '§33.7': {
    te: 'Byggherren skal svare «uten ugrunnet opphold» etter å ha mottatt begrunnet krav med antall dager.',
    bh: 'Du skal svare «uten ugrunnet opphold» etter å ha mottatt begrunnet krav med antall dager.',
    konsekvens: 'Innsigelser mot kravet tapes.',
  },
  '§33.8': {
    te: 'Før forsering iverksettes, skal byggherren varsles med angivelse av hva forseringen antas å ville koste.',
    bh: 'Totalentreprenøren kan velge å anse avslaget som et pålegg om forsering gitt ved endringsordre.',
    konsekvens: 'Ikke eksplisitt angitt i kontrakten.',
  },
  '§32.2': {
    te: 'Du skal varsle «uten ugrunnet opphold» dersom du vil påberope at pålegget innebærer en endring.',
    bh: 'Totalentreprenøren skal varsle «uten ugrunnet opphold» dersom han vil påberope endring.',
    konsekvens: 'Retten til å påberope at pålegget innebærer en endring tapes.',
  },
  '§25.1.2': {
    te: 'Du skal varsle «uten ugrunnet opphold» når du blir oppmerksom på svikt ved byggherrens ytelser.',
    bh: 'Totalentreprenøren skal varsle «uten ugrunnet opphold» om svikten.',
    konsekvens: 'Byggherren kan kreve erstatning for tap som kunne vært unngått.',
  },
  '§34.1.2': {
    te: 'Du skal varsle om krav på vederlagsjustering «uten ugrunnet opphold» etter at forholdet oppstår.',
    bh: 'Totalentreprenøren skal varsle «uten ugrunnet opphold» om vederlagskravet.',
    konsekvens: 'Krav på vederlagsjustering tapes.',
  },
  '§34.1.3': {
    te: 'Du skal varsle særskilt «uten ugrunnet opphold» dersom du vil kreve dekning for rigg, drift eller nedsatt produktivitet.',
    bh: 'Totalentreprenøren skal varsle særskilt «uten ugrunnet opphold».',
    konsekvens: 'Retten til å kreve dekning for disse postene tapes.',
  },
};

/** §5 explanation text - basert på kontraktsteksten */
const PARAGRAF_5_INFO = {
  title: '§5: Varsler og krav',
  innsigelse:
    'Hvis du ønsker å gjøre gjeldende at den andre parten har varslet for sent, må du gjøre det skriftlig «uten ugrunnet opphold» etter å ha mottatt varselet.',
  helbredelse:
    'Gjør du ikke det, skal varselet anses for å være gitt i tide.',
};

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Determine alert variant based on days since event
 */
function getVariantFromDager(dagerSiden: number, hjemmel: Hjemmel): AlertVariant {
  // §33.8 is always info (no time pressure in the same way)
  if (hjemmel === '§33.8') {
    return 'info';
  }

  // §33.7 has tighter timeline for BH
  if (hjemmel === '§33.7') {
    if (dagerSiden > 10) return 'danger';
    if (dagerSiden > 5) return 'warning';
    return 'info';
  }

  // Default UUO thresholds
  if (dagerSiden > 14) return 'danger';
  if (dagerSiden > 7) return 'warning';
  return 'info';
}

/**
 * Get consequence severity for styling
 */
function getKonsekvensVariant(konsekvensType: KonsekvensType): AlertVariant {
  switch (konsekvensType) {
    case 'PREKLUSJON_KRAV':
    case 'PREKLUSJON_INNSIGELSE':
      return 'danger';
    case 'REDUKSJON_SKJONN':
    case 'ANSVAR_SKADE':
      return 'warning';
    default:
      return 'info';
  }
}

// ============================================================================
// COMPONENT
// ============================================================================

export function VarslingsregelInfo({
  hjemmel,
  rolle,
  variant,
  visKonsekvens = true,
  visFrist = true,
  visParagraf5 = false,
  dagerSiden,
  className,
}: VarslingsregelInfoProps) {
  // Get rule from varslingsregler.ts
  const kode = HJEMMEL_TIL_KODE[hjemmel];
  const regel = getVarslingsRegel(kode);

  // Get extended description
  const beskrivelse = HJEMMEL_BESKRIVELSER[hjemmel];

  // Determine variant
  const effectiveVariant =
    variant ?? (dagerSiden !== undefined ? getVariantFromDager(dagerSiden, hjemmel) : 'info');

  // Build title
  const title = `${hjemmel} - ${regel?.beskrivelse ?? 'Varslingsregel'}`;

  return (
    <div className={className}>
      <Alert variant={effectiveVariant} title={title}>
        {/* Main description based on role */}
        <p>{rolle === 'TE' ? beskrivelse.te : beskrivelse.bh}</p>

        {/* Days since warning */}
        {dagerSiden !== undefined && dagerSiden > 0 && (
          <p className="mt-2 font-medium">
            Det er gått <strong>{dagerSiden} dager</strong> siden hendelsen.
          </p>
        )}

        {/* Deadline info */}
        {visFrist && regel && (
          <p className="mt-2 text-sm opacity-90">
            <strong>Frist:</strong> {getFristTypeLabel(regel.frist_type)}
            {regel.frist_dager && ` (${regel.frist_dager} dager)`}
          </p>
        )}

        {/* Consequence info */}
        {visKonsekvens && (
          <p className="mt-1 text-sm opacity-90">
            <strong>Konsekvens ved brudd:</strong> {beskrivelse.konsekvens}
          </p>
        )}

        {/* §5 info for BH */}
        {visParagraf5 && rolle === 'BH' && (
          <div className="mt-3 pt-3 border-t border-current/20">
            <p className="font-medium text-sm">{PARAGRAF_5_INFO.title}</p>
            <ul className="mt-1 text-sm space-y-1 list-disc list-inside">
              <li>{PARAGRAF_5_INFO.innsigelse}</li>
              <li>{PARAGRAF_5_INFO.helbredelse}</li>
            </ul>
          </div>
        )}
      </Alert>
    </div>
  );
}

// ============================================================================
// CONVENIENCE COMPONENTS
// ============================================================================

/**
 * Specialized component for §33.4 varsel om fristforlengelse
 */
export function VarslingsregelFristVarsel({
  rolle,
  dagerSiden,
  visParagraf5 = false,
}: {
  rolle: Rolle;
  dagerSiden?: number;
  visParagraf5?: boolean;
}) {
  return (
    <VarslingsregelInfo
      hjemmel="§33.4"
      rolle={rolle}
      dagerSiden={dagerSiden}
      visParagraf5={visParagraf5}
    />
  );
}

/**
 * Specialized component for §33.6.1 specified claim
 */
export function VarslingsregelSpesifisertKrav({
  rolle,
  dagerSiden,
  visParagraf5 = false,
}: {
  rolle: Rolle;
  dagerSiden?: number;
  visParagraf5?: boolean;
}) {
  return (
    <VarslingsregelInfo
      hjemmel="§33.6.1"
      rolle={rolle}
      dagerSiden={dagerSiden}
      visParagraf5={visParagraf5}
    />
  );
}

/**
 * Specialized component for §33.7 response deadline
 */
export function VarslingsregelSvarfrist({
  rolle,
  dagerSiden,
}: {
  rolle: Rolle;
  dagerSiden?: number;
}) {
  return (
    <VarslingsregelInfo hjemmel="§33.7" rolle={rolle} dagerSiden={dagerSiden} visParagraf5={false} />
  );
}

/**
 * Specialized component for §33.8 forsering
 */
export function VarslingsregelForsering({ rolle }: { rolle: Rolle }) {
  return <VarslingsregelInfo hjemmel="§33.8" rolle={rolle} visKonsekvens={true} visFrist={false} />;
}
